import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";
import { PLAN_LIMITS } from "@/lib/plan-limits";

// Legacy alias for local usage
const _LIMITS = PLAN_LIMITS;

// POST: Confirmer ou rejeter un paiement (admin only)
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Vérifier que c'est un admin
    if (payload.role !== "super_admin" && payload.role !== "company_admin") {
      return NextResponse.json({ error: "Acces refuse. Reserve aux administrateurs." }, { status: 403 });
    }

    const body = await request.json();
    const { paymentId, action, rejectionReason } = body;

    if (!paymentId || !action) {
      return NextResponse.json({ error: "paymentId et action requis" }, { status: 400 });
    }

    if (!["confirm", "reject"].includes(action)) {
      return NextResponse.json({ error: "Action invalide. Utilisez 'confirm' ou 'reject'." }, { status: 400 });
    }

    // Trouver le paiement
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return NextResponse.json({ error: "Paiement non trouve" }, { status: 404 });
    }

    // C5 FIX: company_admin can only manage their own company's payments
    if (payload.role === "company_admin" && payment.companyId !== payload.companyId) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        { error: `Ce paiement est deja ${payment.status}` },
        { status: 400 }
      );
    }

    const PLAN_PRICES: Record<string, number> = { starter: 5000, pro: 14900, business: 29900, enterprise: 69900 };
    if (Number(payment.amount) !== PLAN_PRICES[payment.plan]) {
      return NextResponse.json({ error: "Montant incorrect pour ce plan" }, { status: 400 });
    }

    // Vérifier l'expiration
    if (new Date() > payment.expiresAt) {
      await db.payment.update({
        where: { id: paymentId },
        data: { status: "expired" },
      });
      return NextResponse.json({ error: "Ce paiement a expire" }, { status: 400 });
    }

    if (action === "reject") {
      const updated = await db.payment.update({
        where: { id: paymentId },
        data: {
          status: "rejected",
          rejectionReason: rejectionReason || "Paiement rejete par l'administrateur",
          confirmedById: payload.userId,
          confirmedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, payment: updated });
    }

    // Action: confirm — wrap entire flow in transaction to prevent double-confirmation
    const [updated, company] = await db.$transaction(async (tx) => {
      const up = await tx.payment.update({
        where: { id: paymentId, status: "pending" },
        data: {
          status: "confirmed",
          confirmedById: payload.userId,
          confirmedAt: new Date(),
        },
      });

      const limits = PLAN_LIMITS[payment.plan];
      const co = await tx.company.update({
        where: { id: payment.companyId },
        data: {
          plan: payment.plan,
          maxContacts: limits.maxContacts,
          maxAgents: limits.maxAgents,
        },
      });

      const existingSub = await tx.subscription.findFirst({
        where: { companyId: payment.companyId, status: { in: ["active", "trialing"] } },
      });
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      if (existingSub) {
        await tx.subscription.update({
          where: { id: existingSub.id },
          data: { plan: payment.plan, status: "active", currentPeriodStart: new Date(), currentPeriodEnd: periodEnd },
        });
      } else {
        await tx.subscription.create({
          data: { companyId: payment.companyId, plan: payment.plan, status: "active", currentPeriodStart: new Date(), currentPeriodEnd: periodEnd },
        });
      }

      return [up, co];
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ success: true, payment: updated });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}