import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";
import { checkPlanLimit } from "@/lib/plan-limits";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const agentId = searchParams.get("agentId") || "";

    const where: Record<string, unknown> = { companyId: session.companyId };
    if (status) where.status = status;
    if (agentId) where.agentId = agentId;

    const bookings = await db.telegramBooking.findMany({
      where,
      include: {
        agent: { select: { name: true, businessType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ bookings });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, status } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID et statut requis" }, { status: 400 });
    }

    const validStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const existing = await db.telegramBooking.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Reservation introuvable" }, { status: 404 });

    const booking = await db.telegramBooking.update({
      where: { id },
      data: { status },
    });

    return NextResponse.json({ booking });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { agentId, customerName, customerPhone, serviceId, serviceName, bookingDate, bookingTime, notes, chatId } = body;

    // Vérifier les limites de réservation du plan
    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: { company: true },
    });
    const companyPlan = user?.company?.plan || "starter";
    const bookingCount = await db.telegramBooking.count({
      where: { companyId: session.companyId, status: { notIn: ["cancelled"] } },
    });
    const limitError = checkPlanLimit(companyPlan, "maxBookings", bookingCount);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 403 });
    }

    // Validate required fields
    if (!agentId || !customerName || !bookingDate || !bookingTime) {
      return NextResponse.json(
        { error: "Agent, nom du client, date et heure sont requis" },
        { status: 400 }
      );
    }

    // Verify agent belongs to company
    const agent = await db.telegramAgent.findFirst({
      where: { id: agentId, companyId: session.companyId },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    }

    // ── Double-booking prevention ──
    const existingBooking = await db.telegramBooking.findFirst({
      where: {
        agentId,
        bookingDate: sanitize(bookingDate),
        bookingTime: sanitize(bookingTime),
        status: { notIn: ["cancelled"] },
      },
    });

    if (existingBooking) {
      return NextResponse.json(
        { error: "Ce créneau est déjà réservé. Veuillez choisir un autre horaire." },
        { status: 409 }
      );
    }

    const booking = await db.telegramBooking.create({
      data: {
        agentId,
        companyId: session.companyId,
        chatId: chatId || "manual",
        customerName: sanitize(customerName),
        customerPhone: customerPhone ? sanitize(customerPhone) : null,
        serviceId: serviceId || null,
        serviceName: serviceName ? sanitize(serviceName) : null,
        bookingDate: sanitize(bookingDate),
        bookingTime: sanitize(bookingTime),
        notes: notes ? sanitize(notes) : null,
        status: "pending",
      },
      include: {
        agent: { select: { name: true, businessType: true } },
      },
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
