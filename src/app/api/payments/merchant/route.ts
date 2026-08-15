import { NextResponse } from "next/server";
import { db, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/payments/merchant — list merchant payments
export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || "";
    const status = searchParams.get("status") || "";
    const { page, limit, skip } = ((): { page: number; limit: number; skip: number } => {
      const p = parseInt(searchParams.get("page") || "1");
      const l = parseInt(searchParams.get("limit") || "50");
      return { page: p, limit: l, skip: (p - 1) * l };
    })();

    const where: Record<string, unknown> = { companyId: realCompanyId };
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      db.merchantPayment.findMany({
        where,
        include: {
          agent: { select: { id: true, name: true, botUsername: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.merchantPayment.count({ where }),
    ]);

    // Calculate totals
    const totalRevenue = await db.merchantPayment.aggregate({
      where: { companyId: realCompanyId, status: "confirmed" },
      _sum: { amount: true },
    });

    const pendingCount = await db.merchantPayment.count({
      where: { companyId: realCompanyId, status: "pending" },
    });

    return NextResponse.json({
      payments,
      total,
      page,
      limit,
      stats: {
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingCount,
      },
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// PATCH /api/payments/merchant — confirm/reject payment
export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const realCompanyId = await resolveCompanyId(session);
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "ID et action requis" }, { status: 400 });
    }

    const payment = await db.merchantPayment.findFirst({
      where: { id, companyId: realCompanyId },
    });
    if (!payment) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

    if (action === "confirm") {
      await db.merchantPayment.update({
        where: { id },
        data: { status: "confirmed", confirmedAt: new Date() },
      });
      // Also confirm linked booking
      if (payment.bookingId) {
        try {
          await db.telegramBooking.update({
            where: { id: payment.bookingId },
            data: { status: "confirmed" },
          });
        } catch { /* ignore */ }
      }
    } else if (action === "reject") {
      await db.merchantPayment.update({
        where: { id },
        data: { status: "rejected" },
      });
      if (payment.bookingId) {
        try {
          await db.telegramBooking.update({
            where: { id: payment.bookingId },
            data: { status: "cancelled" },
          });
        } catch { /* ignore */ }
      }
    } else {
      return NextResponse.json({ error: "Action non reconnue. Utilisez confirm ou reject." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// DELETE /api/payments/merchant — delete a payment record
export async function DELETE(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

    const realCompanyId = await resolveCompanyId(session);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const payment = await db.merchantPayment.findFirst({
      where: { id, companyId: realCompanyId },
    });
    if (!payment) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

    await db.merchantPayment.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
