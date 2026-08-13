import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, safePagination, handleError } from "@/lib/security";
import { checkPlanLimit } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: List deliveries for company ───────────────────
export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const driverId = searchParams.get("driverId") || "";
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

    const VALID_STATUSES = [
      "pending", "searching", "assigned", "picked_up",
      "on_the_way", "delivered", "cancelled",
    ];

    const where: Record<string, unknown> = { companyId: session.companyId };
    if (status && status !== "all" && VALID_STATUSES.includes(status)) where.status = status;
    if (driverId) where.driverId = driverId;

    const [deliveries, total] = await Promise.all([
      db.delivery.findMany({
        where,
        include: {
          driver: {
            select: { id: true, name: true, phone: true, vehicleType: true, status: true },
          },
          order: {
            select: { id: true, orderNumber: true, total: true },
          },
          agent: {
            select: { id: true, name: true, botUsername: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.delivery.count({ where }),
    ]);

    return NextResponse.json({ deliveries, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Create delivery ──────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Check plan limit for deliveries
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    if (company) {
      const deliveryCount = await db.delivery.count({ where: { companyId: session.companyId } });
      const limitError = checkPlanLimit(company.plan, "maxDeliveries", deliveryCount);
      if (limitError) {
        return NextResponse.json({ error: limitError }, { status: 403 });
      }
    }

    const body = await request.json();
    const {
      orderId, agentId,
      pickupAddress, pickupLat, pickupLng,
      deliveryAddress, deliveryLat, deliveryLng,
      customerPhone, customerName,
      fee, driverEarnings, distance, estimatedTime,
      notes, telegramChatId,
    } = body;

    if (!pickupAddress || !deliveryAddress || !customerPhone || !customerName) {
      return NextResponse.json(
        { error: "Adresse de pickup, adresse de livraison, téléphone et nom du client requis" },
        { status: 400 }
      );
    }

    // If linked to an order, verify it belongs to this company
    if (orderId) {
      const order = await db.order.findFirst({
        where: { id: orderId, companyId: session.companyId },
      });
      if (!order) {
        return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
      }
    }

    // If linked to a Telegram agent, verify it belongs to this company
    if (agentId) {
      const agent = await db.telegramAgent.findFirst({
        where: { id: agentId, companyId: session.companyId },
      });
      if (!agent) {
        return NextResponse.json({ error: "Agent Telegram introuvable" }, { status: 404 });
      }
    }

    const delivery = await db.delivery.create({
      data: {
        companyId: session.companyId,
        orderId: orderId || null,
        agentId: agentId || null,
        pickupAddress: sanitize(pickupAddress),
        pickupLat: pickupLat ?? null,
        pickupLng: pickupLng ?? null,
        deliveryAddress: sanitize(deliveryAddress),
        deliveryLat: deliveryLat ?? null,
        deliveryLng: deliveryLng ?? null,
        customerPhone: sanitize(customerPhone),
        customerName: sanitize(customerName),
        status: "pending",
        fee: fee || 0,
        driverEarnings: driverEarnings || 0,
        distance: distance ?? null,
        estimatedTime: estimatedTime ?? null,
        notes: notes ? sanitize(notes) : null,
        telegramChatId: telegramChatId || null,
      },
    });

    return NextResponse.json({ delivery }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
