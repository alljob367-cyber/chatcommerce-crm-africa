import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { secureRandom, handleError } from "@/lib/security";

const PLAN_PRICES: Record<string, number> = {
  starter: 5000,
  pro: 14900,
  business: 29900,
  enterprise: 99900,
};

function generateRef(): string {
  return "PAY-" + secureRandom(8);
}

// POST: Créer une demande de paiement manuel
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

    const body = await request.json();
    const { plan, paymentMethod, transactionRef, senderPhone, senderName } = body;

    // Validation
    if (!plan || !paymentMethod || !transactionRef || !senderPhone) {
      return NextResponse.json(
        { error: "Plan, methode de paiement, reference de transaction et numero expediteur sont requis" },
        { status: 400 }
      );
    }

    if (!["starter", "pro", "business", "enterprise"].includes(plan)) {
      return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
    }

    if (!["orange_money", "mtn_money"].includes(paymentMethod)) {
      return NextResponse.json({ error: "Methode de paiement invalide" }, { status: 400 });
    }

    // Vérifier qu'il n'y a pas de paiement en cours pour ce plan
    const existingPending = await db.payment.findFirst({
      where: {
        companyId: payload.companyId,
        plan,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      return NextResponse.json(
        { error: "Vous avez deja une demande de paiement en cours pour ce plan. Veuillez attendre sa validation ou son expiration." },
        { status: 409 }
      );
    }

    const amount = PLAN_PRICES[plan];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expire dans 24h

    // Vérifier l'unicité de la référence
    let reference = generateRef();
    let exists = await db.payment.findUnique({ where: { reference } });
    while (exists) {
      reference = generateRef();
      exists = await db.payment.findUnique({ where: { reference } });
    }

    const payment = await db.payment.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        amount,
        currency: "XAF",
        paymentMethod,
        transactionRef: transactionRef.trim(),
        senderPhone: senderPhone.trim(),
        senderName: senderName?.trim() || null,
        plan,
        reference,
        expiresAt,
        status: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        plan: payment.plan,
        status: payment.status,
        expiresAt: payment.expiresAt,
        createdAt: payment.createdAt,
      },
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// GET: Lister les paiements de la compagnie
export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = { companyId: payload.companyId };
    if (status) where.status = status;

    const payments = await db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        reference: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        plan: true,
        status: true,
        transactionRef: true,
        senderPhone: true,
        senderName: true,
        rejectionReason: true,
        expiresAt: true,
        confirmedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ payments });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}