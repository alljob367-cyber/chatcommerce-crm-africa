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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const agentId = searchParams.get("agentId");
    const where: Record<string, unknown> = { companyId };
    if (status) where.status = status;
    if (agentId) where.agentId = agentId;
    const bookings = await db.whatsAppBooking.findMany({
      where,
      include: { agent: { select: { id: true, name: true, businessType: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ bookings });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    if (session.role !== "company_admin" && session.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }
    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });
    const body = await request.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ error: "ID et status requis" }, { status: 400 });
    }
    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Status invalide" }, { status: 400 });
    }
    const booking = await db.whatsAppBooking.update({
      where: { id },
      data: { status },
    });
    return NextResponse.json({ booking });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });
    const body = await request.json();
    const { agentId, waPhoneId, customerName, customerPhone, serviceId, serviceName, bookingDate, bookingTime, notes } = body;
    if (!agentId || !waPhoneId || !customerName) {
      return NextResponse.json({ error: "Agent, telephone client et nom requis" }, { status: 400 });
    }
    const booking = await db.whatsAppBooking.create({
      data: { agentId, companyId, waPhoneId, customerName, customerPhone, serviceId, serviceName, bookingDate, bookingTime, notes },
    });
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}
