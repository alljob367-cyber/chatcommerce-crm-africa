import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
    const agent = await db.telegramAgent.findFirst({
      where: { id, companyId: session.companyId },
      include: {
        services: { orderBy: { sortOrder: "asc" } },
        _count: { select: { bookings: true } },
      },
    });

    if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
    return NextResponse.json({ agent });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { name, token: botToken, botUsername, businessType, isActive, welcomeMessage, address, phone, openHours, currency, paymentMethod, aiEnabled, aiProvider, aiApiKey, aiModel, aiBaseUrl, aiSystemPrompt } = body;

    const agent = await db.telegramAgent.update({
      where: { id, companyId: session.companyId },
      data: {
        ...(name !== undefined && { name: sanitize(name) }),
        ...(botToken !== undefined && { token: botToken }),
        ...(botUsername !== undefined && { botUsername: sanitize(botUsername) }),
        ...(businessType !== undefined && { businessType }),
        ...(isActive !== undefined && { isActive }),
        ...(welcomeMessage !== undefined && { welcomeMessage: welcomeMessage ? sanitize(welcomeMessage) : null }),
        ...(address !== undefined && { address: address ? sanitize(address) : null }),
        ...(phone !== undefined && { phone: phone ? sanitize(phone) : null }),
        ...(openHours !== undefined && { openHours }),
        ...(currency !== undefined && { currency }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(aiEnabled !== undefined || aiProvider || aiApiKey ? {
          aiConfig: JSON.stringify({
            enabled: aiEnabled ?? false,
            provider: aiProvider || "openai",
            apiKey: aiApiKey || "",
            model: aiModel || "",
            baseUrl: aiBaseUrl || "",
            systemPrompt: aiSystemPrompt || "",
          }),
        } : {}),
      },
    });

    return NextResponse.json({ agent });
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

    const { id } = await params;
    await db.telegramAgent.delete({
      where: { id, companyId: session.companyId },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
