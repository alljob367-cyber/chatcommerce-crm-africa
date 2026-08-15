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

// ─── Helper: Answer callback query (remove loading state) ──────────

async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text || "" }),
    });
  } catch (error) {
    console.error("[Telegram Webhook] answerCallbackQuery error:", error);
  }
}

// ─── Helper: Find agent by bot token ─────────────────────────────

type AgentWithServices = {
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
  company?: {
    name: string;
    address?: string | null;
    phone?: string | null;
    currency?: string | null;
    products: { name: string; description: string | null; price: number; stock: number; isActive: boolean }[];
  };
};

async function findAgentByToken(botToken: string): Promise<AgentWithServices | null> {
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
  }) as unknown as AgentWithServices | null;
}

// ─── Helper: Build services menu with inline buttons ──────────────

function buildServicesMenu(agent: AgentWithServices, lang: "fr" | "en") {
  const currency = agent.currency || "XAF";
  const labels = {
    fr: { title: "Nos Services", empty: "Aucun service disponible", price: "FCFA", order: "Commander" },
    en: { title: "Our Services", empty: "No services available", price: "FCFA", order: "Order" },
  }[lang];

  if (!agent.services.length) return { text: labels.empty, keyboard: undefined };

  let text = `<b>${labels.title}</b> — ${agent.name}\n\n`;
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  agent.services.forEach((svc, i) => {
    const priceStr = svc.price > 0
      ? `${svc.price.toLocaleString("fr-FR")} ${labels.price}`
      : lang === "fr" ? "Gratuit" : "Free";
    text += `<b>${i + 1}.</b> ${svc.name} — <b>${priceStr}</b>\n`;
    if (svc.description) text += `   <i>${svc.description}</i>\n`;
    buttons.push([{ text: `${svc.name} — ${priceStr}`, callback_data: `order:${svc.id}` }]);
  });

  text += `\n<i>${lang === "fr" ? "Cliquez sur un service pour commander" : "Click a service to order"}</i>`;

  return {
    text,
    keyboard: { inline_keyboard: buttons },
  };
}

// ─── Helper: Build contact info ──────────────────────────────────

function buildContactInfo(agent: AgentWithServices, lang: "fr" | "en") {
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

// ─── Helper: Create a booking in DB ───────────────────────────────

async function createBooking(
  agent: AgentWithServices,
  chatId: string,
  serviceId: string,
  customerName: string,
  lang: "fr" | "en"
): Promise<string> {
  const service = agent.services.find(s => s.id === serviceId);
  if (!service) return lang === "fr" ? "Service introuvable." : "Service not found.";

  const currency = agent.currency || "XAF";
  const priceStr = service.price > 0 ? `${service.price.toLocaleString("fr-FR")} ${currency}` : "Gratuit";

  // Create booking in database
  try {
    await db.telegramBooking.create({
      data: {
        agentId: agent.id,
        companyId: agent.companyId,
        chatId,
        customerName,
        serviceId,
        serviceName: service.name,
        status: "pending",
      },
    });
    console.log(`[Telegram Webhook] Booking created: ${service.name} for ${customerName} (chatId: ${chatId})`);
  } catch (error) {
    console.error("[Telegram Webhook] Failed to create booking:", error);
  }

  // Build confirmation message
  const payInfo = agent.paymentMethod
    ? `\n\n💳 ${lang === "fr" ? "Paiement" : "Payment"}: ${agent.paymentMethod === "orange_money" ? "Orange Money" : agent.paymentMethod === "mtn_money" ? "MTN Mobile Money" : agent.paymentMethod === "cash" ? (lang === "fr" ? "Espèces" : "Cash") : agent.paymentMethod}`
    : "";

  return lang === "fr"
    ? `✅ <b>Commande enregistrée !</b>\n\n📋 Service: <b>${service.name}</b>\n💰 Prix: <b>${priceStr}</b>\n👤 Client: ${customerName}\n🏪 ${agent.name}${payInfo}\n\n📝 ${lang === "fr" ? "Votre commande est en attente de confirmation." : "Your order is pending confirmation."}\n\nTapez /menu pour voir d'autres services.`
    : `✅ <b>Order placed!</b>\n\n📋 Service: <b>${service.name}</b>\n💰 Price: <b>${priceStr}</b>\n👤 Client: ${customerName}\n🏪 ${agent.name}${payInfo}\n\n📝 Your order is pending confirmation.\n\nType /menu to see more services.`;
}

// ─── Helper: Handle AI or keyword response ────────────────────────

async function handleAIResponse(
  text: string,
  agent: AgentWithServices,
  lang: "fr" | "en",
  userName: string
): Promise<string> {
  const currency = agent.currency || "XAF";

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
    products: agent.company?.products || [],
    companyName: agent.company?.name || agent.name,
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
    const suggestion = await suggestService(text, agent.services);
    if (suggestion.service && suggestion.confidence >= 0.3) {
      const priceStr = suggestion.service.price > 0
        ? `${suggestion.service.price.toLocaleString("fr-FR")} ${currency}`
        : lang === "fr" ? "Gratuit" : "Free";
      const svcId = suggestion.service ? agent.services.find(s => s.name === suggestion.service!.name)?.id || "" : "";
      response = lang === "fr"
        ? `Nous avons le service <b>${suggestion.service.name}</b> au prix de <b>${priceStr}</b>.\n\n${suggestion.service.description ? `<i>${suggestion.service.description}</i>\n\n` : ""}Souhaitez-vous commander ? Cliquez ci-dessous :`
        : `We have <b>${suggestion.service.name}</b> for <b>${priceStr}</b>.\n\n${suggestion.service.description ? `<i>${suggestion.service.description}</i>\n\n` : ""}Would you like to order? Click below:`;

      // Add order button
      const orderButton = {
        inline_keyboard: [[
          { text: lang === "fr" ? `✅ Commander ${suggestion.service.name}` : `✅ Order ${suggestion.service.name}`, callback_data: `order:${svcId}` },
        ]],
      };

      // Send with button
      await sendTelegramMessage(
        agent.token,
        String(0), // will be replaced by caller
        response,
        orderButton
      );
      return "__WITH_BUTTON__"; // Signal to caller
    } else {
      // Generic fallback
      const greetings = ["bonjour", "bonsoir", "salut", "hello", "hi", "hey"];
      const isGreeting = greetings.some((g) => text.toLowerCase().includes(g));
      if (isGreeting) {
        response = lang === "fr"
          ? `Bonjour ${userName} ! 👋\n\nBienvenue chez <b>${agent.name}</b>.\nTapez <b>/menu</b> pour voir nos services ou <b>/aide</b> pour l'aide.`
          : `Hello ${userName}! 👋\n\nWelcome to <b>${agent.name}</b>.\nType <b>/menu</b> to view services or <b>/help</b> for help.`;
      } else {
        response = lang === "fr"
          ? `Merci pour votre message. Pour mieux vous servir :\n\n📋 <b>/menu</b> — Voir nos services\n📞 <b>/contact</b> — Nos coordonnées\n🕐 <b>/horaire</b> — Horaires\n❓ <b>/aide</b> — Aide\n\nOu tapez simplement le nom d'un service !`
          : `Thank you for your message. To better serve you:\n\n📋 <b>/menu</b> — View services\n📞 <b>/contact</b> — Contact info\n🕐 <b>/horaire</b> — Hours\n❓ <b>/help</b> — Help\n\nOr just type a service name!`;
      }
    }
  }

  return response || "";
}

// ─── POST /api/telegram/webhook ───────────────────────────────────
// This is the endpoint that Telegram calls when a user sends a message to the bot.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const update = body;
    if (!update) {
      return NextResponse.json({ error: "No update data" }, { status: 400 });
    }

    // Extract bot token from URL query parameter
    const url = new URL(req.url);
    const botToken = url.searchParams.get("token");
    if (!botToken) {
      console.error("[Telegram Webhook] Missing bot token in URL");
      return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
    }

    // ─── Handle CALLBACK_QUERY (inline keyboard button presses) ───
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callbackQuery = (update as any).callback_query;
    if (callbackQuery) {
      const callbackData = String(callbackQuery.data || "");
      const chatId = String(callbackQuery.message?.chat?.id || "");
      const callbackId = String(callbackQuery.id || "");
      const from = callbackQuery.from || {};
      const userName = from.first_name || "Client";
      const userLang = from.language_code === "en" ? "en" : "fr";

      // Answer the callback to remove loading state
      await answerCallbackQuery(botToken, callbackId);

      // Find the agent
      const agent = await findAgentByToken(botToken);
      if (!agent) {
        return NextResponse.json({ ok: true });
      }

      // Handle callback actions
      if (callbackData === "menu" || callbackData === "services") {
        const { text, keyboard } = buildServicesMenu(agent, userLang);
        await sendTelegramMessage(botToken, chatId, text, keyboard);
      } else if (callbackData === "contact") {
        await sendTelegramMessage(botToken, chatId, buildContactInfo(agent, userLang));
      } else if (callbackData === "horaire") {
        if (agent.openHours) {
          try {
            const hours = JSON.parse(agent.openHours);
            const hoursText = Object.entries(hours)
              .map(([day, time]) => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${time}`)
              .join("\n");
            await sendTelegramMessage(botToken, chatId, `<b>🕐 ${userLang === "fr" ? "Horaires d'ouverture" : "Opening hours"}</b>\n\n${hoursText}`);
          } catch {
            await sendTelegramMessage(botToken, chatId, String(agent.openHours));
          }
        } else {
          await sendTelegramMessage(botToken, chatId, userLang === "fr" ? "Les horaires ne sont pas encore configurés." : "Hours not yet configured.");
        }
      } else if (callbackData === "aide") {
        await sendTelegramMessage(botToken, chatId, buildHelpText(userLang));
      } else if (callbackData.startsWith("order:")) {
        // Service order from inline button
        const serviceId = callbackData.replace("order:", "");
        const confirmation = await createBooking(agent, chatId, serviceId, userName, userLang);
        await sendTelegramMessage(botToken, chatId, confirmation);
      } else if (callbackData === "confirm_yes") {
        await sendTelegramMessage(botToken, chatId, userLang === "fr"
          ? "✅ Commande confirmée ! Notre équipe vous contactera bientôt."
          : "✅ Order confirmed! Our team will contact you soon.");
      } else if (callbackData === "confirm_no") {
        await sendTelegramMessage(botToken, chatId, userLang === "fr"
          ? "❌ Commande annulée. Tapez /menu pour voir nos services."
          : "❌ Order cancelled. Type /menu to see our services.");
      }

      return NextResponse.json({ ok: true });
    }

    // ─── Handle regular MESSAGE ─────────────────────────────────
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

    // Find the agent by token
    const agent = await findAgentByToken(botToken);
    if (!agent) {
      console.error("[Telegram Webhook] No active agent found for token");
      return NextResponse.json({ ok: true });
    }

    const currency = agent.currency || "XAF";

    // ─── Command Handler ────────────────────────────────────────

    // /start command — send welcome + inline keyboard
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

    // /menu, /services command — show services with order buttons
    if (text === "/menu" || text === "/services") {
      const { text: menuText, keyboard } = buildServicesMenu(agent, userLang);
      await sendTelegramMessage(botToken, chatId, menuText, keyboard);
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

    // /commander — show services with order buttons
    if (text === "/commander") {
      const { text: menuText, keyboard } = buildServicesMenu(agent, userLang);
      const header = userLang === "fr"
        ? `<b>🛒 Passer une commande</b>\n\nChoisissez un service :\n\n`
        : `<b>🛒 Place an order</b>\n\nChoose a service:\n\n`;
      await sendTelegramMessage(botToken, chatId, header + menuText, keyboard);
      return NextResponse.json({ ok: true });
    }

    // ─── AI / Keyword Response Handler ─────────────────────────

    const response = await handleAIResponse(text, agent, userLang, userName);
    if (response && response !== "__WITH_BUTTON__") {
      await sendTelegramMessage(botToken, chatId, response);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Telegram Webhook] Error:", error);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// ─── GET /api/telegram/webhook ───────────────────────────────────

export async function GET() {
  return NextResponse.json({ status: "Telegram webhook endpoint is active" });
}
