import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  generateAIResponse,
  suggestService,
  buildAIBotConfig,
  buildContextFromBusinessData,
} from "@/lib/ai-bot-engine";

// ─── Helper: Send message via Telegram API ───────────────────────

async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>
): Promise<boolean> {
  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) body.reply_markup = replyMarkup;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return true;
  } catch (error) {
    console.error("[Telegram Webhook] sendTelegramMessage error:", error);
    return false;
  }
}

// ─── Helper: Find agent by bot token ─────────────────────────────

async function findAgentByToken(
  botToken: string
): Promise<{
  id: string;
  companyId: string;
  name: string;
  businessType: string;
  isActive: boolean;
  welcomeMessage: string | null;
  address: string | null;
  phone: string | null;
  openHours: string | null;
  currency: string;
  paymentMethod: string | null;
  token: string;
  aiConfig: string | null;
  services: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    isActive: boolean;
  }[];
} | null> {
  return db.telegramAgent.findFirst({
    where: { token: botToken, isActive: true },
    include: {
      services: {
        where: { isActive: true },
        select: { id: true, name: true, description: true, price: true, isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      company: {
        select: {
          name: true,
          address: true,
          phone: true,
          currency: true,
          products: {
            where: { isActive: true },
            select: { name: true, description: true, price: true, stock: true, isActive: true },
          },
        },
      },
    },
  }) as Promise<unknown> as Promise<ReturnType<typeof findAgentByToken>>;
}

// ─── Helper: Build services menu ────────────────────────────────

function buildServicesMenu(
  agent: NonNullable<Awaited<ReturnType<typeof findAgentByToken>>>,
  lang: "fr" | "en"
) {
  const currency = agent.currency || "XAF";
  const labels = {
    fr: { title: "Nos Services", empty: "Aucun service disponible", price: "FCFA" },
    en: { title: "Our Services", empty: "No services available", price: "FCFA" },
  }[lang];

  if (!agent.services.length) return labels.empty;

  let text = `<b>${labels.title}</b> — ${agent.name}\n\n`;
  agent.services.forEach((svc, i) => {
    const priceStr = svc.price > 0
      ? `${svc.price.toLocaleString("fr-FR")} ${labels.price}`
      : lang === "fr" ? "Gratuit" : "Free";
    text += `<b>${i + 1}.</b> ${svc.name} — <b>${priceStr}</b>\n`;
    if (svc.description) text += `   <i>${svc.description}</i>\n`;
  });

  text += `\n<i>${lang === "fr" ? "Tapez le nom du service pour commander" : "Type the service name to order"}</i>`;
  return text;
}

// ─── Helper: Build contact info ──────────────────────────────────

function buildContactInfo(
  agent: NonNullable<Awaited<ReturnType<typeof findAgentByToken>>>,
  lang: "fr" | "en"
) {
  const lines: string[] = [];
  lines.push(`<b>${agent.name}</b>\n`);

  if (agent.address) lines.push(`${lang === "fr" ? "📍 Adresse" : "📍 Address"}: ${agent.address}`);
  if (agent.phone) lines.push(`${lang === "fr" ? "📞 Téléphone" : "📞 Phone"}: ${agent.phone}`);
  if (agent.openHours) {
    try {
      const hours = JSON.parse(agent.openHours);
      const hoursText = Object.entries(hours)
        .map(([day, time]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`)
        .join("\n");
      lines.push(`\n${lang === "fr" ? "🕐 Horaires" : "🕐 Hours"}:\n${hoursText}`);
    } catch { /* ignore */ }
  }

  if (agent.paymentMethod) {
    const payLabels: Record<string, string> = {
      orange_money: "Orange Money",
      mtn_money: "MTN Mobile Money",
      cash: lang === "fr" ? "Espèces" : "Cash",
    };
    lines.push(`\n${lang === "fr" ? "💳 Paiement" : "💳 Payment"}: ${payLabels[agent.paymentMethod] || agent.paymentMethod}`);
  }

  return lines.join("\n");
}

// ─── Helper: Build help text ──────────────────────────────────────

function buildHelpText(lang: "fr" | "en") {
  return lang === "fr"
    ? `<b>Comment utiliser ce bot</b>\n\n/start — Commencer\n/menu ou /services — Voir les services\n/contact — Nos coordonnées\n/horaire — Horaires d'ouverture\n/commander — Passer une commande\n/aide — Cette aide\n\n<b>Conseil:</b> Tapez simplement le nom d'un service pour obtenir des informations !`
    : `<b>How to use this bot</b>\n\n/start — Start\n/menu or /services — View services\n/contact — Our contact info\n/horaire — Opening hours\n/commander — Place an order\n/help — This help\n\n<b>Tip:</b> Just type a service name to get info!`;
}

// ─── POST /api/telegram/webhook ───────────────────────────────────
// This is the endpoint that Telegram calls when a user sends a message to the bot.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Telegram webhook format
    const update = body;
    if (!update) {
      return NextResponse.json({ error: "No update data" }, { status: 400 });
    }

    // Handle webhook verification (setWebhook)
    // Telegram may send a message to verify the webhook
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message = (update as any).message || (update as any).edited_message;
    if (!message || !message.chat || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(message.chat.id);
    const text = String(message.text).trim();
    const from = message.from || {};
    const userName = from.first_name || "Client";
    const userLang = from.language_code === "en" ? "en" : "fr";

    // Extract bot token from the URL path query parameter
    // The webhook URL format: /api/telegram/webhook?token=BOT_TOKEN
    const url = new URL(req.url);
    const botToken = url.searchParams.get("token");

    if (!botToken) {
      console.error("[Telegram Webhook] Missing bot token in URL");
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    // Find the agent by token
    const agent = await findAgentByToken(botToken);
    if (!agent) {
      console.error("[Telegram Webhook] No active agent found for token");
      return NextResponse.json({ ok: true });
    }

    const currency = agent.currency || "XAF";

    // ─── Command Handler ────────────────────────────────────────

    // /start command
    if (text === "/start") {
      const welcome = agent.welcomeMessage ||
        (userLang === "fr"
          ? `Bienvenue chez ${agent.name} ! 🎉\n\nJe suis votre assistant virtuel. Comment puis-je vous aider ?`
          : `Welcome to ${agent.name}! 🎉\n\nI'm your virtual assistant. How can I help you?`);

      const replyKeyboard = {
        inline_keyboard: [
          [
            { text: userLang === "fr" ? "📋 Voir les services" : "📋 View services", callback_data: "menu" },
            { text: userLang === "fr" ? "📞 Contact" : "📞 Contact", callback_data: "contact" },
          ],
          [
            { text: userLang === "fr" ? "🕐 Horaires" : "🕐 Hours", callback_data: "horaire" },
            { text: userLang === "fr" ? "❓ Aide" : "❓ Help", callback_data: "aide" },
          ],
        ],
      };

      await sendTelegramMessage(botToken, chatId, welcome, replyKeyboard);
      return NextResponse.json({ ok: true });
    }

    // /menu, /services command
    if (text === "/menu" || text === "/services") {
      await sendTelegramMessage(botToken, chatId, buildServicesMenu(agent, userLang));
      return NextResponse.json({ ok: true });
    }

    // /contact command
    if (text === "/contact") {
      await sendTelegramMessage(botToken, chatId, buildContactInfo(agent, userLang));
      return NextResponse.json({ ok: true });
    }

    // /horaire command
    if (text === "/horaire") {
      if (agent.openHours) {
        try {
          const hours = JSON.parse(agent.openHours);
          const hoursText = Object.entries(hours)
            .map(([day, time]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`)
            .join("\n");
          await sendTelegramMessage(
            botToken,
            chatId,
            `<b>🕐 ${userLang === "fr" ? "Horaires d'ouverture" : "Opening hours"}</b>\n\n${hoursText}`
          );
        } catch {
          await sendTelegramMessage(botToken, chatId, String(agent.openHours));
        }
      } else {
        await sendTelegramMessage(
          botToken,
          chatId,
          userLang === "fr" ? "Les horaires ne sont pas encore configurés." : "Hours not yet configured."
        );
      }
      return NextResponse.json({ ok: true });
    }

    // /aide, /help command
    if (text === "/aide" || text === "/help") {
      await sendTelegramMessage(botToken, chatId, buildHelpText(userLang));
      return NextResponse.json({ ok: true });
    }

    // ─── AI / Keyword Response Handler ─────────────────────────

    // Build AI config from agent
    const aiConfig = buildAIBotConfig({
      aiConfig: agent.aiConfig || undefined,
      businessType: agent.businessType,
      name: agent.name,
      services: agent.services.map((s) =>
        `- ${s.name} (${s.price.toLocaleString("fr-FR")} ${currency})${s.description ? `: ${s.description}` : ""}`
      ).join("\n"),
    });

    // Build business context
    const businessContext = buildContextFromBusinessData({
      services: agent.services,
      products: (((agent as Record<string, unknown>).company as Record<string, unknown> | undefined)?.products as Array<{ name: string; price: number; stock: number; isActive: boolean; description: string | null }>) || [],
      companyName: ((agent as Record<string, unknown>).company as Record<string, unknown> | undefined)?.name as string || agent.name,
      businessType: agent.businessType,
      address: agent.address,
      phone: agent.phone,
      openHours: agent.openHours,
      currency,
    });

    let response: string | null = null;

    // Try AI first
    if (aiConfig.enabled) {
      try {
        response = await generateAIResponse(text, aiConfig, [], businessContext);
      } catch (error) {
        console.error("[Telegram Webhook] AI error:", error);
      }
    }

    // Fallback: keyword matching
    if (!response) {
      const suggestion = await suggestService(text, agent.services as Array<{ name: string; description: string | null; price: number }>);
      if (suggestion.service && suggestion.confidence >= 0.3) {
        const priceStr = suggestion.service.price > 0
          ? `${suggestion.service.price.toLocaleString("fr-FR")} ${currency}`
          : userLang === "fr" ? "Gratuit" : "Free";
        response = userLang === "fr"
          ? `Nous avons le service <b>${suggestion.service.name}</b> au prix de <b>${priceStr}</b>.\n\n${suggestion.service.description ? `<i>${suggestion.service.description}</i>\n\n` : ""}${userLang === "fr" ? "Souhaitez-vous commander ou réserver ?" : "Would you like to order or book?"}`
          : `We have <b>${suggestion.service.name}</b> for <b>${priceStr}</b>.\n\n${suggestion.service.description ? `<i>${suggestion.service.description}</i>\n\n` : ""}Would you like to order or book?`;
      } else {
        // Generic fallback
        const greetings = ["bonjour", "bonsoir", "salut", "hello", "hi", "hey", "bonjour!", "salut!"];
        const isGreeting = greetings.some((g) => text.toLowerCase().includes(g));
        if (isGreeting) {
          response = userLang === "fr"
            ? `Bonjour ${userName} ! 👋\n\nBienvenue chez <b>${agent.name}</b>.\nTapez <b>/menu</b> pour voir nos services ou <b>/aide</b> pour l'aide.`
            : `Hello ${userName}! 👋\n\nWelcome to <b>${agent.name}</b>.\nType <b>/menu</b> to view services or <b>/help</b> for help.`;
        } else {
          response = userLang === "fr"
            ? `Merci pour votre message. Pour mieux vous servir :\n\n📋 <b>/menu</b> — Voir nos services\n📞 <b>/contact</b> — Nos coordonnées\n🕐 <b>/horaire</b> — Horaires\n❓ <b>/aide</b> — Aide\n\nOu tapez simplement le nom d'un service !`
            : `Thank you for your message. To better serve you:\n\n📋 <b>/menu</b> — View services\n📞 <b>/contact</b> — Contact info\n🕐 <b>/horaire</b> — Hours\n❓ <b>/help</b> — Help\n\nOr just type a service name!`;
        }
      }
    }

    if (response) {
      await sendTelegramMessage(botToken, chatId, response);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// ─── GET /api/telegram/webhook ───────────────────────────────────
// For Telegram webhook verification

export async function GET() {
  return NextResponse.json({ status: "Telegram webhook endpoint is active" });
}
