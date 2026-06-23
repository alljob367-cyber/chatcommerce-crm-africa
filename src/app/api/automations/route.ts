import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

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
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
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

    const automation = await db.automation.create({
      data: {
        companyId: session.companyId,
        name,
        type,
        trigger: trigger || type,
        messageTemplate,
        delayMinutes: delayMinutes || 0,
        filter: filter || null,
      },
    });

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, name, messageTemplate, isActive, delayMinutes } = body;

    const automation = await db.automation.update({
      where: { id, companyId: session.companyId },
      data: {
        ...(name !== undefined && { name }),
        ...(messageTemplate !== undefined && { messageTemplate }),
        ...(isActive !== undefined && { isActive }),
        ...(delayMinutes !== undefined && { delayMinutes }),
      },
    });

    return NextResponse.json({ automation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    await db.automation.delete({
      where: { id, companyId: session.companyId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}