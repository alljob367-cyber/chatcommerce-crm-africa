// ─────────────────────────────────────────────────────────────
// ChatCommerce CRM Africa — AI Bot Engine for Telegram Agents
// Provider-agnostic AI response generation
// ─────────────────────────────────────────────────────────────

export interface AIBotConfig {
  enabled: boolean;
  provider: "openai" | "anthropic" | "openrouter" | "custom";
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  /** Custom base URL (for self-hosted LLMs) */
  baseUrl?: string;
  /** OpenRouter multimodal settings */
  multimodal?: {
    enabled: boolean;
    vision: boolean;   // Image understanding
    audio: boolean;    // Audio transcription
    imageGen: boolean; // Image generation
  };
}

/** System prompt template functions for each business type */
const BUSINESS_PROMPTS: Record<string, (name: string, services: string) => string> = {
  restaurant: (name, services) =>
    `Tu es un assistant virtuel pour le restaurant "${name}". ` +
    `Tu aides les clients à voir le menu, passer des commandes, et poser des questions sur les plats. ` +
    `Tu es poli, professionnel et concis. ` +
    `Tu parles principalement en français. ` +
    `Si le client demande un plat qui n'existe pas, propose une alternative. ` +
    `Voici les services/plats disponibles:\n${services}`,

  salon_coiffure: (name, services) =>
    `Tu es un assistant virtuel pour le salon de coiffure "${name}". ` +
    `Tu aides les clients à prendre rendez-vous, choisir une prestation et connaître les tarifs. ` +
    `Tu es poli, professionnel et concis. ` +
    `Tu parles principalement en français. ` +
    `Voici les prestations disponibles:\n${services}`,

  pharmacie: (name, services) =>
    `Tu es un assistant virtuel pour la pharmacie "${name}". ` +
    `Tu aides les clients avec des questions sur les médicaments et services disponibles. ` +
    `Tu n'es PAS médecin — pour des questions médicales sérieuses, recommande de consulter un professionnel. ` +
    `Tu parles principalement en français. ` +
    `Voici les services:\n${services}`,

  taxi: (name, services) =>
    `Tu es un assistant virtuel pour le service de transport "${name}". ` +
    `Tu aides les clients à réserver des courses et connaître les tarifs. ` +
    `Tu es poli et concis. Tu parles en français. ` +
    `Voici les services:\n${services}`,

  default: (name, services) =>
    `Tu es un assistant virtuel pour l'entreprise "${name}". ` +
    `Tu aides les clients avec leurs questions et réservations. ` +
    `Tu es poli, professionnel et concis. ` +
    `Tu parles principalement en français. ` +
    `Voici les services:\n${services}`,
};

/**
 * Generate a default system prompt based on business type.
 */
export function getDefaultSystemPrompt(
  businessType: string,
  companyName: string,
  services: string
): string {
  const generator =
    BUSINESS_PROMPTS[businessType] || BUSINESS_PROMPTS["default"];
  return generator(companyName, services);
}

/**
 * Build a structured context block from real business data to inject
 * into the AI system prompt. This prevents the AI from inventing prices,
 * products, availability, or business information.
 */
export function buildContextFromBusinessData(params: {
  services: Array<{ name: string; description: string | null; price: number; isActive: boolean }>;
  products: Array<{ name: string; price: number; stock: number; isActive: boolean; description: string | null }>;
  companyName: string;
  businessType: string;
  address?: string | null;
  phone?: string | null;
  openHours?: string | null;
  currency: string;
}): string {
  const { services, products, companyName, businessType, address, phone, openHours, currency } = params;

  let context = `═══ DONNÉES DE L'ENTREPRISE ═══\n`;
  context += `Entreprise: ${companyName}\n`;
  context += `Type: ${businessType}\n`;
  if (address) context += `Adresse: ${address}\n`;
  if (phone) context += `Téléphone: ${phone}\n`;
  if (openHours) {
    try {
      const parsed = JSON.parse(openHours) as Record<string, string>;
      const dayLabels: Record<string, string> = {
        mon: "Lundi", tue: "Mardi", wed: "Mercredi",
        thu: "Jeudi", fri: "Vendredi", sat: "Samedi", sun: "Dimanche",
      };
      const lines = Object.entries(parsed)
        .map(([day, hours]) => `${dayLabels[day] || day}: ${hours}`)
        .join("\n  ");
      context += `Horaires:\n  ${lines}\n`;
    } catch {
      // If not valid JSON, use raw string
      context += `Horaires: ${openHours}\n`;
    }
  }
  context += `\n`;

  if (services.length > 0) {
    const activeServices = services.filter((s) => s.isActive);
    if (activeServices.length > 0) {
      context += `═══ SERVICES / PRESTATIONS ═══\n`;
      for (const s of activeServices) {
        const formattedPrice = s.price.toLocaleString("fr-FR");
        context += `- ${s.name}: ${formattedPrice} ${currency}`;
        if (s.description) context += ` — ${s.description}`;
        context += `\n`;
      }
      context += `\n`;
    }
  }

  if (products.length > 0) {
    const activeProducts = products.filter((p) => p.isActive);
    if (activeProducts.length > 0) {
      context += `═══ PRODUITS ═══\n`;
      for (const p of activeProducts) {
        const formattedPrice = p.price.toLocaleString("fr-FR");
        const stockInfo = p.stock > 0 ? `✅ Disponible (${p.stock} en stock)` : `❌ Rupture de stock`;
        context += `- ${p.name}: ${formattedPrice} ${currency} [${stockInfo}]`;
        if (p.description) context += ` — ${p.description}`;
        context += `\n`;
      }
      context += `\n`;
    }
  }

  context += `═══ RÈGLES STRICTES ═══\n`;
  context += `1. NE JAMAIS inventer de prix — utilise UNIQUEMENT les prix ci-dessus\n`;
  context += `2. NE JAMAIS inventer de produits — propose uniquement ceux listés\n`;
  context += `3. NE JAMAIS inventer de disponibilité — vérifie le stock\n`;
  context += `4. Si le client demande quelque chose qui n'existe pas, propose l'alternative la plus proche\n`;
  context += `5. Les prix sont en ${currency}\n`;
  context += `6. Si on te demande des informations sur l'entreprise (adresse, horaires, téléphone), utilise UNIQUEMENT les données ci-dessus\n`;

  return context;
}

/**
 * Call an OpenAI-compatible API to generate a response.
 * Works with OpenAI, Anthropic (via proxy), or any self-hosted LLM
 * that implements the OpenAI chat completions API.
 */
export async function generateAIResponse(
  message: string,
  config: AIBotConfig,
  conversationHistory: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  businessContext?: string | null
): Promise<string | null> {
  if (!config.enabled || !config.apiKey) {
    return null;
  }

  try {
    type MessageContent = string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
    const messages: Array<{ role: string; content: MessageContent }> = [];

    // Build system prompt: business data context + configured prompt
    if (businessContext) {
      messages.push({ role: "system", content: businessContext });
    }
    if (config.systemPrompt) {
      messages.push({ role: "system", content: config.systemPrompt });
    }

    // Add conversation history (last 10 messages max for context window)
    const historySlice = conversationHistory.slice(-10);
    for (const msg of historySlice) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // Determine API endpoint based on provider
    let baseUrl = config.baseUrl?.replace(/\/+$/, "");

    if (!baseUrl) {
      switch (config.provider) {
        case "openrouter":
          baseUrl = "https://openrouter.ai/api/v1";
          break;
        case "anthropic":
          baseUrl = "https://api.anthropic.com/v1";
          break;
        default:
          baseUrl = "https://api.openai.com/v1";
      }
    }

    const endpoint = `${baseUrl}/chat/completions`;

    // Build headers per provider
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    };

    // OpenRouter: add optional HTTP-Referer and X-Title for better analytics
    if (config.provider === "openrouter") {
      headers["HTTP-Referer"] = "https://chatcommerce.africa";
      headers["X-Title"] = "ChatCommerce CRM Africa";
    }

    // Anthropic: requires anthropic-version header
    if (config.provider === "anthropic") {
      headers["anthropic-version"] = "2023-06-01";
    }

    // Default model per provider
    const defaultModel = config.provider === "openrouter"
      ? "google/gemini-2.0-flash-001"
      : config.provider === "anthropic"
        ? "claude-3-haiku-20240307"
        : "gpt-4o-mini";

    // Build request
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model || defaultModel,
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 500,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`[AI Engine] API error ${response.status}: ${errBody}`);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (error) {
    console.error("[AI Engine] Failed to generate response:", error);
    return null;
  }
}

interface SuggestableService {
  name: string;
  description?: string | null;
  price: number;
}

/**
 * Simple keyword matching + scoring to suggest the most relevant service
 * for a customer message. Used as fallback when no AI is configured.
 *
 * Returns the best match with a confidence score (0-1).
 */
export async function suggestService(
  customerMessage: string,
  services: SuggestableService[]
): Promise<{ service: SuggestableService | null; confidence: number }> {
  const normalized = customerMessage.toLowerCase().trim();

  if (!normalized || services.length === 0) {
    return { service: null, confidence: 0 };
  }

  let bestMatch: SuggestableService | null = null;
  let bestScore = 0;

  for (const svc of services) {
    const nameLower = (svc.name || "").toLowerCase();
    const descLower = (svc.description || "").toLowerCase();

    let score = 0;

    // Exact name match
    if (normalized.includes(nameLower)) {
      score += 0.6;
    }

    // Individual word matches from service name
    const nameWords = nameLower.split(/[\s,;-]+/);
    for (const word of nameWords) {
      if (word.length > 2 && normalized.includes(word)) {
        score += 0.15;
      }
    }

    // Description word matches
    const descWords = descLower.split(/[\s,;-]+/);
    for (const word of descWords) {
      if (word.length > 3 && normalized.includes(word)) {
        score += 0.05;
      }
    }

    // Common intent keywords
    const orderWords = [
      "commander", "commande", "vouloir", "prendre", "je voudrais",
      "donnez", "donne", "reserver", "réserver", "je veux", "j'aimerais",
      "avoir", "choisir", "besoin de",
    ];
    if (orderWords.some((w) => normalized.includes(w)) && nameLower && normalized.includes(nameLower)) {
      score += 0.2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = svc;
    }
  }

  // Only return if we have reasonable confidence
  if (bestScore >= 0.3 && bestMatch) {
    return {
      service: bestMatch,
      confidence: Math.min(bestScore, 1),
    };
  }

  return { service: null, confidence: 0 };
}

/**
 * Build a complete AIBotConfig from agent data + company settings.
 * Merges default values with overrides.
 */
export function buildAIBotConfig(agentData: {
  aiConfig?: string | null;
  businessType?: string;
  name?: string;
  services?: string;
}): AIBotConfig {
  // Parse AI config from JSON string
  let overrides: Partial<AIBotConfig> = {};
  if (agentData.aiConfig) {
    try {
      overrides = JSON.parse(agentData.aiConfig);
    } catch {
      // Ignore invalid JSON
    }
  }

  // Default system prompt if not overridden
  const systemPrompt =
    overrides.systemPrompt ||
    getDefaultSystemPrompt(
      agentData.businessType || "default",
      agentData.name || "Mon Entreprise",
      agentData.services || "Non configuré"
    );

  return {
    enabled: overrides.enabled ?? false,
    provider: overrides.provider ?? "openrouter",
    apiKey: overrides.apiKey || "",
    model: overrides.model || "google/gemini-2.0-flash-001",
    systemPrompt,
    temperature: overrides.temperature ?? 0.7,
    maxTokens: overrides.maxTokens ?? 500,
    baseUrl: overrides.baseUrl,
  };
}
