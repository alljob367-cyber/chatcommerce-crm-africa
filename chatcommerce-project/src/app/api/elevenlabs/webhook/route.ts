import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendVoiceMessage, sendImageMessage, sendTextMessage, type WhatsAppConfig } from "@/lib/whatsapp";
import { parseElevenLabsWebhook, type ElevenLabsWebhookPayload } from "@/lib/elevenlabs";

// ─── ElevenLabs Webhook Handler ─────────────────────────────
// ElevenLabs calls this when TTS/Image generation is complete.
// If ?send_to_wa=1, we automatically forward the content via WhatsApp.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = new URL(req.url);

    // Parse ElevenLabs payload
    const payload = parseElevenLabsWebhook(body);
    console.log(`[ElevenLabs Webhook] Generation ${payload.generation_id} — status: ${payload.status}`);

    if (payload.status === "error") {
      console.error("[ElevenLabs Webhook] Generation failed:", payload.error);
      return NextResponse.json({ ok: true });
    }

    // ─── Check if auto-send to WhatsApp is requested ────────────
    const sendToWa = url.searchParams.get("send_to_wa") === "1";
    const waPhone = url.searchParams.get("wa_phone");
    const companyId = url.searchParams.get("company_id");
    const metadata = payload.user_metadata || {};

    if (sendToWa && waPhone) {
      const targetPhone = metadata.wa_phone || waPhone;
      const targetCompanyId = metadata.company_id || companyId;

      if (!targetCompanyId) {
        console.error("[ElevenLabs Webhook] No company ID for WhatsApp send");
        return NextResponse.json({ ok: true });
      }

      // Get WhatsApp config
      const company = await db.company.findUnique({
        where: { id: targetCompanyId },
        select: { whatsappToken: true, whatsappPhoneId: true, name: true },
      });

      if (!company?.whatsappToken || !company?.whatsappPhoneId) {
        console.error("[ElevenLabs Webhook] WhatsApp not configured for company");
        return NextResponse.json({ ok: true });
      }

      const waConfig: WhatsAppConfig = {
        accessToken: company.whatsappToken,
        phoneId: company.whatsappPhoneId,
      };

      // ─── Send audio via WhatsApp ─────────────────────────────
      if (payload.audio_url) {
        console.log(`[ElevenLabs Webhook] Sending voice to ${targetPhone}`);
        const result = await sendVoiceMessage(waConfig, targetPhone, payload.audio_url);
        console.log(`[ElevenLabs Webhook] Voice send: ${result.success ? "OK" : result.error}`);
      }

      // ─── Send image via WhatsApp ─────────────────────────────
      if (payload.image_url) {
        const caption = metadata.caption ? String(metadata.caption) : undefined;
        console.log(`[ElevenLabs Webhook] Sending image to ${targetPhone}`);
        const result = await sendImageMessage(waConfig, targetPhone, payload.image_url, caption);
        console.log(`[ElevenLabs Webhook] Image send: ${result.success ? "OK" : result.error}`);
      }

      // ─── Fallback: if no media URL but text, send as text ────
      if (!payload.audio_url && !payload.image_url) {
        console.log(`[ElevenLabs Webhook] No media URL, sending text confirmation`);
        await sendTextMessage(
          waConfig,
          targetPhone,
          `Votre message est en cours de preparation. Nous vous l'envoyerons tres prochainement. Merci de votre patience !`
        );
      }
    }

    // ─── Log the generation for tracking ────────────────────────
    console.log(`[ElevenLabs Webhook] Processed: ${payload.generation_id} | audio: ${!!payload.audio_url} | image: ${!!payload.image_url}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ElevenLabs Webhook] Error:", error);
    return NextResponse.json({ ok: true });
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({ status: "ElevenLabs webhook endpoint is active" });
}