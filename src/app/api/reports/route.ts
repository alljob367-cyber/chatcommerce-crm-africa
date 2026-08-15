import { NextResponse } from "next/server";
import { db, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

function getPeriodDays(period: string): number {
  switch (period) {
    case "7d": return 7;
    case "30d": return 30;
    case "90d": return 90;
    default: return 30;
  }
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const companyId = await resolveCompanyId(session);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "bookings";
    const period = searchParams.get("period") || "30d";

    const days = getPeriodDays(period);
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    if (type === "bookings") {
      return handleBookingsReport(companyId, start, end, days);
    } else if (type === "products") {
      return handleProductsReport(companyId);
    } else if (type === "team") {
      return handleTeamReport(companyId, start, end);
    }

    return NextResponse.json({ error: "Type de rapport invalide" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

async function handleBookingsReport(companyId: string, start: Date, end: Date, days: number) {
  // Telegram booking counts by status
  const [tgPending, tgConfirmed, tgCompleted, tgCancelled] = await Promise.all([
    db.telegramBooking.count({ where: { companyId, status: "pending", createdAt: { gte: start, lte: end } } }),
    db.telegramBooking.count({ where: { companyId, status: "confirmed", createdAt: { gte: start, lte: end } } }),
    db.telegramBooking.count({ where: { companyId, status: "completed", createdAt: { gte: start, lte: end } } }),
    db.telegramBooking.count({ where: { companyId, status: "cancelled", createdAt: { gte: start, lte: end } } }),
  ]);

  // Order counts by status
  const ordersByStatus = await db.order.groupBy({
    by: ["status"],
    where: { companyId, createdAt: { gte: start, lte: end } },
    _count: { id: true },
  });

  const bookingsByStatus = {
    pending: (ordersByStatus.find((o) => o.status === "pending")?._count.id || 0) + tgPending,
    confirmed: (ordersByStatus.find((o) => o.status === "confirmed")?._count.id || 0) + tgConfirmed,
    completed: (ordersByStatus.find((o) => o.status === "delivered")?._count.id || 0) + tgCompleted,
    cancelled: (ordersByStatus.find((o) => o.status === "cancelled")?._count.id || 0) + tgCancelled,
  };

  // Bookings by Telegram agent
  const tgAgents = await db.telegramAgent.findMany({
    where: { companyId },
    select: { id: true, name: true, businessType: true },
  });

  const bookingsByAgent: { agentName: string; agentType: string; count: number }[] = [];

  for (const agent of tgAgents) {
    const count = await db.telegramBooking.count({
      where: { agentId: agent.id, createdAt: { gte: start, lte: end } },
    });
    bookingsByAgent.push({ agentName: agent.name, agentType: agent.businessType, count });
  }

  // Also count orders by user agents
  const ordersByCreator = await db.user.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      _count: {
        select: {
          createdOrders: { where: { createdAt: { gte: start, lte: end } } },
        },
      },
    },
  });

  for (const user of ordersByCreator) {
    const count = user._count.createdOrders;
    if (count > 0) {
      const existing = bookingsByAgent.find((b) => b.agentName === user.name);
      if (existing) {
        existing.count += count;
      } else {
        bookingsByAgent.push({ agentName: user.name, agentType: user.role, count });
      }
    }
  }

  bookingsByAgent.sort((a, b) => b.count - a.count);

  // Bookings by day (Telegram)
  const tgDaily = await db.$queryRawUnsafe<{ date: string; count: number }[]>(
    `SELECT DATE("createdAt") as date, COUNT(*) as count
     FROM "TelegramBooking"
     WHERE "companyId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
     GROUP BY DATE("createdAt")
     ORDER BY date ASC`,
    companyId, start, end
  );

  // Orders by day
  const ordersDaily = await db.$queryRawUnsafe<{ date: string; count: number }[]>(
    `SELECT DATE("createdAt") as date, COUNT(*) as count
     FROM "Order"
     WHERE "companyId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
     GROUP BY DATE("createdAt")
     ORDER BY date ASC`,
    companyId, start, end
  );

  // Merge into bookings-by-day
  const dayMap = new Map<string, number>();
  for (const d of tgDaily) dayMap.set(d.date, (dayMap.get(d.date) || 0) + d.count);
  for (const d of ordersDaily) dayMap.set(d.date, (dayMap.get(d.date) || 0) + d.count);

  const bookingsByDay: { date: string; count: number }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const dateStr = cur.toISOString().split("T")[0];
    bookingsByDay.push({ date: dateStr, count: dayMap.get(dateStr) || 0 });
    cur.setDate(cur.getDate() + 1);
  }

  // Revenue by agent (Telegram bookings)
  const revenueByAgent: { agentName: string; total: number }[] = [];
  for (const agent of tgAgents) {
    const bookings = await db.telegramBooking.findMany({
      where: { agentId: agent.id, createdAt: { gte: start, lte: end }, status: { not: "cancelled" } },
      select: { serviceId: true },
    });
    const serviceIds = bookings.map((b) => b.serviceId).filter((id): id is string => !!id);
    if (serviceIds.length === 0) continue;

    const services = await db.businessService.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, price: true },
    });
    const priceMap = new Map(services.map((s) => [s.id, s.price]));
    let total = 0;
    for (const b of bookings) {
      if (b.serviceId && priceMap.has(b.serviceId)) total += priceMap.get(b.serviceId)!;
    }
    if (total > 0) revenueByAgent.push({ agentName: agent.name, total });
  }

  // Top services
  const topServicesRaw = await db.telegramBooking.groupBy({
    by: ["serviceName"],
    where: { companyId, serviceName: { not: null }, createdAt: { gte: start, lte: end } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  // Also top order items
  const topOrderItems = await db.orderItem.groupBy({
    by: ["productName"],
    where: { order: { companyId, createdAt: { gte: start, lte: end } } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const serviceMap = new Map(topServicesRaw.map((s) => [s.serviceName!, s._count.id]));
  const allServices: { serviceName: string; count: number }[] = [];

  for (const [name, count] of serviceMap) {
    allServices.push({ serviceName: name, count });
  }
  for (const item of topOrderItems) {
    const existing = allServices.find((s) => s.serviceName === item.productName);
    if (existing) {
      existing.count += item._count.id;
    } else {
      allServices.push({ serviceName: item.productName, count: item._count.id });
    }
  }

  allServices.sort((a, b) => b.count - a.count);

  return NextResponse.json({
    type: "bookings",
    period: days,
    bookingsByStatus,
    bookingsByAgent,
    bookingsByDay,
    revenueByAgent,
    topServices: allServices.slice(0, 10),
  });
}

async function handleProductsReport(companyId: string) {
  const [totalProducts, activeProducts] = await Promise.all([
    db.product.count({ where: { companyId } }),
    db.product.count({ where: { companyId, isActive: true } }),
  ]);

  const categories = await db.category.findMany({
    where: { companyId },
    select: {
      id: true,
      name: true,
      _count: { select: { products: true } },
    },
  });

  const productsByCategory = categories.map((c) => ({
    categoryName: c.name,
    count: c._count.products,
  }));

  const lowStockProducts = await db.product.findMany({
    where: { companyId, isActive: true, stock: { lt: 5 } },
    select: { name: true, stock: true },
    orderBy: { stock: "asc" },
    take: 20,
  });

  return NextResponse.json({
    type: "products",
    totalProducts,
    activeProducts,
    categoriesCount: categories.length,
    productsByCategory,
    lowStockProducts,
  });
}

async function handleTeamReport(companyId: string, start: Date, end: Date) {
  const teamMembers = await db.user.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      avatar: true,
      createdOrders: {
        where: { createdAt: { gte: start, lte: end } },
        select: { id: true, total: true, status: true },
      },
      _count: {
        select: {
          assignedConversations: true,
        },
      },
    },
  });

  const teamData = teamMembers.map((m) => {
    const orders = m.createdOrders;
    return {
      name: m.name,
      role: m.role,
      avatar: m.avatar,
      bookingsHandled: orders.length,
      revenue: orders.reduce((s, o) => s + o.total, 0),
      deliveredOrders: orders.filter((o) => o.status === "delivered").length,
      totalConversations: m._count.assignedConversations,
    };
  });

  return NextResponse.json({
    type: "team",
    period: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
    teamMembers: teamData,
  });
}
