// ─────────────────────────────────────────────────────────────
// ChatCommerce CRM Africa — AI Bot Engine for Telegram Agents
// Provider-agnostic AI response generation
// ─────────────────────────────────────────────────────────────

export interface AIBotConfig {
  enabled: boolean;
  provider: "openai" | "anthropic" | "custom";
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  /** Custom base URL (for self-hosted LLMs) */
  baseUrl?: string;
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
 * Call an OpenAI-compatible API to generate a response.
 * Works with OpenAI, Anthropic (via proxy), or any self-hosted LLM
 * that implements the OpenAI chat completions API.
 */
export async function generateAIResponse(
  message: string,
  config: AIBotConfig,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string | null> {
  if (!config.enabled || !config.apiKey) {
    return null;
  }

  try {
    const messages: Array<{ role: string; content: string }> = [];

    // Add system prompt
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

    // Determine API endpoint
    const baseUrl =
      config.baseUrl?.replace(/\/+$/, "") ||
      (config.provider === "anthropic"
        ? "https://api.anthropic.com/v1"
        : "https://api.openai.com/v1");

    const endpoint = `${baseUrl}/chat/completions`;

    // Build request
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...(config.provider === "anthropic"
          ? { "anthropic-version": "2023-06-01" }
          : {}),
      },
      body: JSON.stringify({
        model: config.model || "gpt-3.5-turbo",
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
    provider: overrides.provider ?? "openai",
    apiKey: overrides.apiKey || "",
    model: overrides.model || "gpt-3.5-turbo",
    systemPrompt,
    temperature: overrides.temperature ?? 0.7,
    maxTokens: overrides.maxTokens ?? 500,
    baseUrl: overrides.baseUrl,
  };
}
