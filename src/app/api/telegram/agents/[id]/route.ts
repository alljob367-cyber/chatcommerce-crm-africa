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

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    const { id } = await params;
    const agent = await db.telegramAgent.findFirst({
      where: { id, companyId: session.companyId },
      select: {
        id: true,
        companyId: true,
        businessType: true,
        name: true,
        botUsername: true,
        token: false,  // NEVER expose bot token to client
        isActive: true,
        welcomeMessage: true,
        // SECURITY: Only expose full AI config to admins
        ...(isAdmin ? { aiConfig: true } : { aiEnabled: true }),
        createdAt: true,
        updatedAt: true,
        services: { orderBy: { sortOrder: "asc" } },
        _count: { select: { bookings: true } },
      },
    });

    if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

    // Strip apiKey from aiConfig for safety
    if (isAdmin && (agent as Record<string, unknown>).aiConfig) {
      try {
        const parsed = JSON.parse((agent as Record<string, unknown>).aiConfig as string);
        delete parsed.apiKey;
        (agent as Record<string, unknown>).aiConfig = JSON.stringify(parsed);
      } catch { /* ignore */ }
    }

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

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    const { id } = await params;
    const body = await request.json();

    const existing = await db.telegramAgent.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Agent Telegram introuvable" }, { status: 404 });

    if (!isAdmin) {
      // ── Agent / Viewer : ne peut modifier que le token ──
      const { token: botToken } = body;
      if (!botToken) {
        return NextResponse.json({ error: "Token requis" }, { status: 400 });
      }
      const agent = await db.telegramAgent.update({
        where: { id },
        data: { token: botToken },
      });
      const { token: _botToken, ...safeAgent } = agent;
      return NextResponse.json({ agent: safeAgent });
    }

    // ── Admin : modification complète ──
    const { name, token: botToken, botUsername, businessType, isActive, welcomeMessage, address, phone, openHours, currency, paymentMethod, aiEnabled, aiProvider, aiApiKey, aiModel, aiBaseUrl, aiSystemPrompt } = body;

    const agent = await db.telegramAgent.update({
      where: { id },
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

    const { token: _botToken, ...safeAgent } = agent;
    return NextResponse.json({ agent: safeAgent });
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

    // Suppression réservée à l'admin
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse. Seul un administrateur peut supprimer un agent." }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.telegramAgent.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Agent Telegram introuvable" }, { status: 404 });

    await db.telegramAgent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
