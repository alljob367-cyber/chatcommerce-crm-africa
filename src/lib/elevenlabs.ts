// ─────────────────────────────────────────────────────────────
// ChatCommerce CRM Africa — ElevenLabs API Client
// TTS (Text-to-Speech), Image Generation, Conversational AI
// ─────────────────────────────────────────────────────────────

const ELEVEN_API_BASE = "https://api.elevenlabs.io/v1";

export interface ElevenLabsConfig {
  apiKey: string;
  defaultVoiceId?: string;
  webhookUrl?: string;
}

// ─── Text-to-Speech (TTS) — returns audio buffer ───────────────

export async function generateSpeech(
  config: ElevenLabsConfig,
  text: string,
  options?: { voiceId?: string; modelId?: string }
): Promise<Buffer> {
  const voiceId = options?.voiceId || config.defaultVoiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel (default)
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
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs TTS error: ${JSON.stringify(err)}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── TTS with Webhook (async) — ElevenLabs sends result to our URL ──

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
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75,
    },
    webhook_url: webhookUrl,
    webhook_headers: { "Content-Type": "application/json" },
  };

  // Attach metadata for tracking (e.g., WhatsApp phone number, campaign ID)
  if (options?.metadata) {
    body.user_metadata = options.metadata;
  }

  const res = await fetch(`${ELEVEN_API_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs TTS webhook error: ${JSON.stringify(err)}`);
  }

  // The response should contain a generation_id
  const data = await res.json().catch(() => ({}));
  return { generationId: String((data as Record<string, unknown>).generation_id || Date.now()) };
}

// ─── Image Generation with Webhook ──────────────────────────────

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

  if (options?.metadata) {
    body.user_metadata = options.metadata;
  }

  const res = await fetch(`${ELEVEN_API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs Image error: ${JSON.stringify(err)}`);
  }

  const data = await res.json().catch(() => ({}));
  return { generationId: String((data as Record<string, unknown>).generation_id || Date.now()) };
}

// ─── List Available Voices ─────────────────────────────────────

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

// ─── Upload audio buffer to temporary storage (for WhatsApp) ────
// Returns a public URL that WhatsApp can download

export async function uploadAudioToStorage(
  audioBuffer: Buffer,
  filename: string
): Promise<string> {
  // For serverless environments, we encode to base64 data URI
  // In production, upload to S3/Vercel Blob/R2
  const base64 = audioBuffer.toString("base64");
  return `data:audio/mpeg;base64,${base64}`;
}

// ─── Parse ElevenLabs webhook callback ───────────────────────────

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

// ─── Conversational AI (ElevenLabs CBT) ─────────────────────────

export async function conversationalResponse(
  config: ElevenLabsConfig,
  agentId: string,
  message: string,
  conversationId?: string
): Promise<{ text: string; audioUrl?: string; conversationId: string }> {
  const body: Record<string, unknown> = {
    text: message,
    agent_id: agentId,
  };
  if (conversationId) {
    body.conversation_id = conversationId;
  }

  const res = await fetch(`${ELEVEN_API_BASE}/conversational_ai/agent/${agentId}/chat`, {
    method: "POST",
    headers: {
      "xi-api-key": config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(`ElevenLabs CBT error: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    text: data.text || "",
    audioUrl: data.audio_url || undefined,
    conversationId: data.conversation_id || conversationId || "",
  };
}
