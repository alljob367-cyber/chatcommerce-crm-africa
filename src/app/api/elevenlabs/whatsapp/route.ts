import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";
import { listWhatsAppAccounts, sendWhatsAppMessage, type ElevenLabsConfig } from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// Helper to get platform ElevenLabs config
function getPlatformConfig(): ElevenLabsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}

// ─── GET: List WhatsApp accounts from ElevenLabs ─────────

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const config = getPlatformConfig();
    if (!config) {
      return NextResponse.json({
        error: "Service WhatsApp non disponible. Contactez l'administrateur plateforme.",
        accounts: [],
        platformReady: false,
      });
    }

    const accounts = await listWhatsAppAccounts(config);

    return NextResponse.json({
      accounts,
      platformReady: true,
      totalAccounts: accounts.length,
    });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/whatsapp GET] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Send outbound WhatsApp message or call ─────────

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const config = getPlatformConfig();
    if (!config) {
      return NextResponse.json({ error: "Service WhatsApp non disponible" }, { status: 400 });
    }

    const body = await request.json();
    const { action, accountId, to, templateName, parameters, dynamicVariables } = body;

    if (!accountId) {
      return NextResponse.json({ error: "accountId requis" }, { status: 400 });
    }

    // ─── Action: send_message ───────────────────────────────
    if (action === "send_message") {
      if (!to || !templateName) {
        return NextResponse.json({ error: "'to' et 'templateName' requis pour envoyer un message" }, { status: 400 });
      }

      const result = await sendWhatsAppMessage(config, accountId, {
        to,
        templateName,
        parameters,
      });

      return NextResponse.json({ ok: true, ...result });
    }

    // ─── Action: make_call ──────────────────────────────────
    if (action === "make_call") {
      if (!to) {
        return NextResponse.json({ error: "'to' requis pour passer un appel" }, { status: 400 });
      }

      const { callWhatsApp } = await import("@/lib/elevenlabs");
      const result = await callWhatsApp(config, accountId, {
        to,
        dynamicVariables,
      });

      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Action non reconnue. Utilisez 'send_message' ou 'make_call'." }, { status: 400 });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/whatsapp POST] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
