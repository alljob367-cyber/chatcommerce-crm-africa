import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

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
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const thisMonthStartISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStartISO = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

    // Agent counts
    const totalAgents = await db.telegramAgent.count({ where: { companyId } });
    const activeAgents = await db.telegramAgent.count({ where: { companyId, isActive: true } });

    // Service counts
    const totalServices = await db.businessService.count({
      where: { agent: { companyId } },
    });

    // Booking stats
    const totalBookings = await db.telegramBooking.count({ where: { companyId } });
    const todayBookings = await db.telegramBooking.count({
      where: { companyId, bookingDate: today, status: { not: "cancelled" } },
    });
    const pendingBookings = await db.telegramBooking.count({
      where: { companyId, status: "pending" },
    });
    const confirmedBookings = await db.telegramBooking.count({
      where: { companyId, status: "confirmed" },
    });
    const completedBookings = await db.telegramBooking.count({
      where: { companyId, status: "completed" },
    });

    // This month bookings
    const thisMonthBookings = await db.telegramBooking.count({
      where: { companyId, createdAt: { gte: new Date(thisMonthStartISO) } },
    });

    // Per-agent breakdown
    const agents = await db.telegramAgent.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        businessType: true,
        isActive: true,
        _count: {
          select: {
            services: true,
            bookings: true,
          },
        },
      },
    });

    // Recent bookings (last 10)
    const recentBookings = await db.telegramBooking.findMany({
      where: { companyId },
      include: {
        agent: { select: { name: true, businessType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Bookings per day this month (for chart)
    const dailyBookings = await db.$queryRawUnsafe<{ date: string; count: number }[]>(
      `SELECT DATE("createdAt") as date, COUNT(*) as count 
       FROM "TelegramBooking" 
       WHERE "companyId" = $1 AND "createdAt" >= $2 
       GROUP BY DATE("createdAt") 
       ORDER BY date DESC 
       LIMIT 30`,
      companyId, thisMonthStartISO
    );

    return NextResponse.json({
      summary: {
        totalAgents,
        activeAgents,
        totalServices,
        totalBookings,
        todayBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        thisMonthBookings,
      },
      agents,
      recentBookings,
      dailyBookings,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
