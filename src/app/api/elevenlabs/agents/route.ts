import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleError } from "@/lib/security";
import { listAgents, listVoices, type ElevenLabsConfig, type ElevenAgentResponse } from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── Business type system prompts for ElevenLabs agents ─────

const BUSINESS_PROMPTS: Record<string, string> = {
  restaurant: `Tu es un assistant virtuel pour un restaurant africain. Tu es courtois, professionnel et passionne par la bonne cuisine.
Tu aides les clients a decouvrir le menu, passer des commandes, connaitre les prix et les horaires d'ouverture.
Tu reponds toujours en francais. Si on te demande quelque chose hors sujet, ramene doucement la conversation vers le restaurant.
Tu ne donne jamais de prix inventes — utilise uniquement les informations fournies.`,

  salon_coiffure: `Tu es un assistant virtuel pour un salon de coiffure et de beaute. Tu es chaleureux et professionnel.
Tu aides les clients a prendre rendez-vous, decouvrir les services (coupe, tresses, meches, barbe, etc.), connaitre les prix et les disponibilites.
Tu reponds toujours en francais. Sois accueillant et propose des services adaptes.`,

  pharmacie: `Tu es un assistant virtuel pour une pharmacie. Tu es professionnel et attentif a la sante.
Tu aides les clients a trouver des medicaments, connaitre les horaires, verifier les disponibilites.
ATTENTION: Tu ne fais JAMAIS de diagnostic medical. Tu renvoies toujours vers un professionnel de sante pour les questions medicales.
Tu reponds toujours en francais.`,

  taxi: `Tu es un assistant virtuel pour un service de taxi. Tu es reactif et courtois.
Tu aides les clients a commander une course, connaitre les tarifs, estimer les temps de trajet.
Tu reponds toujours en francais. Tu demandes toujours l'adresse de depart et de destination.`,

  braiseuse_poisson: `Tu es l'assistant virtuel de "Braiseuse de Poisson" — un restaurant specialise dans le poisson braise africain.
Tu es passionne, chaleureux et connaisseur de la cuisine de poisson.
Tu presentes le menu avec enthousiasme: poisson braise, macho grille, alloco, plantain, crudit, sauce piquante, etc.
Tu aides les clients a passer commande et connaitre les prix. Tu reponds toujours en francais.`,

  default: `Tu es un assistant virtuel professionnel et serviable. Tu aides les clients avec leurs questions.
Tu reponds toujours en francais. Sois courtois et concis.`,
};

const VALID_BUSINESS_TYPES = ["restaurant", "salon_coiffure", "pharmacie", "taxi", "braiseuse_poisson", "default"];

// ─── GET: List ElevenLabs agents (DB + ElevenLabs API) ──────

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

    // Fetch our DB agents
    const dbAgents = await db.elevenLabsAgent.findMany({
      where: { companyId: session.companyId },
      include: { services: true },
      orderBy: { createdAt: "desc" },
    });

    // Try to sync with ElevenLabs API if key is set
    let elevenAgents: ElevenAgentResponse[] = [];
    if (ELEVEN_API_KEY) {
      try {
        const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
        elevenAgents = await listAgents(config);
      } catch (e) {
        console.warn("[ElevenLabs] Could not list agents from API:", e);
      }
    }

    // Merge: enrich DB agents with ElevenLabs live status
    const merged = dbAgents.map((agent) => {
      const elevenMatch = agent.elevenAgentId
        ? elevenAgents.find((e) => e.agent_id === agent.elevenAgentId)
        : null;
      return {
        ...agent,
        elevenLabsStatus: elevenMatch ? "active" : agent.elevenAgentId ? "not_found" : "local_only",
        elevenLabsName: elevenMatch?.name || null,
      };
    });

    // Stats
    const totalAgents = dbAgents.length;
    const activeAgents = dbAgents.filter((a) => a.isActive).length;
    const connectedAgents = merged.filter((a) => a.elevenLabsStatus === "active").length;
    const totalMessages = dbAgents.reduce((sum, a) => sum + a.totalMessages, 0);

    return NextResponse.json({
      agents: merged,
      elevenLabsAgents: elevenAgents.map((a) => ({ id: a.agent_id, name: a.name, model: a.model, language: a.language })),
      stats: { totalAgents, activeAgents, connectedAgents, totalMessages },
      apiKeyConfigured: !!ELEVEN_API_KEY,
      platformReady: !!ELEVEN_API_KEY,
    });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/agents] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Create a new ElevenLabs agent ─────────────────────

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_API_KEY) {
      return NextResponse.json({ error: "Cle API ElevenLabs non configuree. Ajoutez ELEVENLABS_API_KEY dans les variables d'environnement." }, { status: 400 });
    }

    const body = await request.json();
    const { name, businessType, voiceId, createOnElevenLabs } = body;

    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
    const bType = businessType && VALID_BUSINESS_TYPES.includes(businessType) ? businessType : "default";

    // Check agent limit
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { maxAgents: true, elevenLabsAgents: { select: { id: true } } } });
    if (company && company.elevenLabsAgents.length >= company.maxAgents) {
      return NextResponse.json({ error: `Limite atteinte (${company.maxAgents} agents maximum). Passez a un plan superieur.` }, { status: 403 });
    }

    // Build agent config
    const systemPrompt = BUSINESS_PROMPTS[bType] || BUSINESS_PROMPTS.default;
    const welcomeMsg = body.welcomeMessage || getDefaultWelcome(bType, name);

    let elevenAgentId: string | null = null;
    let agentConfigJson: Record<string, unknown> | null = null;

    const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
    const webhookUrl = baseUrl ? `${baseUrl}/api/elevenlabs/webhook` : undefined;
    const webhookSecret = `el_secret_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Create on ElevenLabs if requested
    if (createOnElevenLabs !== false) {
      try {
        const { createAgent } = await import("@/lib/elevenlabs");
        const created = await createAgent(config, {
          name,
          prompt: systemPrompt,
          firstMessage: welcomeMsg,
          voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM",
          language: "fr",
          model: "eleven_multilingual_v2",
          temperature: 0.5,
          webhookUrl,
          webhookSecret,
        });
        elevenAgentId = created.agent_id;
        agentConfigJson = {
          agentId: created.agent_id,
          firstMessage: created.first_message,
          prompt: created.prompt,
          voiceId: created.voice_id,
          model: created.model,
          language: created.language,
          temperature: created.temperature,
        };
      } catch (e) {
        console.error("[ElevenLabs] Failed to create agent on ElevenLabs, saving locally:", e);
        // Save locally even if ElevenLabs creation fails
      }
    }

    // Save to DB
    const agent = await db.elevenLabsAgent.create({
      data: {
        companyId: session.companyId,
        name,
        elevenAgentId: elevenAgentId || undefined,
        businessType: bType,
        welcomeMessage: welcomeMsg,
        address: body.address || null,
        phone: body.phone || null,
        openHours: body.openHours ? JSON.stringify(body.openHours) : null,
        currency: body.currency || "XAF",
        paymentMethod: body.paymentMethod || null,
        agentConfig: agentConfigJson ? JSON.stringify(agentConfigJson) : null,
        webhookSecret: elevenAgentId ? webhookSecret : null,
      },
    });

    // Create default services based on business type
    const defaultServices = getDefaultServices(bType);
    if (defaultServices.length > 0) {
      await db.businessService.createMany({
        data: defaultServices.map((s, i) => ({
          elevenLabsAgentId: agent.id,
          name: s.name,
          description: s.description,
          price: s.price,
          duration: s.duration || null,
          sortOrder: i,
          isActive: true,
        })),
      });
    }

    return NextResponse.json({ success: true, agent });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/agents POST] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function getDefaultWelcome(bType: string, name: string): string {
  const welcomes: Record<string, string> = {
    restaurant: `Bienvenue chez ${name} ! Je suis votre assistant virtuel. Comment puis-je vous aider ? Vous pouvez me demander le menu, les prix, ou passer une commande.`,
    salon_coiffure: `Bonjour et bienvenue chez ${name} ! Je suis votre assistant beaute. Vous souhaitez prendre rendez-vous ou decouvrir nos services ?`,
    pharmacie: `Bienvenue a la pharmacie ${name}. Comment puis-je vous aider aujourd'hui ? Pour toute question medicale, je vous invite a consulter notre pharmacien.`,
    taxi: `Bonjour ! Je suis l'assistant de ${name}. Où souhaitez-vous aller ? Donnez-moi votre adresse de depart et destination.`,
    braiseuse_poisson: `Bienvenue a la Braiseuse de Poisson ${name} ! Poisson braise, alloco, plantain, macho... Que desirez-vous commander aujourd'hui ?`,
    default: `Bienvenue ! Je suis l'assistant virtuel de ${name}. Comment puis-je vous aider ?`,
  };
  return welcomes[bType] || welcomes.default;
}

function getDefaultServices(bType: string) {
  const services: Record<string, Array<{ name: string; description: string; price: number; duration?: number }>> = {
    restaurant: [
      { name: "Plat du jour", description: "Le plat du jour prepare par notre chef", price: 2500 },
      { name: "Poisson braise complet", description: "Poisson braise avec alloco et crudit", price: 3500 },
      { name: "Poulet braise", description: "Poulet braise avec accompagnement", price: 3000 },
      { name: "Boisson", description: "Jus naturel, bissap, ginger", price: 500 },
    ],
    salon_coiffure: [
      { name: "Coupe homme", description: "Coupe et coiffure pour homme", price: 1500, duration: 30 },
      { name: "Tresses", description: "Tresses classiques ou modernes", price: 5000, duration: 120 },
      { name: "Meches", description: "Pose de meches", price: 8000, duration: 180 },
      { name: "Barbe", description: "Taille et entretien de barbe", price: 1000, duration: 20 },
    ],
    pharmacie: [
      { name: "Consultation pharmacien", description: "Conseil personnalise avec notre pharmacien", price: 0 },
      { name: "Livraison medicaments", description: "Livraison a domicile de vos medicaments", price: 1000 },
    ],
    taxi: [
      { name: "Course intra-ville", description: "Trajet en ville", price: 1500 },
      { name: "Course inter-quartier", description: "Trajet entre quartiers", price: 2000 },
      { name: "Course aeroport", description: "Trajet vers l'aeroport", price: 5000 },
    ],
    braiseuse_poisson: [
      { name: "Poisson braise (entier)", description: "Poisson braise entier avec alloco et crudit", price: 3500 },
      { name: "Poisson braise (demi)", description: "Demi poisson braise avec alloco", price: 2000 },
      { name: "Macho grille", description: "Macho (poisson-chat) grille", price: 2500 },
      { name: "Alloco", description: "Plantain frit bien dore", price: 500 },
      { name: "Plantain bouilli", description: "Plantain bouilli classique", price: 300 },
      { name: "Sauce piquante", description: "Sauce pimentee maison", price: 200 },
      { name: "Crudit", description: "Salade de legumes frais", price: 300 },
      { name: "Jus naturel", description: "Jus de gingembre, bissap ou ananas", price: 500 },
    ],
    default: [
      { name: "Service de base", description: "Service principal", price: 1000 },
      { name: "Service premium", description: "Service premium", price: 2500 },
    ],
  };
  return services[bType] || services.default;
}
