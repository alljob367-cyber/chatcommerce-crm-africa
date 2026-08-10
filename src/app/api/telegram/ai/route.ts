import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import {
  generateAIResponse,
  suggestService,
  buildAIBotConfig,
  buildContextFromBusinessData,
} from "@/lib/ai-bot-engine";

// POST /api/telegram/ai
// Endpoint called by the mini-service telegram bot service
// to get an AI-generated response for a customer message.
export async function POST(req: NextRequest) {
  try {
    // Authenticate the request
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { message, agentId, conversationHistory } = body;

    if (!message || !agentId) {
      return NextResponse.json(
        { error: "Paramètres manquants: message et agentId requis" },
        { status: 400 }
      );
    }

    // Fetch the Telegram agent with its company, services, AND company products
    const agent = await db.telegramAgent.findFirst({
      where: { id: agentId, companyId: user.companyId },
      include: {
        services: {
          where: { isActive: true },
          select: { name: true, description: true, price: true, isActive: true },
        },
        company: {
          select: {
            name: true,
            address: true,
            phone: true,
            currency: true,
            products: {
              where: { isActive: true },
              select: {
                name: true,
                description: true,
                price: true,
                stock: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent non trouvé" }, { status: 404 });
    }

    // Build a services summary string for the prompt (kept for backward compat)
    const currency = agent.company?.currency || agent.currency || "XAF";
    const servicesSummary = agent.services
      .map(
        (s) =>
          `- ${s.name} (${s.price.toLocaleString("fr-FR")} ${currency})${s.description ? `: ${s.description}` : ""}`
      )
      .join("\n");

    // Build AI config from agent data
    const aiConfig = buildAIBotConfig({
      aiConfig: (agent as Record<string, unknown>).aiConfig as string | null | undefined,
      businessType: agent.businessType,
      name: agent.name,
      services: servicesSummary,
    });

    // Build structured business context from REAL database data
    const businessContext = buildContextFromBusinessData({
      services: agent.services.map((s) => ({
        name: s.name,
        description: s.description,
        price: s.price,
        isActive: s.isActive,
      })),
      products: agent.company?.products.map((p) => ({
        name: p.name,
        description: p.description,
        price: p.price,
        stock: p.stock,
        isActive: p.isActive,
      })) ?? [],
      companyName: agent.company?.name || agent.name,
      businessType: agent.businessType,
      address: agent.address || agent.company?.address,
      phone: agent.phone || agent.company?.phone,
      openHours: agent.openHours,
      currency,
    });

    let aiResponse: string | null = null;
    let matchedService: {
      name: string;
      description: string | null;
      price: number;
      confidence: number;
    } | null = null;

    // Try AI generation first — inject business context
    if (aiConfig.enabled) {
      aiResponse = await generateAIResponse(
        message,
        aiConfig,
        Array.isArray(conversationHistory) ? conversationHistory : [],
        businessContext
      );
    }

    // If AI failed or is disabled, fall back to keyword matching
    if (!aiResponse) {
      const suggestion = await suggestService(message, agent.services);
      if (suggestion.service && suggestion.confidence >= 0.3) {
        matchedService = {
          name: suggestion.service.name,
          description: suggestion.service.description ?? null,
          price: suggestion.service.price,
          confidence: suggestion.confidence,
        };
        aiResponse = `Nous avons le service "${suggestion.service.name}" au prix de ${suggestion.service.price.toLocaleString("fr-FR")} ${currency}. Souhaitez-vous commander ou réserver ?`;
      } else {
        // Generic fallback response
        aiResponse = agent.welcomeMessage || null;
      }
    }

    return NextResponse.json({
      response: aiResponse,
      matchedService,
      aiEnabled: aiConfig.enabled,
    });
  } catch (error) {
    console.error("[API /telegram/ai] Error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
