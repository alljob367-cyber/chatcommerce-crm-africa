import { NextResponse } from "next/server";
import { resolveCompanyId, db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, safePagination, handleError } from "@/lib/security";
import { checkPlanLimit } from "@/lib/plan-limits";

export const dynamic = "force-dynamic";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: List drivers for company ──────────────────────
export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const search = searchParams.get("search") || "";
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

    const VALID_STATUSES = ["available", "busy", "offline"];

    const where: Record<string, unknown> = { companyId: realCompanyId, isActive: true };
    if (status && VALID_STATUSES.includes(status)) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { telegramUsername: { contains: search } },
      ];
    }

    const [drivers, total] = await Promise.all([
      db.driver.findMany({
        where,
        include: {
          _count: {
            select: { deliveries: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.driver.count({ where }),
    ]);

    return NextResponse.json({ drivers, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Create driver ────────────────────────────────
export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    // Check plan limit for drivers
    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { plan: true },
    });
    if (company) {
      const driverCount = await db.driver.count({
        where: { companyId: realCompanyId, isActive: true },
      });
      const limitError = await checkPlanLimit(company.plan, "maxDrivers", driverCount);
      if (limitError) {
        return NextResponse.json({ error: limitError }, { status: 403 });
      }
    }

    const body = await request.json();
    const { name, phone, vehicleType, vehiclePlate, telegramId, telegramUsername } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Nom et téléphone requis" }, { status: 400 });
    }

    const VALID_VEHICLE_TYPES = ["motorcycle", "car", "bicycle", "foot"];
    if (vehicleType && !VALID_VEHICLE_TYPES.includes(vehicleType)) {
      return NextResponse.json({ error: "Type de véhicule invalide" }, { status: 400 });
    }

    const driver = await db.driver.create({
      data: {
        companyId: realCompanyId,
        name: sanitize(name),
        phone: sanitize(phone),
        vehicleType: vehicleType || null,
        vehiclePlate: vehiclePlate ? sanitize(vehiclePlate) : null,
        telegramId: telegramId || null,
        telegramUsername: telegramUsername ? sanitize(telegramUsername) : null,
      },
    });

    return NextResponse.json({ driver }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
