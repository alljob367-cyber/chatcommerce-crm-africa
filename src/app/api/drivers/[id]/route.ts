import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

export const dynamic = "force-dynamic";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Single driver by ID ──────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;

    const driver = await db.driver.findFirst({
      where: { id, companyId: session.companyId, isActive: true },
      include: {
        _count: {
          select: { deliveries: true },
        },
        deliveries: {
          where: { status: { in: ["assigned", "picked_up", "on_the_way"] } },
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            deliveryAddress: true,
            createdAt: true,
          },
        },
      },
    });

    if (!driver) {
      return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
    }

    return NextResponse.json({ driver });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PUT: Update driver ────────────────────────────────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Verify driver belongs to company
    const existing = await db.driver.findFirst({
      where: { id, companyId: session.companyId, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
    }

    const VALID_VEHICLE_TYPES = ["motorcycle", "car", "bicycle", "foot"];
    const VALID_STATUSES = ["available", "busy", "offline"];

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = sanitize(body.name);
    if (body.phone !== undefined) updateData.phone = sanitize(body.phone);
    if (body.vehicleType !== undefined) {
      if (body.vehicleType && !VALID_VEHICLE_TYPES.includes(body.vehicleType)) {
        return NextResponse.json({ error: "Type de véhicule invalide" }, { status: 400 });
      }
      updateData.vehicleType = body.vehicleType || null;
    }
    if (body.vehiclePlate !== undefined) updateData.vehiclePlate = body.vehiclePlate ? sanitize(body.vehiclePlate) : null;
    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
      }
      updateData.status = body.status;
    }
    if (body.telegramId !== undefined) updateData.telegramId = body.telegramId || null;
    if (body.telegramUsername !== undefined) updateData.telegramUsername = body.telegramUsername ? sanitize(body.telegramUsername) : null;
    if (body.avatar !== undefined) updateData.avatar = body.avatar || null;
    if (body.location !== undefined) updateData.location = body.location;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    const driver = await db.driver.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ driver });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── DELETE: Soft-delete driver ────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;

    // Verify driver belongs to company
    const existing = await db.driver.findFirst({
      where: { id, companyId: session.companyId, isActive: true },
      include: {
        _count: {
          select: {
            deliveries: {
              where: { status: { in: ["assigned", "picked_up", "on_the_way", "pending", "searching"] } },
            },
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
    }

    if (existing._count.deliveries > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer : ce chauffeur a des livraisons en cours" },
        { status: 409 }
      );
    }

    await db.driver.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Chauffeur supprimé avec succès" });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
