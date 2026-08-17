import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db, resolveCompanyId } from "@/lib/db";
import { handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });

    const [
      totalAgents,
      activeAgents,
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      cancelledBookings,
      recentBookings,
      agentBreakdown,
    ] = await Promise.all([
      db.whatsAppAgent.count({ where: { companyId } }),
      db.whatsAppAgent.count({ where: { companyId, isActive: true } }),
      db.whatsAppBooking.count({ where: { companyId } }),
      db.whatsAppBooking.count({ where: { companyId, status: "pending" } }),
      db.whatsAppBooking.count({ where: { companyId, status: "confirmed" } }),
      db.whatsAppBooking.count({ where: { companyId, status: "completed" } }),
      db.whatsAppBooking.count({ where: { companyId, status: "cancelled" } }),
      db.whatsAppBooking.findMany({
        where: { companyId },
        include: { agent: { select: { name: true, businessType: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.whatsAppAgent.findMany({
        where: { companyId },
        include: {
          _count: { select: { bookings: true, services: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Daily bookings chart (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyBookings = await db.$queryRawUnsafe(`
      SELECT DATE(created_at) as date, COUNT(*)::int as count
      FROM "WhatsAppBooking"
      WHERE company_id = $1 AND created_at >= $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, companyId, thirtyDaysAgo.toISOString());

    return NextResponse.json({
      stats: {
        totalAgents,
        activeAgents,
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
      },
      recentBookings,
      agentBreakdown,
      dailyBookings,
    });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}
