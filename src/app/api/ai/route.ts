import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { rateLimit, handleError } from "@/lib/security";
import { db } from "@/lib/db";
import { generateAIResponse, buildAIBotConfig, buildContextFromBusinessData } from "@/lib/ai-bot-engine";

// AI endpoint — uses real LLM engine connected to business data
export async function POST(request: Request) {
  try {
    // Auth check
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Rate limit: 20 requests per minute per user
    const rl = await rateLimit(`ai:${payload.userId}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de requetes. Veuillez patienter." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, agentId } = body;

    if (!message) {
      return NextResponse.json({ error: "Message requis" }, { status: 400 });
    }

    // Find agent to get AI config and business data
    let aiConfigParams: Parameters<typeof buildAIBotConfig>[0] = {
      businessType: "default",
      name: "ChatCommerce",
      services: "Aucun service configure",
    };
    let businessContext: string | null = null;

    if (agentId) {
      try {
        const agent = await db.telegramAgent.findFirst({
          where: { id: agentId, companyId: payload.companyId },
          include: {
            services: {
              where: { isActive: true },
              select: { id: true, name: true, description: true, price: true, isActive: true },
              orderBy: { sortOrder: "asc" },
            },
            company: {
              select: {
                name: true,
                address: true,
                phone: true,
                currency: true,
                products: {
                  where: { isActive: true },
                  select: { name: true, description: true, price: true, stock: true, isActive: true },
                },
              },
            },
          },
        });

        if (agent) {
          const currency = agent.currency || "XAF";
          aiConfigParams = {
            aiConfig: agent.aiConfig || undefined,
            businessType: agent.businessType,
            name: agent.name,
            services: agent.services.map((s) =>
              `- ${s.name} (${s.price.toLocaleString("fr-FR")} ${currency})${s.description ? `: ${s.description}` : ""}`
            ).join("\n"),
          };

          businessContext = buildContextFromBusinessData({
            services: agent.services,
            products: agent.company?.products || [],
            companyName: agent.company?.name || agent.name,
            businessType: agent.businessType,
            address: agent.address,
            phone: agent.phone,
            openHours: agent.openHours,
            currency,
          });
        }
      } catch (e) {
        console.error("[AI] Failed to load agent data:", e);
      }
    } else {
      // No agent specified — try to find any active agent for the company
      try {
        const agent = await db.telegramAgent.findFirst({
          where: { companyId: payload.companyId, isActive: true },
          include: {
            services: {
              where: { isActive: true },
              select: { id: true, name: true, description: true, price: true, isActive: true },
              orderBy: { sortOrder: "asc" },
            },
            company: {
              select: {
                name: true,
                address: true,
                phone: true,
                currency: true,
                products: {
                  where: { isActive: true },
                  select: { name: true, description: true, price: true, stock: true, isActive: true },
                },
              },
            },
          },
        });

        if (agent) {
          const currency = agent.currency || "XAF";
          aiConfigParams = {
            aiConfig: agent.aiConfig || undefined,
            businessType: agent.businessType,
            name: agent.name,
            services: agent.services.map((s) =>
              `- ${s.name} (${s.price.toLocaleString("fr-FR")} ${currency})${s.description ? `: ${s.description}` : ""}`
            ).join("\n"),
          };

          businessContext = buildContextFromBusinessData({
            services: agent.services,
            products: agent.company?.products || [],
            companyName: agent.company?.name || agent.name,
            businessType: agent.businessType,
            address: agent.address,
            phone: agent.phone,
            openHours: agent.openHours,
            currency,
          });
        }
      } catch (e) {
        console.error("[AI] Failed to load company agent:", e);
      }
    }

    // Build AI config
    const aiConfig = buildAIBotConfig(aiConfigParams);

    // Try real AI generation
    if (aiConfig.enabled && aiConfig.apiKey) {
      try {
        const reply = await generateAIResponse(message, aiConfig, [], businessContext);
        if (reply) {
          return NextResponse.json({
            reply,
            category: "ai",
            confidence: 0.95,
            aiEnabled: true,
          });
        }
      } catch (error) {
        console.error("[AI] LLM generation error:", error);
        // Fall through to keyword fallback
      }
    }

    // Fallback: keyword-based responses when AI is not configured
    const responses: Record<string, string[]> = {
      greeting: [
        "Bonjour ! Bienvenue chez notre etablissement. Comment puis-je vous aider ?",
        "Bonsoir ! Merci de nous contacter. Que desirez-vous commander ?",
        "Hello ! Nous sommes ravis de vous servir. Que puis-je faire pour vous ?",
      ],
      menu: [
        "Voici notre menu du jour :\nPoulet DG - 4 500 FCFA\nNdole - 3 500 FCFA\nEru - 3 000 FCFA\nJus de Mangue - 1 000 FCFA\nSouhaitez-vous commander ?",
      ],
      delivery: [
        "Nous livrons dans toute la ville !\n- Livraison standard : 500 FCFA (45 min)\n- Livraison express : 1 000 FCFA (20 min)\nAcceptons Orange Money et MTN MoMo.",
      ],
      price: [
        "Nos prix sont tres competitifs :\n- Plats principaux : 2 000 - 5 000 FCFA\n- Boissons : 300 - 1 500 FCFA\n- Desserts : 500 - 2 500 FCFA\nTous les prix incluent la TVA.",
      ],
      hours: [
        "Nos horaires d'ouverture :\nLundi - Samedi : 9h00 - 22h00\nDimanche : 10h00 - 20h00\nNous sommes actuellement ouverts !",
      ],
      payment: [
        "Nous acceptons plusieurs methodes de paiement :\n- Orange Money\n- MTN Mobile Money\n- Especes\n- Carte (sur place uniquement)\nQuel mode preferez-vous ?",
      ],
      default: [
        "Merci pour votre message ! Pour mieux vous servir, tapez /menu pour voir nos services ou /aide pour l'aide.",
        "Je comprends votre demande. Comment puis-je vous aider aujourd'hui ? Tapez /menu pour voir notre catalogue.",
      ],
    };

    const msg = message.toLowerCase();
    let category = "default";
    if (msg.match(/bonjour|salut|hello|hi|bonsoir|good morning/)) category = "greeting";
    else if (msg.match(/menu|carte|plats|disponib|what do you have/)) category = "menu";
    else if (msg.match(/livraison|delivery|livrer|commander|commande/)) category = "delivery";
    else if (msg.match(/prix|price|coût|combien|tarif|cout/)) category = "price";
    else if (msg.match(/horaire|heure|ouverture|fermé|open|close/)) category = "hours";
    else if (msg.match(/paiement|payment|orange money|momo|payer/)) category = "payment";

    const options = responses[category];
    const reply = options[Math.floor(Math.random() * options.length)];

    return NextResponse.json({
      reply,
      category,
      confidence: category !== "default" ? 0.85 : 0.6,
      aiEnabled: aiConfig.enabled && !!aiConfig.apiKey,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
