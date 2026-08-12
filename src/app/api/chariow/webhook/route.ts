import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

/**
 * POST /api/chariow/webhook
 * Webhook Chariow (Pulse) — reçoit les notifications de paiement
 */
export async function POST(request: Request) {
  try {
    // 1. Vérifier l'authentification du webhook
    const authHeader = request.headers.get("authorization");
    const signature = request.headers.get("x-chariow-signature");
    const apiKey = process.env.CHARIOW_API_KEY;
    const webhookSecret = process.env.CHARIOW_WEBHOOK_SECRET;

    // Verification avec timing-safe comparison
    let isAuthenticated = false;

    if (webhookSecret && signature) {
      // Compare avec timing-safe pour eviter les timing attacks
      const expected = Buffer.from(webhookSecret, "utf-8");
      const actual = Buffer.from(signature, "utf-8");
      if (expected.length === actual.length) {
        isAuthenticated = crypto.timingSafeEqual(expected, actual);
      }
    } else if (apiKey && authHeader) {
      // Fallback: verifier que le header Authorization contient la cle API
      const expected = Buffer.from(apiKey, "utf-8");
      const actual = Buffer.from(authHeader.replace("Bearer ", ""), "utf-8");
      if (expected.length === actual.length) {
        isAuthenticated = crypto.timingSafeEqual(expected, actual);
      }
    }

    if (!isAuthenticated) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    // 2. Parser le payload
    const payload = await request.json();
    console.log("[Chariow Webhook] Payload recu:", JSON.stringify(payload).substring(0, 500));

    // Chariow Pulse peut envoyer différents types d'événements
    const eventType = payload.event || payload.type || payload.action;
    const saleData = payload.data?.sale || payload.data?.purchase || payload.sale || payload.purchase || payload;

    const saleId = saleData.id;
    const saleStatus = saleData.status;

    if (!saleId) {
      console.warn("[Chariow Webhook] Pas de sale_id dans le payload");
      return NextResponse.json({ received: true });
    }

    // 3. Trouver la commande correspondante dans notre base
    let existingOrder = await db.chariowOrder.findUnique({
      where: { chariowSaleId: saleId },
    });

    // Fallback: match by metadata (companyId + userId + plan + pending) if chariowSaleId not set
    if (!existingOrder) {
      const metadata = payload.metadata || payload.data?.metadata || {};
      const companyId = metadata.company_id || metadata.companyId;
      const userId = metadata.user_id || metadata.userId;
      const plan = metadata.plan;

      if (companyId && userId && plan) {
        existingOrder = await db.chariowOrder.findFirst({
          where: {
            companyId,
            userId,
            plan,
            status: "pending",
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        // Update the order with the chariowSaleId for future lookups
        if (existingOrder) {
          await db.chariowOrder.update({
            where: { id: existingOrder.id },
            data: { chariowSaleId: saleId },
          });
        }
      }
    }

    if (!existingOrder) {
      console.warn(`[Chariow Webhook] Commande non trouvee pour sale_id=${saleId}`);
      return NextResponse.json({ received: true, warning: "Order not found" });
    }

    // 4. Verifier le montant paye correspond au plan commande (anti-underpay)
    const paidAmount = saleData.amount || saleData.total || saleData.amount_paid;
    const expectedAmount = existingOrder.amount;

    if (paidAmount !== undefined && paidAmount !== null) {
      const paid = Number(paidAmount);
      if (paid < expectedAmount * 0.95) {
        // Tolérance de 5% pour les frais/arrondis
        console.warn(
          `[Chariow Webhook] Montant incorrect: paye=${paid}, attendu=${expectedAmount}, plan=${existingOrder.plan}`
        );
        // Marquer la commande en erreur mais ne pas upgrader
        await db.chariowOrder.update({
          where: { id: existingOrder.id },
          data: { status: "failed", updatedAt: new Date() },
        });
        return NextResponse.json({
          received: true,
          error: "amount_mismatch",
          paid,
          expected: expectedAmount,
        });
      }
    }

    // 5. Mettre à jour la commande selon l'événement
    if (saleStatus === "completed" || eventType === "sale.completed" || eventType === "payment.received") {
      // IDEMPOTENCY: Skip if already completed (replay protection)
      if (existingOrder.status === "completed") {
        console.log(`[Chariow Webhook] Ordre deja complete: ${existingOrder.id}`);
        return NextResponse.json({ received: true, status: "already_completed" });
      }

      // Prevent plan downgrades via payment
      const currentCompany = await db.company.findUnique({
        where: { id: existingOrder.companyId },
      });
      if (currentCompany) {
        const { PLAN_ORDER } = await import("@/lib/plan-limits");
        const currentIdx = PLAN_ORDER.indexOf(currentCompany.plan as any);
        const targetIdx = PLAN_ORDER.indexOf(existingOrder.plan as any);
        if (targetIdx < currentIdx) {
          console.warn(`[Chariow Webhook] Downgrade bloque: ${currentCompany.plan} -> ${existingOrder.plan}`);
          await db.chariowOrder.update({
            where: { id: existingOrder.id },
            data: { status: "failed", updatedAt: new Date() },
          });
          return NextResponse.json({ received: true, error: "downgrade_blocked" });
        }
      }

      // Paiement réussi — mettre à jour la commande ET upgrader le plan dans une transaction atomique
      const { PLAN_LIMITS } = await import("@/lib/plan-limits");
      const limits = PLAN_LIMITS[existingOrder.plan] || PLAN_LIMITS.starter;

      await db.$transaction([
        // 1. Mettre à jour la commande Chariow
        db.chariowOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: "completed",
            paidAt: new Date(),
            updatedAt: new Date(),
          },
        }),
        // 2. Upgrader le plan ET les limites de l'entreprise en une seule opération
        db.company.update({
          where: { id: existingOrder.companyId },
          data: {
            plan: existingOrder.plan,
            maxContacts: limits.maxContacts,
            maxAgents: limits.maxAgents,
            updatedAt: new Date(),
          },
        }),
      ]);

      // Mettre à jour ou créer la subscription
      const companyWithSubs = await db.company.findUnique({
        where: { id: existingOrder.companyId },
        include: { subscriptions: true },
      });

      if (companyWithSubs) {
        const activeSub = companyWithSubs.subscriptions.find(
          (s) => s.status === "active" || s.status === "trialing"
        );

        if (activeSub) {
          await db.subscription.update({
            where: { id: activeSub.id },
            data: {
              plan: existingOrder.plan,
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              updatedAt: new Date(),
            },
          });
        } else {
          await db.subscription.create({
            data: {
              companyId: existingOrder.companyId,
              plan: existingOrder.plan,
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }

        console.log(
          `[Chariow Webhook] Plan upgrade: ${existingOrder.plan} pour company=${existingOrder.companyId}`
        );
      }

      // Créer une notification
      await db.notification.create({
        data: {
          companyId: existingOrder.companyId,
          userId: existingOrder.userId,
          title: "Paiement confirmé",
          message: `Votre abonnement ${existingOrder.plan} a été activé avec succès via Chariow.`,
          type: "success",
        },
      });

      return NextResponse.json({ received: true, status: "completed" });
    }

    if (saleStatus === "refunded" || eventType === "sale.refunded") {
      // Remboursement
      await db.chariowOrder.update({
        where: { id: existingOrder.id },
        data: {
          status: "refunded",
          updatedAt: new Date(),
        },
      });

      console.log(`[Chariow Webhook] Remboursement pour order=${existingOrder.id}`);
      return NextResponse.json({ received: true, status: "refunded" });
    }

    if (saleStatus === "failed" || eventType === "sale.failed") {
      await db.chariowOrder.update({
        where: { id: existingOrder.id },
        data: {
          status: "failed",
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({ received: true, status: "failed" });
    }

    // Événement non géré — loguer et ack
    console.log(`[Chariow Webhook] Evenement non gere: type=${eventType}, status=${saleStatus}`);
    return NextResponse.json({ received: true, event: eventType });

  } catch (error: unknown) {
    console.error("[Chariow Webhook] Erreur:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

/**
 * GET /api/chariow/webhook
 * Endpoint de test pour vérifier la configuration
 */
export async function GET() {
  // Health check only — never leak config status
  return NextResponse.json({ status: "ok" });
}
