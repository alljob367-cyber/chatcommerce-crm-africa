import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyWhatsAppWebhook,
  parseIncomingMessage,
  sendTextMessage,
  type WhatsAppConfig,
} from "@/lib/whatsapp";
import { generateSpeech, type ElevenLabsConfig } from "@/lib/elevenlabs";

// ─── GET: Meta Webhook Verification ──────────────────────────────
// Called by Meta when setting up the webhook in WhatsApp Manager

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode") || "";
  const token = req.nextUrl.searchParams.get("hub.verify_token") || "";
  const challenge = req.nextUrl.searchParams.get("hub.challenge") || "";

  // Find company by WhatsApp verify token (stored in notificationSettings)
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "chatcommerce-wa-verify-2024";

  if (verifyWhatsAppWebhook(mode, token, verifyToken)) {
    console.log("[WhatsApp Webhook] Verification successful");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[WhatsApp Webhook] Verification failed - token mismatch");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ─── POST: Receive incoming WhatsApp messages ────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("[WhatsApp Webhook] Received update");

    // Parse the incoming message
    const message = parseIncomingMessage(body);
    if (!message) {
      // Status update or empty payload — acknowledge anyway
      return NextResponse.json({ ok: true });
    }

    console.log(`[WhatsApp Webhook] Message from ${message.from}: [${message.type}] ${message.text?.substring(0, 50)}`);

    // Find company by phone ID or first company with WhatsApp configured
    // In production, you'd match the phone number to the company
    const company = await db.company.findFirst({
      where: {
        whatsappToken: { not: "" },
        whatsappPhoneId: { not: "" },
      },
      select: {
        id: true,
        whatsappToken: true,
        whatsappPhoneId: true,
        notificationSettings: true,
      },
    });

    if (!company?.whatsappToken || !company?.whatsappPhoneId) {
      console.error("[WhatsApp Webhook] No company with WhatsApp configured");
      return NextResponse.json({ ok: true });
    }

    const waConfig: WhatsAppConfig = {
      accessToken: company.whatsappToken,
      phoneId: company.whatsappPhoneId,
    };

    // Check if ElevenLabs AI is configured for auto-responses
    let elevenConfig: ElevenLabsConfig | null = null;
    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (ELEVEN_API_KEY) {
      elevenConfig = { apiKey: ELEVEN_API_KEY };
    }

    // ─── Auto-response logic ─────────────────────────────────────

    if (message.type === "text" && message.text) {
      const lowerText = message.text.toLowerCase();

      // Greeting handling
      const greetings = ["bonjour", "bonsoir", "salut", "hello", "hi", "yo", "wesh"];
      const isGreeting = greetings.some((g) => lowerText.includes(g));

      if (isGreeting) {
        const greetingText = `Bonjour ${message.contactName || ""} ! Bienvenue. Comment puis-je vous aider ? Tapez /menu pour voir nos services ou /aide pour l\'aide.`;
        await sendTextMessage(waConfig, message.from, greetingText);
        return NextResponse.json({ ok: true });
      }

      // If ElevenLabs AI is enabled, generate TTS response
      if (elevenConfig) {
        try {
          // Generate TTS audio from AI response
          const responseText = `Merci pour votre message. Notre equipe va vous repondre tres rapidement. Vous pouvez aussi taper /menu pour voir nos services.`;
          const audioBuffer = await generateSpeech(elevenConfig, responseText, {
            voiceId: "21m00Tcm4TlvDq8ikWAM",
          });

          // For WhatsApp, we need a public URL — upload to a temp storage
          // In production, use Vercel Blob or S3. For now, send text + TTS info.
          // The webhook-based flow handles async TTS → WhatsApp delivery.
          await sendTextMessage(waConfig, message.from, responseText);
          console.log("[WhatsApp Webhook] Sent text response (TTS generated)");
          return NextResponse.json({ ok: true });
        } catch (aiError) {
          console.error("[WhatsApp Webhook] ElevenLabs error, falling back to text:", aiError);
        }
      }

      // Default text response
      const defaultResponse = `Merci pour votre message ! Notre equipe vous repondra bientot. En attendant, vous pouvez:\n\n- Taper /menu pour voir nos services\n- Taper /contact pour nos coordonnees\n- Taper /aide pour l\'aide`;
      await sendTextMessage(waConfig, message.from, defaultResponse);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    return NextResponse.json({ ok: true }); // Always 200 for Meta
  }
}
