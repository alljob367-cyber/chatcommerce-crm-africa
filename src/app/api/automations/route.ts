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

    const automations = await db.automation.findMany({
      where: { companyId: session.companyId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ automations });
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
    const { name, type, trigger, messageTemplate, delayMinutes, filter } = body;

    if (!name || !type || !messageTemplate) {
      return NextResponse.json({ error: "Nom, type et message requis" }, { status: 400 });
    }

    const VALID_AUTOMATION_TYPES = ["welcome", "abandoned_order", "reactivation", "scheduled"];
    if (!VALID_AUTOMATION_TYPES.includes(type)) {
      return NextResponse.json({ error: "Type d'automatisation invalide" }, { status: 400 });
    }

    // Check plan limit for automations
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    const autoCount = await db.automation.count({ where: { companyId: session.companyId } });
    const limitError = checkPlanLimit(company?.plan || "starter", "maxAutomations", autoCount);
    if (limitError) return NextResponse.json({ error: limitError }, { status: 403 });

    const sanitizedName = sanitize(name);
    const sanitizedTemplate = sanitize(messageTemplate);

    const automation = await db.automation.create({
      data: {
        companyId: session.companyId,
        name: sanitizedName,
        type,
        trigger: trigger || type,
        messageTemplate: sanitizedTemplate,
        delayMinutes: delayMinutes || 0,
        filter: filter || null,
      },
    });

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, name, messageTemplate, isActive, delayMinutes } = body;

    const existing = await db.automation.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Automatisation introuvable" }, { status: 404 });

    const automation = await db.automation.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(messageTemplate !== undefined && { messageTemplate }),
        ...(isActive !== undefined && { isActive }),
        ...(delayMinutes !== undefined && { delayMinutes }),
      },
    });

    return NextResponse.json({ automation });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const existing = await db.automation.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Automatisation introuvable" }, { status: 404 });

    await db.automation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}