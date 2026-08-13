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

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";

    const agents = await db.telegramAgent.findMany({
      where: { companyId: session.companyId },
      select: {
        id: true,
        companyId: true,
        businessType: true,
        name: true,
        botUsername: true,
        token: true,  // needed by frontend to detect placeholder vs real token
        isActive: true,
        welcomeMessage: true,
        address: true,
        phone: true,
        openHours: true,
        currency: true,
        paymentMethod: true,
        // SECURITY: Only expose AI config to admins — contains apiKey
        ...(isAdmin ? { aiConfig: true } : { aiEnabled: true }),
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { services: true, bookings: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Strip token from non-admin responses and apiKey from aiConfig
    const safeAgents = agents.map((a: Record<string, unknown>) => {
      if (!isAdmin) delete a.token;
      if (a.aiConfig && typeof a.aiConfig === "string") {
        try {
          const parsed = JSON.parse(a.aiConfig);
          delete parsed.apiKey;
          a.aiConfig = JSON.stringify(parsed);
        } catch { /* ignore */ }
      }
      return a;
    });

    return NextResponse.json({ agents: safeAgents });
  } catch (error: unknown) {
    console.error("[API /telegram/agents]", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    console.log("[API /telegram/agents POST] session:", JSON.stringify({ userId: session.userId, companyId: session.companyId, role: session.role, isAdmin }));
    const body = await request.json();
    console.log("[API /telegram/agents POST] body keys:", Object.keys(body));

    if (!isAdmin) {
      // ── Agent / Viewer : ne peut fournir que le token pour activer un agent existant ──
      const { agentId, token: botToken } = body;
      if (!agentId || !botToken) {
        return NextResponse.json({ error: "Agent ID et token requis" }, { status: 400 });
      }

      // Vérifier que l'agent existe et appartient à la company
      const existing = await db.telegramAgent.findFirst({
        where: { id: agentId, companyId: session.companyId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });
      }

      // Mettre à jour uniquement le token
      const agent = await db.telegramAgent.update({
        where: { id: agentId },
        data: { token: botToken },
      });

      const { token: _botToken, ...safeAgent } = agent;
      return NextResponse.json({ agent: safeAgent, message: "Token mis a jour. L'agent est pret." });
    }

    // ── Admin : configuration complète ──
    const { name, token: botToken, botUsername, businessType, welcomeMessage, address, phone, openHours, currency, paymentMethod, aiEnabled, aiProvider, aiApiKey, aiModel, aiBaseUrl, aiSystemPrompt } = body;

    if (!name || !botToken || !businessType) {
      return NextResponse.json({ error: "Nom, token et type de business requis" }, { status: 400 });
    }

    const VALID_BUSINESS_TYPES = [
      "restaurant", "salon_coiffure", "pharmacie", "taxi_transport", "pressing_laverie",
      "ecole_formation", "supermarche", "clinique", "agence_voyage", "boulangerie", "garage_auto", "salle_sport",
    ];
    if (!VALID_BUSINESS_TYPES.includes(businessType)) {
      return NextResponse.json({ error: "Type de business invalide" }, { status: 400 });
    }

    // Check plan limit for telegram agents
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    const agentCount = await db.telegramAgent.count({ where: { companyId: session.companyId } });
    const limitError = checkPlanLimit(company?.plan || "starter", "maxTelegramAgents", agentCount);
    if (limitError) return NextResponse.json({ error: limitError }, { status: 403 });

    const agent = await db.telegramAgent.create({
      data: {
        companyId: session.companyId,
        name: sanitize(name),
        token: botToken,
        botUsername: botUsername ? sanitize(botUsername) : null,
        businessType,
        welcomeMessage: welcomeMessage ? sanitize(welcomeMessage) : null,
        address: address ? sanitize(address) : null,
        phone: phone ? sanitize(phone) : null,
        openHours: openHours || null,
        currency: currency || "XAF",
        paymentMethod: paymentMethod || null,
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
    console.log("[API /telegram/agents POST] Agent créé:", safeAgent.id, "par userId:", session.userId, "companyId:", session.companyId);
    return NextResponse.json({ agent: safeAgent, message: "Agent créé avec succès !" }, { status: 201 });
  } catch (error: unknown) {
    console.error("[API /telegram/agents POST] Erreur:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}