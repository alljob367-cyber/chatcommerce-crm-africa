// ─────────────────────────────────────────────────────────────
// ChatCommerce CRM Africa — ElevenLabs API Client
// TTS, Image Generation, Conversational AI Agents
// ─────────────────────────────────────────────────────────────

const ELEVEN_API_BASE = "https://api.elevenlabs.io/v1";

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId?: string;
  webhookUrl?: string;
}

// ═══════════════════════════════════════════════════════════
// CONVERSATIONAL AI AGENTS — ElevenLabs CBT
// ═══════════════════════════════════════════════════════════

export interface ElevenAgentCreateParams {
  name: string;
 prompt?: string;
 firstMessage?: string;
 voiceId?: string;
 language?: string;
 model?: string;
 temperature?: number;
 webhookUrl?: string;
 webhookSecret?: string;
}

export interface ElevenAgentResponse {
  agent_id: string;
  name: string;
  first_message: string;
  prompt: string;
  voice_id: string;
  language: string;
  model: string;
  temperature: number;
  created_at: string;
  updated_at: string;
  webhook?: {
    url: string;
    headers?: Record<string, string>;
    events?: string[];
  };
  agent_type?: string;
}

// ─── List all Conversational AI Agents ─────────────────────

export async function listAgents(config: ElevenLabsConfig): Promise<ElevenAgentResponse[]> {
  const res = await fetch(`${ELEVEN_API_BASE}/conversational_ai/agents`, {
    headers: { "xi-api-key": config.apiKey },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs list agents error: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.agents || [];
}

// ─── Get a single Agent by ID ───────────────────────────────

export async function getAgent(config: ElevenLabsConfig, agentId: string): Promise<ElevenAgentResponse> {
  const res = await fetch(`${ELEVEN_API_BASE}/conversational_ai/agents/${agentId}`, {
    headers: { "xi-api-key": config.apiKey },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs get agent error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── Create a new Conversational AI Agent ───────────────────

export async function createAgent(config: ElevenLabsConfig, params: ElevenAgentCreateParams): Promise<ElevenAgentResponse> {
  const body: Record<string, unknown> = {
    agent_name: params.name,
    first_message: params.firstMessage || "Bonjour ! Comment puis-je vous aider ?",
    prompt: params.prompt || "Tu es un assistant serviable pour une entreprise.",
    language: params.language || "fr",
    model: params.model || "eleven_multilingual_v2",
    temperature: params.temperature || 0.5,
  };

  if (params.voiceId) body.voice_id = params.voiceId;
  if (params.webhookUrl) {
    body.webhook = {
      url: params.webhookUrl,
      headers: { "Content-Type": "application/json" },
      events: ["conversation.created", "conversation.message.created", "conversation.ended"],
    };
  }
  if (params.webhookSecret) body.webhook_secret = params.webhookSecret;

  const res = await fetch(`${ELEVEN_API_BASE}/conversational_ai/agents`, {
    method: "POST",
    headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs create agent error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── Update an existing Agent ───────────────────────────────

export async function updateAgent(config: ElevenLabsConfig, agentId: string, params: Partial<ElevenAgentCreateParams>): Promise<ElevenAgentResponse> {
  const body: Record<string, unknown> = {};
  if (params.name !== undefined) body.agent_name = params.name;
  if (params.prompt !== undefined) body.prompt = params.prompt;
  if (params.firstMessage !== undefined) body.first_message = params.firstMessage;
  if (params.voiceId !== undefined) body.voice_id = params.voiceId;
  if (params.language !== undefined) body.language = params.language;
  if (params.model !== undefined) body.model = params.model;
  if (params.temperature !== undefined) body.temperature = params.temperature;

  if (params.webhookUrl) {
    body.webhook = {
      url: params.webhookUrl,
      headers: { "Content-Type": "application/json" },
      events: ["conversation.created", "conversation.message.created", "conversation.ended"],
    };
  }
  if (params.webhookSecret !== undefined) body.webhook_secret = params.webhookSecret;

  const res = await fetch(`${ELEVEN_API_BASE}/conversational_ai/agents/${agentId}`, {
    method: "PATCH",
    headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs update agent error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ─── Delete an Agent ────────────────────────────────────────

export async function deleteAgent(config: ElevenLabsConfig, agentId: string): Promise<void> {
  const res = await fetch(`${ELEVEN_API_BASE}/conversational_ai/agents/${agentId}`, {
    method: "DELETE",
    headers: { "xi-api-key": config.apiKey },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs delete agent error: ${JSON.stringify(err)}`);
  }
}

// ─── Send a message to an Agent (chat) ──────────────────────

export async function chatWithAgent(
  config: ElevenLabsConfig,
  agentId: string,
  message: string,
  conversationId?: string
): Promise<{ text: string; audioUrl?: string; conversationId: string }> {
  const body: Record<string, unknown> = {
    text: message,
    agent_id: agentId,
  };
  if (conversationId) body.conversation_id = conversationId;

  const res = await fetch(`${ELEVEN_API_BASE}/conversational_ai/agent/${agentId}/chat`, {
    method: "POST",
    headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs chat error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    text: data.text || "",
    audioUrl: data.audio_url || undefined,
    conversationId: data.conversation_id || conversationId || "",
  };
}

// ═══════════════════════════════════════════════════════════
// TEXT-TO-SPEECH
// ═══════════════════════════════════════════════════════════

// ─── TTS direct — returns audio buffer ─────────────────────

export async function generateSpeech(
  config: ElevenLabsConfig,
  text: string,
  options?: { voiceId?: string; modelId?: string }
): Promise<Buffer> {
  const voiceId = options?.voiceId || config.defaultVoiceId || "21m00Tcm4TlvDq8ikWAM";
  const modelId = options?.modelId || "eleven_multilingual_v2";

  const res = await fetch(`${ELEVEN_API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs TTS error: ${JSON.stringify(err)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── TTS with Webhook (async) ───────────────────────────────

export async function generateSpeechWithWebhook(
  config: ElevenLabsConfig,
  text: string,
  webhookUrl: string,
  options?: { voiceId?: string; modelId?: string; metadata?: Record<string, string> }
): Promise<{ generationId: string }> {
  const voiceId = options?.voiceId || config.defaultVoiceId || "21m00Tcm4TlvDq8ikWAM";
  const modelId = options?.modelId || "eleven_multilingual_v2";

  const body: Record<string, unknown> = {
    text,
    model_id: modelId,
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    webhook_url: webhookUrl,
    webhook_headers: { "Content-Type": "application/json" },
  };

  if (options?.metadata) body.user_metadata = options.metadata;

  const res = await fetch(`${ELEVEN_API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs TTS webhook error: ${JSON.stringify(err)}`);
  }

  const data = await res.json().catch(() => ({}));
  return { generationId: String((data as Record<string, unknown>).generation_id || Date.now()) };
}

// ═══════════════════════════════════════════════════════════
// IMAGE GENERATION
// ═══════════════════════════════════════════════════════════

export async function generateImageWithWebhook(
  config: ElevenLabsConfig,
  prompt: string,
  webhookUrl: string,
  options?: { metadata?: Record<string, string> }
): Promise<{ generationId: string }> {
  const body: Record<string, unknown> = {
    prompt,
    webhook_url: webhookUrl,
    webhook_headers: { "Content-Type": "application/json" },
  };

  if (options?.metadata) body.user_metadata = options.metadata;

  const res = await fetch(`${ELEVEN_API_BASE}/images/generations`, {
    method: "POST",
    headers: { "xi-api-key": config.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs Image error: ${JSON.stringify(err)}`);
  }

  const data = await res.json().catch(() => ({}));
  return { generationId: String((data as Record<string, unknown>).generation_id || Date.now()) };
}

// ═══════════════════════════════════════════════════════════
// VOICES
// ═══════════════════════════════════════════════════════════

export async function listVoices(config: ElevenLabsConfig) {
  const res = await fetch(`${ELEVEN_API_BASE}/voices`, {
    headers: { "xi-api-key": config.apiKey },
  });
  if (!res.ok) throw new Error(`ElevenLabs voices error: ${res.statusText}`);
  const data = await res.json();
  return (data.voices || []).map((v: Record<string, unknown>) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels || [],
  }));
}

// ═══════════════════════════════════════════════════════════
// WEBHOOK PARSING
// ═══════════════════════════════════════════════════════════

export interface ElevenLabsWebhookPayload {
  generation_id: string;
  status: string;
  audio_url?: string;
  image_url?: string;
  error?: string;
  user_metadata?: Record<string, string>;
}

export function parseElevenLabsWebhook(body: Record<string, unknown>): ElevenLabsWebhookPayload {
  return {
    generation_id: String(body.generation_id || ""),
    status: String(body.status || "unknown"),
    audio_url: body.audio_url ? String(body.audio_url) : undefined,
    image_url: body.image_url ? String(body.image_url) : undefined,
    error: body.error ? String(body.error) : undefined,
    user_metadata: body.user_metadata as Record<string, string> | undefined,
  };
}

// ─── Conversational AI Webhook Event ────────────────────────

export interface ElevenLabsConversationEvent {
  event_type: string;
  agent_id: string;
  conversation_id: string;
  message_id?: string;
  content?: string;
  role?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export function parseConversationWebhook(body: Record<string, unknown>): ElevenLabsConversationEvent {
  return {
    event_type: String(body.event_type || body.type || "unknown"),
    agent_id: String(body.agent_id || ""),
    conversation_id: String(body.conversation_id || ""),
    message_id: body.message_id ? String(body.message_id) : undefined,
    content: body.content ? String(body.content) : undefined,
    role: body.role ? String(body.role) : undefined,
    timestamp: body.timestamp ? String(body.timestamp) : undefined,
    metadata: body.metadata as Record<string, unknown> | undefined,
  };
}
