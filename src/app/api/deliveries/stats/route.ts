import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

export const dynamic = "force-dynamic";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Delivery statistics ──────────────────────────
export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const companyId = session.companyId;

    // Run all queries in parallel
    const [
      totalDeliveries,
      statusBreakdown,
      activeDrivers,
      totalDrivers,
      totalRevenue,
      totalDriverEarnings,
      recentDeliveries,
      averageDeliveryTime,
      driverPerformance,
    ] = await Promise.all([
      // Total deliveries in period
      db.delivery.count({
        where: { companyId, createdAt: { gte: startDate } },
      }),

      // Status breakdown
      db.delivery.groupBy({
        by: ["status"],
        where: { companyId, createdAt: { gte: startDate } },
        _count: { status: true },
      }),

      // Active (busy) drivers
      db.driver.count({
        where: { companyId, status: "busy", isActive: true },
      }),

      // Total active drivers
      db.driver.count({
        where: { companyId, isActive: true },
      }),

      // Total delivery fees collected
      db.delivery.aggregate({
        where: { companyId, status: "delivered", deliveredAt: { gte: startDate } },
        _sum: { fee: true },
      }),

      // Total driver earnings
      db.delivery.aggregate({
        where: { companyId, status: "delivered", deliveredAt: { gte: startDate } },
        _sum: { driverEarnings: true },
      }),

      // Last 5 delivered for quick view
      db.delivery.findMany({
        where: { companyId, status: "delivered" },
        take: 5,
        orderBy: { deliveredAt: "desc" },
        select: {
          id: true, deliveryAddress: true, fee: true,
          deliveredAt: true,
          driver: { select: { name: true } },
        },
      }),

      // Average delivery time (created → delivered) in minutes
      db.delivery.findMany({
        where: {
          companyId,
          status: "delivered",
          deliveredAt: { gte: startDate },
          pickedUpAt: { not: null },
        },
        select: {
          createdAt: true,
          pickedUpAt: true,
          deliveredAt: true,
        },
        take: 500,
      }),

      // Driver performance ranking
      db.driver.findMany({
        where: { companyId, isActive: true },
        select: {
          id: true, name: true, phone: true, avatar: true,
          vehicleType: true, status: true,
          rating: true, totalDeliveries: true, totalEarnings: true,
        },
        orderBy: [{ totalDeliveries: "desc" }, { rating: "desc" }],
        take: 20,
      }),
    ]);

    // Calculate average delivery times
    let avgPrepTime = 0;
    let avgTransitTime = 0;
    let avgTotalTime = 0;
    const completedDeliveries = averageDeliveryTime.length;

    if (completedDeliveries > 0) {
      let sumPrep = 0;
      let sumTransit = 0;
      let sumTotal = 0;
      for (const d of averageDeliveryTime) {
        if (d.deliveredAt && d.pickedUpAt) {
          sumPrep += d.pickedUpAt.getTime() - d.createdAt.getTime();
          sumTransit += d.deliveredAt.getTime() - d.pickedUpAt.getTime();
          sumTotal += d.deliveredAt.getTime() - d.createdAt.getTime();
        }
      }
      avgPrepTime = Math.round(sumPrep / completedDeliveries / 60000);
      avgTransitTime = Math.round(sumTransit / completedDeliveries / 60000);
      avgTotalTime = Math.round(sumTotal / completedDeliveries / 60000);
    }

    // Cancellation rate
    const cancelledCount = statusBreakdown.find((s) => s.status === "cancelled")?._count.status || 0;
    const cancellationRate = totalDeliveries > 0
      ? Math.round((cancelledCount / totalDeliveries) * 100)
      : 0;

    return NextResponse.json({
      period,
      totalDeliveries,
      statusBreakdown: statusBreakdown.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      }, {}),
      activeDrivers,
      totalDrivers,
      totalRevenue: totalRevenue._sum.fee || 0,
      totalDriverEarnings: totalDriverEarnings._sum.driverEarnings || 0,
      recentDeliveries,
      averageTimes: {
        preparationMinutes: avgPrepTime,
        transitMinutes: avgTransitTime,
        totalMinutes: avgTotalTime,
      },
      cancellationRate,
      driverPerformance,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
