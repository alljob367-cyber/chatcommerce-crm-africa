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
    const existingOrder = await db.chariowOrder.findUnique({
      where: { chariowSaleId: saleId },
    });

    if (!existingOrder) {
      console.warn(`[Chariow Webhook] Commande non trouvee pour sale_id=${saleId}`);
      return NextResponse.json({ received: true, warning: "Order not found" });
    }

    // 4. Mettre à jour la commande selon l'événement
    if (saleStatus === "completed" || eventType === "sale.completed" || eventType === "payment.received") {
      // Paiement réussi — mettre à jour la commande ET upgrader le plan
      const [updatedOrder] = await db.$transaction([
        // Mettre à jour la commande Chariow
        db.chariowOrder.update({
          where: { id: existingOrder.id },
          data: {
            status: "completed",
            paidAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      ]);

      // Upgrader le plan de l'entreprise
      const currentCompany = await db.company.findUnique({
        where: { id: existingOrder.companyId },
        include: { subscriptions: true },
      });

      if (currentCompany) {
        // Mise à jour du plan de l'entreprise
        await db.company.update({
          where: { id: existingOrder.companyId },
          data: {
            plan: existingOrder.plan,
            updatedAt: new Date(),
          },
        });

        // Mettre à jour ou créer la subscription
        const activeSub = currentCompany.subscriptions.find(
          (s) => s.status === "active" || s.status === "trialing"
        );

        if (activeSub) {
          await db.subscription.update({
            where: { id: activeSub.id },
            data: {
              plan: existingOrder.plan,
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 jours
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

        // Mettre à jour les limites selon le nouveau plan
        const { PLAN_LIMITS } = await import("@/lib/plan-limits");
        const limits = PLAN_LIMITS[existingOrder.plan] || PLAN_LIMITS.starter;
        await db.company.update({
          where: { id: existingOrder.companyId },
          data: {
            maxContacts: limits.maxContacts,
            maxAgents: limits.maxAgents,
          },
        });

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
  const configured = !!process.env.CHARIOW_API_KEY;
  return NextResponse.json({
    status: configured ? "configured" : "not_configured",
    message: configured
      ? "Webhook Chariow actif"
      : "CHARIOW_API_KEY non configuree dans les variables d'environnement",
  });
}
