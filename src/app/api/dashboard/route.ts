import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { Prisma } from "@prisma/client";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const companyId = session.companyId;

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
      revenueByDay,
      topProducts,
      teamPerformance,
      recentOrders,
      totalMessages,
      avgResponseTime,
    ] = await Promise.all([
      db.contact.count({ where: { companyId } }),

      db.order.count({ where: { companyId } }),

      db.order.aggregate({
        where: { companyId, paymentStatus: "paid" },
        _sum: { total: true },
      }),

      db.order.count({ where: { companyId, status: "delivered" } }),

      db.conversation.count({ where: { companyId, status: "new" } }),

      db.conversation.count({ where: { companyId, status: "open" } }),

      db.conversation.count({ where: { companyId, status: "waiting" } }),

      db.conversation.count({ where: { companyId, status: "closed" } }),

      db.contact.groupBy({
        by: ["source"],
        where: { companyId },
        _count: { id: true },
      }),

      db.order.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { id: true },
      }),

      // Revenue by last 7 days
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          date.setHours(0, 0, 0, 0);
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
      ),

      db.orderItem.groupBy({
        by: ["productId", "productName"],
        where: { order: { companyId } },
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
            select: { id: true, total: true, paymentStatus: true },
            take: 50,
          },
        },
      }),

      db.order.findMany({
        where: { companyId },
        include: {
          contact: { select: { name: true, phone: true } },
          items: { select: { productName: true, quantity: true, total: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      db.message.count({ where: { conversation: { companyId } } }),

      // Simulated average response time
      Promise.resolve(Math.floor(Math.random() * 10 + 2)),
    ]);

    const totalRev = totalRevenue._sum.total || 0;
    const conversionRate =
      totalOrders > 0
        ? ((deliveredOrders / totalContacts) * 100).toFixed(1)
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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}