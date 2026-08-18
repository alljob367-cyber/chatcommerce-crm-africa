import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db, resolveCompanyId } from "@/lib/db";
import { handleError } from "@/lib/security";

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
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });
    const { id } = await params;
    const agent = await db.whatsAppAgent.findFirst({
      where: { id, companyId },
      include: {
        services: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
        _count: { select: { bookings: true } },
      },
    });
    if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) {
      (agent as Record<string, unknown>).accessToken = undefined;
    }
    return NextResponse.json({ agent });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });
    const { id } = await params;
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    const body = await request.json();
    const updateData: Record<string, unknown> = {};
    if (isAdmin) {
      if (body.name !== undefined) updateData.name = body.name;
      if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber;
      if (body.phoneId !== undefined) updateData.phoneId = body.phoneId;
      if (body.accessToken !== undefined) updateData.accessToken = body.accessToken;
      if (body.businessType !== undefined) updateData.businessType = body.businessType;
      if (body.welcomeMessage !== undefined) updateData.welcomeMessage = body.welcomeMessage;
      if (body.address !== undefined) updateData.address = body.address;
      if (body.phone !== undefined) updateData.phone = body.phone;
      if (body.openHours !== undefined) updateData.openHours = body.openHours;
      if (body.currency !== undefined) updateData.currency = body.currency;
      if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
      if (body.aiConfig !== undefined) updateData.aiConfig = JSON.stringify(body.aiConfig);
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
    }
    const agent = await db.whatsAppAgent.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ agent });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    if (session.role !== "company_admin" && session.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }
    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });
    const { id } = await params;
    // Delete services first
    await db.businessService.deleteMany({ where: { whatsappAgentId: id } });
    await db.whatsAppAgent.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}
