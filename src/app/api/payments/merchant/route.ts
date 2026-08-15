import { NextResponse } from "next/server";
import { db, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// GET /api/payments/merchant — list merchant payments with stats
export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || "";
    const status = searchParams.get("status") || "";
    const period = searchParams.get("period") || "all"; // all, today, week, month
    const search = searchParams.get("search") || "";
    const { page, limit, skip } = ((): { page: number; limit: number; skip: number } => {
      const p = parseInt(searchParams.get("page") || "1");
      const l = parseInt(searchParams.get("limit") || "50");
      return { page: p, limit: l, skip: (p - 1) * l };
    })();

    // Build date filter based on period
    let dateFilter: Record<string, unknown> | undefined;
    const now = new Date();
    if (period === "today") {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = { gte: startOfDay };
    } else if (period === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { gte: startOfWeek };
    } else if (period === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = { gte: startOfMonth };
    }

    const where: Record<string, unknown> = { companyId: realCompanyId };
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;
    if (dateFilter) where.createdAt = dateFilter;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { serviceName: { contains: search, mode: "insensitive" } },
        { transactionRef: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
      ];
    }

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

    // Calculate detailed stats
    const statsWhere: Record<string, unknown> = { companyId: realCompanyId };
    if (dateFilter) statsWhere.createdAt = dateFilter;
    if (agentId) statsWhere.agentId = agentId;

    const [totalRevenue, pendingCount, todayRevenue, weekRevenue, monthRevenue, totalPayments, rejectedCount, avgAmount] = await Promise.all([
      // Total confirmed revenue
      db.merchantPayment.aggregate({
        where: { ...statsWhere, status: "confirmed" },
        _sum: { amount: true },
      }),
      // Pending count
      db.merchantPayment.count({
        where: { ...statsWhere, status: "pending" },
      }),
      // Today revenue
      (() => {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return db.merchantPayment.aggregate({
          where: { companyId: realCompanyId, status: "confirmed", createdAt: { gte: startOfDay } },
          _sum: { amount: true },
        });
      })(),
      // Week revenue
      (() => {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
        startOfWeek.setHours(0, 0, 0, 0);
        return db.merchantPayment.aggregate({
          where: { companyId: realCompanyId, status: "confirmed", createdAt: { gte: startOfWeek } },
          _sum: { amount: true },
        });
      })(),
      // Month revenue
      (() => {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return db.merchantPayment.aggregate({
          where: { companyId: realCompanyId, status: "confirmed", createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        });
      })(),
      // Total payments count
      db.merchantPayment.count({ where: statsWhere }),
      // Rejected count
      db.merchantPayment.count({
        where: { ...statsWhere, status: "rejected" },
      }),
      // Average amount
      db.merchantPayment.aggregate({
        where: { ...statsWhere, status: "confirmed" },
        _avg: { amount: true },
      }),
    ]);

    // Get payments by agent breakdown
    const agentBreakdown = await db.merchantPayment.groupBy({
      by: ["agentId"],
      where: { ...statsWhere, status: "confirmed" },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    // Get agent names for breakdown
    const agentIds = agentBreakdown.map((a) => a.agentId);
    const agentNames = agentIds.length > 0
      ? await db.telegramAgent.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true },
        })
      : [];

    const breakdown = agentBreakdown.map((a) => ({
      agentId: a.agentId,
      name: agentNames.find((ag) => ag.id === a.agentId)?.name || "Inconnu",
      revenue: a._sum.amount || 0,
      count: a._count.id,
    }));

    return NextResponse.json({
      payments,
      total,
      page,
      limit,
      stats: {
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingCount,
        todayRevenue: todayRevenue._sum.amount || 0,
        weekRevenue: weekRevenue._sum.amount || 0,
        monthRevenue: monthRevenue._sum.amount || 0,
        totalPayments,
        rejectedCount,
        avgAmount: avgAmount._avg.amount || 0,
        breakdown,
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
    const { id, action, notes } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "ID et action requis" }, { status: 400 });
    }

    const payment = await db.merchantPayment.findFirst({
      where: { id, companyId: realCompanyId },
      include: { agent: { select: { token: true } } },
    });
    if (!payment) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

    if (action === "confirm") {
      await db.merchantPayment.update({
        where: { id },
        data: { status: "confirmed", confirmedAt: new Date(), notes: notes || null },
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
      // Notify customer of confirmation
      try {
        const confirmMsg = [
          `✅ <b>Paiement confirmé par le marchand !</b>`,
          ``,
          `📋 Service: <b>${payment.serviceName || "Commande"}</b>`,
          `💰 Montant: <b>${Number(payment.amount).toLocaleString("fr-FR")} ${payment.currency}</b>`,
          ``,
          `Merci pour votre confiance ! 🙏`,
        ].join("\n");
        const botToken = payment.agent?.token;
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: payment.chatId, text: confirmMsg, parse_mode: "HTML" }),
          });
        }
      } catch { /* ignore notification */ }
    } else if (action === "reject") {
      await db.merchantPayment.update({
        where: { id },
        data: { status: "rejected", notes: notes || null },
      });
      if (payment.bookingId) {
        try {
          await db.telegramBooking.update({
            where: { id: payment.bookingId },
            data: { status: "cancelled" },
          });
        } catch { /* ignore */ }
      }
      // Notify customer of rejection
      try {
        const rejectMsg = [
          `❌ <b>Paiement non confirmé</b>`,
          ``,
          `📋 Service: <b>${payment.serviceName || "Commande"}</b>`,
          `💰 Montant: <b>${Number(payment.amount).toLocaleString("fr-FR")} ${payment.currency}</b>`,
          ``,
          `Le marchand n'a pas pu vérifier ce paiement. Veuillez vérifier votre numéro de transaction et réessayer avec /payer.`,
        ].join("\n");
        const botToken = payment.agent?.token;
        if (botToken) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: payment.chatId, text: rejectMsg, parse_mode: "HTML" }),
          });
        }
      } catch { /* ignore notification */ }
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
