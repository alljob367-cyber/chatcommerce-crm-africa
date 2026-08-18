import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { listVoices, getPlatformConfig, isPlatformKeyConfigured } from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: List available ElevenLabs voices ──────────────────────

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    if (!isPlatformKeyConfigured()) {
      return NextResponse.json({ voices: [], platformReady: false });
    }

    const config = getPlatformConfig();
    const voices = await listVoices(config);

    // Filter to French/multilingual voices
    const relevant = voices.filter(
      (v) =>
        (v.labels as Record<string, string>)?.accent === "french" ||
        (v.labels as Record<string, string>)?.language?.includes("french") ||
        (v.labels as Record<string, string>)?.use_case === "conversational" ||
        v.category === "cloned" ||
        v.category === "premade"
    );

    return NextResponse.json({ voices: relevant.length > 0 ? relevant : voices });
  } catch (error) {
    console.error("[API /elevenlabs/voices] Error:", error);
    return NextResponse.json({ error: "Erreur de connexion ElevenLabs" }, { status: 500 });
  }
}
