import { NextResponse } from "next/server";
import { db, ensureBootstrapped, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";
import {
  sendTextMessage,
  sendVoiceMessage,
  sendImageMessage,
  sendTemplateMessage,
  type WhatsAppConfig,
} from "@/lib/whatsapp";
import {
  generateSpeechWithWebhook,
  generateImageWithWebhook,
  type ElevenLabsConfig,
} from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Check WhatsApp configuration status ───────────────────

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    await ensureBootstrapped();
    const companyId = await resolveCompanyId(session);

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { whatsappToken: true, whatsappPhoneId: true, whatsappNumber: true },
    });

    return NextResponse.json({
      configured: !!(company?.whatsappToken && company?.whatsappPhoneId),
      phoneNumber: company?.whatsappNumber || null,
      phoneId: company?.whatsappPhoneId ? "***" + company.whatsappPhoneId.slice(-4) : null,
      hasToken: !!company?.whatsappToken,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Send WhatsApp message ────────────────────────────────
// Supports: text, voice (via ElevenLabs TTS), image (via ElevenLabs)

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    await ensureBootstrapped();
    const companyId = await resolveCompanyId(session);

    const body = await request.json();
    const { to, type, text, imageUrl, caption, templateName, templateParams } = body;

    if (!to || !type) {
      return NextResponse.json({ error: "Numero destinataire et type requis" }, { status: 400 });
    }

    // Get WhatsApp config
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { whatsappToken: true, whatsappPhoneId: true, name: true },
    });

    if (!company?.whatsappToken || !company?.whatsappPhoneId) {
      return NextResponse.json({ error: "WhatsApp non configure. Allez dans Parametres > WhatsApp." }, { status: 400 });
    }

    const waConfig: WhatsAppConfig = {
      accessToken: company.whatsappToken,
      phoneId: company.whatsappPhoneId,
    };

    // ─── Text message ───────────────────────────────────────────
    if (type === "text") {
      if (!text) return NextResponse.json({ error: "Texte requis" }, { status: 400 });
      const result = await sendTextMessage(waConfig, sanitize(to), sanitize(text));
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
      return NextResponse.json({ success: true, messageId: result.messageId });
    }

    // ─── Voice message (ElevenLabs TTS → WhatsApp) ─────────────
    if (type === "voice") {
      if (!text) return NextResponse.json({ error: "Texte requis pour generer le voice" }, { status: 400 });
      const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVEN_API_KEY) {
        return NextResponse.json({ error: "ElevenLabs API key non configuree (ELEVENLABS_API_KEY)" }, { status: 400 });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
      const webhookUrl = `${baseUrl}/api/elevenlabs/webhook?send_to_wa=1&wa_phone=${encodeURIComponent(to)}&company_id=${companyId}`;

      const elevenConfig: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
      const gen = await generateSpeechWithWebhook(elevenConfig, sanitize(text), webhookUrl, {
        metadata: { wa_phone: to, company_id: companyId, type: "voice_campaign" },
      });

      return NextResponse.json({
        success: true,
        message: "Generation vocale ElevenLabs en cours. Le voice sera envoye automatiquement via WhatsApp.",
        generationId: gen.generationId,
      });
    }

    // ─── Image message (ElevenLabs → WhatsApp) ─────────────────
    if (type === "image") {
      if (!imageUrl) {
        // Generate image via ElevenLabs if no URL provided
        const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
        if (!ELEVEN_API_KEY || !text) {
          return NextResponse.json({ error: "Image URL requise ou ElevenLabs API key + prompt" }, { status: 400 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";
        const webhookUrl = `${baseUrl}/api/elevenlabs/webhook?send_to_wa=1&wa_phone=${encodeURIComponent(to)}&company_id=${companyId}`;

        const elevenConfig: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
        const gen = await generateImageWithWebhook(elevenConfig, sanitize(text), webhookUrl, {
          metadata: { wa_phone: to, company_id: companyId, caption: caption || "" },
        });

        return NextResponse.json({
          success: true,
          message: "Generation d\'image ElevenLabs en cours. L\'image sera envoyee automatiquement via WhatsApp.",
          generationId: gen.generationId,
        });
      }

      // Direct image URL
      const result = await sendImageMessage(waConfig, sanitize(to), imageUrl, caption);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
      return NextResponse.json({ success: true, messageId: result.messageId });
    }

    // ─── Template message ───────────────────────────────────────
    if (type === "template") {
      if (!templateName) return NextResponse.json({ error: "Nom du template requis" }, { status: 400 });
      const result = await sendTemplateMessage(waConfig, sanitize(to), templateName, templateParams);
      if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
      return NextResponse.json({ success: true, messageId: result.messageId });
    }

    return NextResponse.json({ error: `Type de message non supporte: ${type}` }, { status: 400 });
  } catch (error: unknown) {
    console.error("[API /whatsapp/send] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
