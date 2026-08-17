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
    const agent = await db.whatsAppAgent.findFirst({ where: { id, companyId } });
    if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });
    const services = await db.businessService.findMany({
      where: { whatsappAgentId: id },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ services });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}

export async function POST(
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
    const agent = await db.whatsAppAgent.findFirst({ where: { id, companyId } });
    if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });
    const body = await request.json();
    const { name, description, price, duration, image, isActive, sortOrder } = body;
    if (!name || price === undefined) {
      return NextResponse.json({ error: "Nom et prix requis" }, { status: 400 });
    }
    const service = await db.businessService.create({
      data: {
        whatsappAgentId: id,
        name,
        description,
        price,
        duration,
        image,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });
    return NextResponse.json({ service }, { status: 201 });
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
    const agent = await db.whatsAppAgent.findFirst({ where: { id, companyId } });
    if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");
    if (serviceId) {
      const service = await db.businessService.findFirst({
        where: { id: serviceId, whatsappAgentId: id },
      });
      if (!service) return NextResponse.json({ error: "Service non trouve" }, { status: 404 });
      await db.businessService.delete({ where: { id: serviceId } });
      return NextResponse.json({ success: true });
    }
    await db.businessService.deleteMany({ where: { whatsappAgentId: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}
