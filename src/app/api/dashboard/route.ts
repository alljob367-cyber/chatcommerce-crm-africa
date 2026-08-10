import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";
import { Prisma } from "@prisma/client";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

type Period = "7d" | "30d" | "90d" | "custom";

function getDateRange(period: Period, customStart?: string, customEnd?: string) {
  const now = new Date();
  const start = new Date();
  switch (period) {
    case "7d":
      start.setDate(now.getDate() - 6);
      break;
    case "30d":
      start.setDate(now.getDate() - 29);
      break;
    case "90d":
      start.setDate(now.getDate() - 89);
      break;
    case "custom":
      if (customStart) {
        start.setTime(new Date(customStart).getTime());
      } else {
        start.setDate(now.getDate() - 29);
      }
      break;
  }
  start.setHours(0, 0, 0, 0);
  const end = customEnd ? new Date(customEnd) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const companyId = session.companyId;
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "7d") as Period;
    const customStart = searchParams.get("start") || undefined;
    const customEnd = searchParams.get("end") || undefined;

    const { start, end } = getDateRange(period, customStart, customEnd);

    // Total days for chart
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Run all queries in parallel
    const [
      totalContacts,
      totalOrders,
      totalRevenue,
      deliveredOrders,
      newConversations,
      openConversations,
      waitingConversations,
      closedConversations,
      contactsBySource,
      ordersByStatus,
      topProducts,
      teamPerformance,
      recentOrders,
      totalMessages,
      // Real average response time
      responseTimeData,
      // Telegram data
      tgActiveAgents,
      tgTodayBookings,
      tgPendingBookings,
      tgThisMonthBookings,
      tgRecentBookings,
      tgDailyBookingsRaw,
    ] = await Promise.all([
      db.contact.count({ where: { companyId } }),

      db.order.count({ where: { companyId, createdAt: { gte: start, lte: end } } }),

      db.order.aggregate({
        where: { companyId, paymentStatus: "paid", createdAt: { gte: start, lte: end } },
        _sum: { total: true },
      }),

      db.order.count({ where: { companyId, status: "delivered", createdAt: { gte: start, lte: end } } }),

      db.conversation.count({ where: { companyId, status: "new", createdAt: { gte: start, lte: end } } }),

      db.conversation.count({ where: { companyId, status: "open", createdAt: { gte: start, lte: end } } }),

      db.conversation.count({ where: { companyId, status: "waiting", createdAt: { gte: start, lte: end } } }),

      db.conversation.count({ where: { companyId, status: "closed", createdAt: { gte: start, lte: end } } }),

      db.contact.groupBy({
        by: ["source"],
        where: { companyId, createdAt: { gte: start, lte: end } },
        _count: { id: true },
      }),

      db.order.groupBy({
        by: ["status"],
        where: { companyId, createdAt: { gte: start, lte: end } },
        _count: { id: true },
      }),

      db.orderItem.groupBy({
        by: ["productId", "productName"],
        where: { order: { companyId, createdAt: { gte: start, lte: end } } },
        _sum: { quantity: true, total: true },
        orderBy: { _sum: { total: "desc" } },
        take: 5,
      }),

      db.user.findMany({
        where: { companyId, isActive: true },
        select: {
          id: true,
          name: true,
          avatar: true,
          role: true,
          assignedConversations: {
            where: { status: { in: ["new", "open"] } },
            select: { id: true },
          },
          createdOrders: {
            where: { createdAt: { gte: start, lte: end } },
            select: { id: true, total: true, paymentStatus: true },
          },
        },
      }),

      db.order.findMany({
        where: { companyId, createdAt: { gte: start, lte: end } },
        include: {
          contact: { select: { name: true, phone: true } },
          items: { select: { productName: true, quantity: true, total: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      db.message.count({ where: { conversation: { companyId }, createdAt: { gte: start, lte: end } } }),

      // Real average response time calculation
      db.message.findMany({
        where: {
          conversation: { companyId },
          createdAt: { gte: start, lte: end },
          senderType: { in: ["customer", "agent"] },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, conversationId: true, senderType: true, createdAt: true },
      }),

      // ---- TELEGRAM DATA ----
      db.telegramAgent.count({ where: { companyId, isActive: true } }),

      db.telegramBooking.count({
        where: {
          companyId,
          bookingDate: new Date().toISOString().split("T")[0],
          status: { not: "cancelled" },
        },
      }),

      db.telegramBooking.count({
        where: { companyId, status: "pending" },
      }),

      db.telegramBooking.count({
        where: {
          companyId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),

      db.telegramBooking.findMany({
        where: { companyId },
        include: { agent: { select: { name: true, businessType: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Daily bookings for last 7 days
      db.$queryRawUnsafe<{ date: string; count: number }[]>(
        `SELECT DATE("createdAt") as date, COUNT(*) as count 
         FROM "TelegramBooking" 
         WHERE "companyId" = $1 AND "createdAt" >= NOW() - INTERVAL '6 days'
         GROUP BY DATE("createdAt") 
         ORDER BY date ASC`,
        companyId
      ),
    ]);

    // Calculate real avg response time (admin reply after user message)
    const messageMap = new Map<string, { lastUser: Date | null; delays: number[] }>();
    for (const msg of responseTimeData) {
      if (!messageMap.has(msg.conversationId)) {
        messageMap.set(msg.conversationId, { lastUser: null, delays: [] });
      }
      const entry = messageMap.get(msg.conversationId)!;
      if (msg.senderType === "customer") {
        entry.lastUser = msg.createdAt;
      } else if (msg.senderType === "agent" && entry.lastUser) {
        const delay = msg.createdAt.getTime() - entry.lastUser.getTime();
        if (delay >= 0) {
          entry.delays.push(delay / 60000); // minutes
        }
        entry.lastUser = null;
      }
    }
    const allDelays = Array.from(messageMap.values()).flatMap((e) => e.delays);
    const avgResponseTime = allDelays.length > 0
      ? Math.round(allDelays.reduce((a, b) => a + b, 0) / allDelays.length)
      : 0;

    // Revenue by day
    const revenueByDay = await Promise.all(
      Array.from({ length: Math.min(totalDays, 90) }, (_, i) => {
        const date = new Date(start);
        date.setDate(date.getDate() + i);
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        return db.order
          .aggregate({
            where: {
              companyId,
              createdAt: { gte: date, lt: nextDate },
              paymentStatus: "paid",
            },
            _sum: { total: true },
            _count: true,
          })
          .then((r) => ({
            date: date.toISOString().split("T")[0],
            revenue: r._sum.total || 0,
            orders: r._count,
          }));
      })
    );

    // Build last 7 days for telegram daily bookings (fill missing dates with 0)
    const telegramDailyBookings: { date: string; count: number }[] = [];
    const tgDateMap = new Map(tgDailyBookingsRaw.map((d) => [d.date, d.count]));
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      telegramDailyBookings.push({
        date: dateStr,
        count: tgDateMap.get(dateStr) || 0,
      });
    }

    const totalRev = totalRevenue._sum.total || 0;
    const conversionRate =
      totalOrders > 0
        ? ((deliveredOrders / Math.max(totalContacts, 1)) * 100).toFixed(1)
        : "0";

    return NextResponse.json({
      kpis: {
        totalContacts,
        totalOrders,
        totalRevenue: totalRev,
        conversionRate: parseFloat(conversionRate),
        newConversations,
        openConversations,
        waitingConversations,
        closedConversations,
        totalMessages,
        avgResponseTime,
      },
      contactsBySource,
      ordersByStatus,
      revenueByDay,
      topProducts,
      teamPerformance: teamPerformance.map((t) => ({
        ...t,
        activeConversations: t.assignedConversations.length,
        totalOrders: t.createdOrders.length,
        totalRevenue: t.createdOrders.reduce((s, o) => s + o.total, 0),
      })),
      recentOrders,
      period,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      // Telegram dashboard data
      telegramStats: {
        activeAgents: tgActiveAgents,
        todayBookings: tgTodayBookings,
        pendingBookings: tgPendingBookings,
        thisMonthBookings: tgThisMonthBookings,
      },
      telegramRecentBookings: tgRecentBookings.map((b) => ({
        id: b.id,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        serviceName: b.serviceName,
        bookingDate: b.bookingDate,
        bookingTime: b.bookingTime,
        status: b.status,
        agentName: b.agent.name,
        agentType: b.agent.businessType,
        createdAt: b.createdAt,
      })),
      telegramDailyBookings,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
