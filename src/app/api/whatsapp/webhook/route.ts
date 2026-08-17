import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyWhatsAppWebhook,
  parseIncomingMessage,
  sendTextMessage,
  type WhatsAppConfig,
} from "@/lib/whatsapp";

// GET: Meta Webhook Verification
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode") || "";
  const token = req.nextUrl.searchParams.get("hub.verify_token") || "";
  const challenge = req.nextUrl.searchParams.get("hub.challenge") || "";
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "chatcommerce-wa-verify-2024";
  if (verifyWhatsAppWebhook(mode, token, verifyToken)) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Incoming WhatsApp messages - Multi-Agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = parseIncomingMessage(body);
    if (!message) return NextResponse.json({ ok: true });

    console.log(`[WA Webhook] From ${message.from}: [${message.type}] ${message.text?.substring(0, 80)}`);

    // Find the WhatsApp agent by phone number (the "to" field = agent's number)
    // In Meta's webhook, the phone number that received the message is in body.entry[].changes[].value.metadata.phone_number_id
    const phoneId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const senderPhone = message.from;
    const contactName = message.contactName || senderPhone;

    // Try to find a WhatsAppAgent by phoneId
    let agent: any = null;
    if (phoneId) {
      agent = await db.whatsAppAgent.findFirst({
        where: { phoneId, isActive: true },
        include: { services: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      });
    }

    // Fallback: find agent by matching the received phone number
    if (!agent && body?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number) {
      const displayPhone = body.entry[0].changes[0].value.metadata.display_phone_number;
      agent = await db.whatsAppAgent.findFirst({
        where: { phoneNumber: displayPhone, isActive: true },
        include: { services: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } },
      });
    }

    // Build WhatsApp config from agent
    let waConfig: WhatsAppConfig | null = null;
    if (agent?.accessToken && agent?.phoneId) {
      waConfig = { accessToken: agent.accessToken, phoneId: agent.phoneId };
    } else {
      // Fallback to company-level config
      const company = await db.company.findFirst({
        where: { whatsappToken: { not: "" }, whatsappPhoneId: { not: "" } },
      });
      if (company?.whatsappToken && company?.whatsappPhoneId) {
        waConfig = { accessToken: company.whatsappToken, phoneId: company.whatsappPhoneId };
      }
    }

    if (!waConfig) {
      console.error("[WA Webhook] No WhatsApp config found");
      return NextResponse.json({ ok: true });
    }

    // Only process text messages for now
    if (message.type === "text" && message.text) {
      const lowerText = message.text.toLowerCase().trim();

      // ── /start ──
      if (lowerText === "/start") {
        const welcome = agent?.welcomeMessage || `Bienvenue chez ${agent?.name || "nous"} ! 🎉\n\nComment puis-je vous aider ?\n\nTapez /menu pour voir nos services\nTapez /aide pour l\'aide`;
        await sendTextMessage(waConfig, senderPhone, welcome);
        return NextResponse.json({ ok: true });
      }

      // ── /menu ──
      if (lowerText === "/menu") {
        if (!agent || agent.services.length === 0) {
          await sendTextMessage(waConfig, senderPhone, "Aucun service disponible pour le moment. Notre equipe vous repondra bientot !");
          return NextResponse.json({ ok: true });
        }
        const agentName = agent.name || "Notre entreprise";
        let menuText = `📋 *MENU - ${agentName}*\n\n`;
        agent.services.forEach((s, i) => {
          const price = Number(s.price).toLocaleString("fr-FR");
          menuText += `${i + 1}. *${s.name}* - ${price} FCFA${s.description ? `\n   ${s.description}` : ""}\n`;
        });
        menuText += `\nRepondez par le numero du service qui vous interesse, ou tapez /contact pour nos coordonnees.`;
        await sendTextMessage(waConfig, senderPhone, menuText);
        return NextResponse.json({ ok: true });
      }

      // ── /contact ──
      if (lowerText === "/contact") {
        const lines = [
          agent?.name || "Notre entreprise",
          agent?.address ? `📍 ${agent.address}` : "",
          agent?.phone ? `📞 ${agent.phone}` : "",
          `💰 Paiement: ${agent?.paymentMethod || "Cash / Orange Money / MTN Money"}`,
        ].filter(Boolean);
        await sendTextMessage(waConfig, senderPhone, lines.join("\n"));
        return NextResponse.json({ ok: true });
      }

      // ── /aide ──
      if (lowerText === "/aide") {
        await sendTextMessage(waConfig, senderPhone,
          `🆘 *AIDE*\n\nCommandes disponibles:\n• /start - Message d\'accueil\n• /menu - Voir nos services\n• /contact - Nos coordonnees\n• /aide - Cette aide\n\nVous pouvez aussi envoyer un message et notre equipe vous repondra.`);
        return NextResponse.json({ ok: true });
      }

      // ── Service selection by number ──
      if (agent && /^\d+$/.test(lowerText)) {
        const idx = parseInt(lowerText) - 1;
        if (idx >= 0 && idx < agent.services.length) {
          const svc = agent.services[idx];
          const price = Number(svc.price).toLocaleString("fr-FR");
          await sendTextMessage(waConfig, senderPhone,
            `✅ *${svc.name}* selectionne\n💰 Prix: ${price} FCFA${svc.description ? `\n📝 ${svc.description}` : ""}${svc.duration ? `\n⏱ Duree: ${svc.duration} min` : ""}\n\nPour commander, tapez /commander ou contactez-nous directement.`);
          return NextResponse.json({ ok: true });
        }
      }

      // ── Greeting auto-response ──
      const greetings = ["bonjour", "bonsoir", "salut", "hello", "hi", "yo", "wesh", "bonsoir", "good morning", "good evening"];
      if (greetings.some(g => lowerText.includes(g))) {
        const greetText = `Bonjour ${contactName} ! 😊 Bienvenue chez ${agent?.name || "nous"}.\n\nTapez /menu pour voir nos services ou envoyez votre message et on vous repond.`;
        await sendTextMessage(waConfig, senderPhone, greetText);
        return NextResponse.json({ ok: true });
      }

      // ── Default: forward to human ──
      await sendTextMessage(waConfig, senderPhone,
        `Merci ${contactName} ! Notre equipe a recu votre message et vous repondra tres rapidement. En attendant:\n\n• /menu - Nos services\n• /contact - Nos coordonnees\n• /aide - Aide`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[WA Webhook] Error:", error);
    return NextResponse.json({ ok: true }); // Always 200 for Meta
  }
}
