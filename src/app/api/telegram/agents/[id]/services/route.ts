import { NextResponse } from "next/server";
import { db, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    const realCompanyId = await resolveCompanyId(session);

    // Verify agent belongs to company
    const agent = await db.telegramAgent.findFirst({
      where: { id, companyId: realCompanyId },
    });
    if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

    const services = await db.businessService.findMany({
      where: { agentId: id },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ services });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // SECURITY: Only admins can create services
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse. Seul un administrateur peut gerer les services." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, price, duration, image, isActive } = body;
    const realCompanyId = await resolveCompanyId(session);

    if (!name || price === undefined) {
      return NextResponse.json({ error: "Nom et prix requis" }, { status: 400 });
    }

    // Verify agent belongs to company
    const agent = await db.telegramAgent.findFirst({
      where: { id, companyId: realCompanyId },
    });
    if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

    // Get max sort order
    const maxSort = await db.businessService.findFirst({
      where: { agentId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const service = await db.businessService.create({
      data: {
        agentId: id,
        name: sanitize(name),
        description: description ? sanitize(description) : null,
        price: parseFloat(price),
        duration: duration ? parseInt(duration) : null,
        image: image || null,
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: (maxSort?.sortOrder || 0) + 1,
      },
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // SECURITY: Only admins can delete services
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse. Seul un administrateur peut supprimer des services." }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");
    const realCompanyId = await resolveCompanyId(session);

    if (!serviceId) {
      return NextResponse.json({ error: "serviceId requis" }, { status: 400 });
    }

    // Verify agent belongs to company
    const agent = await db.telegramAgent.findFirst({
      where: { id, companyId: realCompanyId },
    });
    if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

    const service = await db.businessService.findFirst({
      where: { id: serviceId, agentId: id },
    });
    if (!service) return NextResponse.json({ error: "Service introuvable" }, { status: 404 });

    await db.businessService.delete({
      where: { id: serviceId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}