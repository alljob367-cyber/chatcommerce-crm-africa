import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";
import { generateSpeech, generateSpeechWithWebhook, generateImageWithWebhook, type ElevenLabsConfig } from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── POST: Generate TTS or Image via ElevenLabs ───────────────

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_API_KEY) {
      return NextResponse.json({ error: "ElevenLabs API key non configuree" }, { status: 400 });
    }

    const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
    const body = await request.json();
    const { type, text, voiceId, webhookMode } = body;

    if (!type || !text) {
      return NextResponse.json({ error: "Type et texte requis" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";

    // ─── Direct TTS (returns audio as base64) ──────────────────
    if (type === "tts" && !webhookMode) {
      const buffer = await generateSpeech(config, text, { voiceId });
      const base64 = buffer.toString("base64");
      return NextResponse.json({
        success: true,
        audio: `data:audio/mpeg;base64,${base64}`,
        format: "mp3",
      });
    }

    // ─── TTS with Webhook (async) ──────────────────────────────
    if (type === "tts" && webhookMode) {
      const webhookUrl = `${baseUrl}/api/elevenlabs/webhook`;
      const gen = await generateSpeechWithWebhook(config, text, webhookUrl, {
        voiceId,
        metadata: body.metadata || {},
      });
      return NextResponse.json({
        success: true,
        message: "Generation vocale en cours. Resultat envoye au webhook.",
        generationId: gen.generationId,
      });
    }

    // ─── Image Generation with Webhook ────────────────────────
    if (type === "image") {
      const webhookUrl = `${baseUrl}/api/elevenlabs/webhook`;
      const gen = await generateImageWithWebhook(config, text, webhookUrl, {
        metadata: body.metadata || {},
      });
      return NextResponse.json({
        success: true,
        message: "Generation d'image en cours. Resultat envoye au webhook.",
        generationId: gen.generationId,
      });
    }

    return NextResponse.json({ error: `Type non supporte: ${type}` }, { status: 400 });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/generate] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
