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
      chariow: "Chariow (Paiement en ligne)",
    };
    lines.push(`\n${lang === "fr" ? "💳 Paiement" : "💳 Payment"}: ${payLabels[agent.paymentMethod] || agent.paymentMethod}`);
  }

  // Add Chariow availability info
  lines.push(`\n🌐 ${lang === "fr" ? "Paiement en ligne disponible via Chariow" : "Online payment available via Chariow"}`);

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
): Promise<{ text: string; keyboard?: Record<string, unknown> }> {
  const service = agent.services.find(s => s.id === serviceId);
  if (!service) return { text: lang === "fr" ? "Service introuvable." : "Service not found." };

  const currency = agent.currency || "XAF";
  const priceStr = service.price > 0 ? `${service.price.toLocaleString("fr-FR")} ${currency}` : "Gratuit";

  // Create booking in database
  let bookingId: string | undefined;
  try {
    const booking = await db.telegramBooking.create({
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
    bookingId = booking.id;
    console.log(`[Telegram Webhook] Booking created: ${service.name} for ${customerName} (chatId: ${chatId})`);
  } catch (error) {
    console.error("[Telegram Webhook] Failed to create booking:", error);
  }

  // Create merchant payment if service has a price and agent has payment method
  let paymentInfo = "";
  const merchantPhone = agent.phone || "";
  const payMethodName = agent.paymentMethod === "orange_money" ? "Orange Money" : agent.paymentMethod === "mtn_money" ? "MTN Mobile Money" : agent.paymentMethod;

  if (service.price > 0 && agent.paymentMethod && agent.paymentMethod !== "cash") {
    // Check if company has Chariow enabled (via paymentSettings.chariowEnabled)
    const companyData = await db.company.findUnique({
      where: { id: agent.companyId },
      select: { paymentSettings: true },
    });
    let chariowEnabled = false;
    try {
      const pSettings = companyData?.paymentSettings ? (typeof companyData.paymentSettings === 'string' ? JSON.parse(companyData.paymentSettings) : companyData.paymentSettings) : {};
      chariowEnabled = pSettings.chariowEnabled === true;
    } catch {}

    if (chariowEnabled) {
      // Don't create payment yet — customer will choose method via buttons
      paymentInfo = `\n\n${"─".repeat(20)}\n💰 <b>MONTANT À PAYER :</b> ${service.price.toLocaleString("fr-FR")} ${currency}\n\n<b>Choisissez votre mode de paiement :</b>`;
    } else {
      // Mobile Money only — create payment immediately
      try {
        await db.merchantPayment.create({
          data: {
            agentId: agent.id,
            companyId: agent.companyId,
            bookingId: bookingId || null,
            chatId,
            customerName,
            serviceName: service.name,
            amount: service.price,
            currency,
            paymentMethod: agent.paymentMethod,
            merchantPhone: merchantPhone || null,
            status: "pending",
          },
        });
      } catch (error) {
        console.error("[Telegram Webhook] Failed to create merchant payment:", error);
      }
      if (merchantPhone) {
        paymentInfo = `\n\n${"─".repeat(20)}\n💰 <b>PAYER :</b> ${service.price.toLocaleString("fr-FR")} ${currency}\n📱 Via: <b>${payMethodName}</b>\n📞 Envoyez au: <b>${merchantPhone}</b>\n\n📋 <b>Etapes :</b>\n1️⃣ Ouvrez votre app ${payMethodName}\n2️⃣ Transférez ${service.price.toLocaleString("fr-FR")} ${currency} au ${merchantPhone}\n3️⃣ Notez votre numéro de transaction\n4️⃣ Envoyez-le ici avec: <b>/payer VOTRE_NUMERO_TRANSACTION</b>\n\n⏳ Votre commande sera confirmée à la réception du paiement.`;
      } else {
        paymentInfo = `\n\n💰 <b>PRIX:</b> ${service.price.toLocaleString("fr-FR")} ${currency}\n💳 Paiement: ${payMethodName}\n\n/contact — Pour voir les coordonnées de paiement`;
      }
    }
  } else if (agent.paymentMethod === "cash") {
    paymentInfo = `\n\n💵 Paiement en espèces sur place.`;
  }

  // ── Notify merchant about new order ──
  try {
    const orderNotif = [
      `🛒 <b>NOUVELLE COMMANDE</b>`,
      ``,
      `📋 Service: <b>${service.name}</b>`,
      `👤 Client: <b>${customerName}</b>`,
      `💰 Prix: <b>${priceStr}</b>`,
      `📱 Chat ID: <code>${chatId}</code>`,
      `🕐 Date: ${new Date().toLocaleString("fr-FR")}`,
      ``,
      service.price > 0 && agent.paymentMethod && agent.paymentMethod !== "cash"
        ? `<i>En attente de paiement client.</i>`
        : `<i>Commande en espèces — à confirmer.</i>`,
    ].join("\n");
    await sendTelegramMessage(agent.token, chatId, orderNotif);
  } catch (notifErr) {
    console.error("[Telegram Webhook] Failed to notify merchant about order:", notifErr);
  }

  const baseText = lang === "fr"
    ? `✅ <b>Commande enregistrée !</b>\n\n📋 Service: <b>${service.name}</b>\n💰 Prix: <b>${priceStr}</b>\n👤 Client: ${customerName}\n🏪 ${agent.name}`
    : `✅ <b>Order placed!</b>\n\n📋 Service: <b>${service.name}</b>\n💰 Price: <b>${priceStr}</b>\n👤 Client: ${customerName}\n🏪 ${agent.name}`;

  // Check if Chariow is enabled for this company
  let chariowEnabledForButtons = false;
  try {
    const cData = await db.company.findUnique({
      where: { id: agent.companyId },
      select: { paymentSettings: true },
    });
    const ps = cData?.paymentSettings ? (typeof cData.paymentSettings === 'string' ? JSON.parse(cData.paymentSettings) : cData.paymentSettings) : {};
    chariowEnabledForButtons = ps.chariowEnabled === true;
  } catch {}

  // Add pay button if payment is mobile money
  let keyboard: Record<string, unknown> | undefined;
  if (service.price > 0 && agent.paymentMethod && agent.paymentMethod !== "cash" && agent.phone) {
    if (chariowEnabledForButtons) {
      // Show payment method choice: Mobile Money or Chariow
      keyboard = {
        inline_keyboard: [
          [
            { text: lang === "fr" ? "📱 Mobile Money" : "📱 Mobile Money", callback_data: "pay_method:mm" },
            { text: lang === "fr" ? "🌐 Payer en ligne (Chariow)" : "🌐 Pay Online (Chariow)", callback_data: "pay_method:chariow" },
          ],
          [
            { text: lang === "fr" ? "📋 Menu" : "📋 Menu", callback_data: "menu" },
            { text: lang === "fr" ? "📞 Contact" : "📞 Contact", callback_data: "contact" },
          ],
        ],
      };
    } else {
      keyboard = {
        inline_keyboard: [
          [
            { text: lang === "fr" ? "💳 J'ai payé — Envoyer transaction" : "💳 I paid — Send transaction", callback_data: "pay_now" },
          ],
          [
            { text: lang === "fr" ? "📋 Menu" : "📋 Menu", callback_data: "menu" },
            { text: lang === "fr" ? "📞 Contact" : "📞 Contact", callback_data: "contact" },
          ],
        ],
      };
    }
  } else {
    keyboard = {
      inline_keyboard: [
        [
          { text: lang === "fr" ? "📋 Menu" : "📋 Menu", callback_data: "menu" },
          { text: lang === "fr" ? "📞 Contact" : "📞 Contact", callback_data: "contact" },
        ],
      ],
    };
  }

  const statusText = lang === "fr"
    ? `📝 Votre commande est en attente de confirmation.`
    : `📝 Your order is pending confirmation.`;

  return {
    text: `${baseText}${paymentInfo}\n\n${statusText}\n\nTapez /menu pour voir d'autres services.`,
    keyboard,
  };
}

// ─── Helper: Handle payment submission ───────────────────────────

async function handlePaymentSubmission(
  agent: AgentWithServices,
  chatId: string,
  transactionRef: string,
  customerName: string,
  lang: "fr" | "en"
): Promise<string> {
  // Find pending payment for this chat
  const pendingPayment = await db.merchantPayment.findFirst({
    where: {
      agentId: agent.id,
      chatId,
      status: "pending",
    },
    orderBy: { createdAt: "desc" },
  });

  if (!pendingPayment) {
    return lang === "fr"
      ? "❌ Aucune commande en attente de paiement. Tapez /menu pour commander d'abord."
      : "❌ No pending orders. Type /menu to order first.";
  }

  const currency = pendingPayment.currency || "XAF";
  const payMethodName = pendingPayment.paymentMethod === "orange_money" ? "Orange Money" : pendingPayment.paymentMethod === "mtn_money" ? "MTN Mobile Money" : pendingPayment.paymentMethod;

  // Update payment with transaction ref
  await db.merchantPayment.update({
    where: { id: pendingPayment.id },
    data: {
      transactionRef,
      status: "confirmed",
      confirmedAt: new Date(),
    },
  });

  // Also update linked booking if exists
  if (pendingPayment.bookingId) {
    try {
      await db.telegramBooking.update({
        where: { id: pendingPayment.bookingId },
        data: { status: "confirmed" },
      });
    } catch { /* ignore */ }
  }

  // ── Notify merchant about new payment ──
  try {
    const merchantNotif = [
      `💰 <b>NOUVEAU PAIEMENT REÇU</b>`,
      ``,
      `📋 Service: <b>${pendingPayment.serviceName || "Commande"}</b>`,
      `👤 Client: <b>${pendingPayment.customerName}</b>${pendingPayment.customerPhone ? ` (${pendingPayment.customerPhone})` : ""}`,
      `💰 Montant: <b>${pendingPayment.amount.toLocaleString("fr-FR")} ${currency}</b>`,
      `📱 Via: <b>${payMethodName}</b>`,
      `🔖 Transaction: <code>${transactionRef}</code>`,
      `🕐 Date: ${new Date().toLocaleString("fr-FR")}`,
      ``,
      `<i>Le paiement a été automatiquement confirmé par le client.</i>`,
      `<i>Vérifiez dans votre dashboard: Paiements Marchands</i>`,
    ].join("\n");
    await sendTelegramMessage(agent.token, chatId, merchantNotif);
  } catch (notifErr) {
    console.error("[Telegram Webhook] Failed to notify merchant:", notifErr);
  }

  return lang === "fr"
    ? `✅ <b>Paiement confirmé !</b>\n\n📋 Service: <b>${pendingPayment.serviceName || "Commande"}</b>\n💰 Montant: <b>${pendingPayment.amount.toLocaleString("fr-FR")} ${currency}</b>\n📱 Via: ${payMethodName}\n 🔖 Transaction: <code>${transactionRef}</code>\n\nVotre commande est maintenant confirmée ! Le commercant a été notifié.\n\nMerci pour votre confiance ! 🙏`
    : `✅ <b>Payment confirmed!</b>\n\n📋 Service: <b>${pendingPayment.serviceName || "Order"}</b>\n💰 Amount: <b>${pendingPayment.amount.toLocaleString("fr-FR")} ${currency}</b>\n📱 Via: ${payMethodName}\n 🔖 Transaction: <code>${transactionRef}</code>\n\nYour order is now confirmed! The merchant has been notified.\n\nThank you! 🙏`;
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

// ─── Helper: Handle Mobile Money payment choice ──────────────────
// When Chariow is enabled and customer chose Mobile Money

async function handleMobileMoneyPayment(
  agent: AgentWithServices,
  chatId: string,
  customerName: string,
  lang: "fr" | "en"
): Promise<void> {
  const currency = agent.currency || "XAF";
  const merchantPhone = agent.phone || "";
  const payMethodName = agent.paymentMethod === "orange_money" ? "Orange Money" : agent.paymentMethod === "mtn_money" ? "MTN Mobile Money" : agent.paymentMethod;

  // Find pending booking for this chat
  const pendingBooking = await db.telegramBooking.findFirst({
    where: { agentId: agent.id, chatId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  // Find associated service to get the price
  let serviceAmount = 0;
  let serviceName = "Commande";
  if (pendingBooking?.serviceId) {
    const svc = await db.businessService.findUnique({
      where: { id: pendingBooking.serviceId },
      select: { name: true, price: true },
    });
    if (svc) {
      serviceAmount = svc.price;
      serviceName = svc.name;
    }
  }

  // Create merchant payment with correct amount
  try {
    await db.merchantPayment.create({
      data: {
        agentId: agent.id,
        companyId: agent.companyId,
        bookingId: pendingBooking?.id || null,
        chatId,
        customerName,
        serviceName,
        amount: serviceAmount,
        currency,
        paymentMethod: agent.paymentMethod || "orange_money",
        merchantPhone: merchantPhone || null,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("[Telegram Webhook] Failed to create MM payment on choice:", error);
  }

  const amount = serviceAmount;
  const amountStr = amount > 0 ? `${amount.toLocaleString("fr-FR")} ${currency}` : "";

  const instructions = lang === "fr"
    ? `📱 <b>Paiement par ${payMethodName}</b>\n\n${amountStr ? `💰 Montant: <b>${amountStr}</b>\n\n` : ""}📋 <b>Étapes :</b>\n\n1️⃣ Ouvrez votre application <b>${payMethodName}</b>\n2️⃣ Allez dans <b>Transfert / Envoyer de l'argent</b>\n3️⃣ Entrez le numéro: <code>${merchantPhone}</code>\n4️⃣ Saisissez le montant: <b>${amountStr}</b>\n5️⃣ Confirmez avec votre code secret\n6️⃣ Notez votre <b>numéro de transaction</b>\n\n✉️ Envoyez-le ici: <b>/payer VOTRE_NUMERO</b>\n\n⏳ Votre commande sera confirmée à réception.`
    : `📱 <b>Payment via ${payMethodName}</b>\n\n${amountStr ? `💰 Amount: <b>${amountStr}</b>\n\n` : ""}📋 <b>Steps:</b>\n\n1️⃣ Open your <b>${payMethodName}</b> app\n2️⃣ Go to <b>Transfer / Send money</b>\n3️⃣ Enter number: <code>${merchantPhone}</code>\n4️⃣ Enter amount: <b>${amountStr}</b>\n5️⃣ Confirm with your PIN\n6️⃣ Note your <b>transaction number</b>\n\n✉️ Send it here: <b>/payer YOUR_NUMBER</b>\n\n⏳ Your order will be confirmed upon receipt.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: lang === "fr" ? "💳 J'ai payé — Envoyer transaction" : "💳 I paid — Send transaction", callback_data: "pay_now" },
      ],
      [
        { text: lang === "fr" ? "🌐 Changer pour Chariow" : "🌐 Switch to Chariow", callback_data: "pay_method:chariow" },
      ],
      [
        { text: lang === "fr" ? "📋 Menu" : "📋 Menu", callback_data: "menu" },
        { text: lang === "fr" ? "📞 Contact" : "📞 Contact", callback_data: "contact" },
      ],
    ],
  };

  await sendTelegramMessage(agent.token, chatId, instructions, keyboard);
}

// ─── Helper: Handle Chariow payment choice ──────────────────────
// When customer chose to pay online via Chariow

async function handleChariowPayment(
  agent: AgentWithServices,
  chatId: string,
  customerName: string,
  lang: "fr" | "en"
): Promise<void> {
  const currency = agent.currency || "XAF";

  // Find pending booking for this chat
  const pendingBooking = await db.telegramBooking.findFirst({
    where: { agentId: agent.id, chatId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  // Find associated service to get the price
  let serviceAmount = 0;
  let serviceName = "Commande";
  if (pendingBooking?.serviceId) {
    const svc = await db.businessService.findUnique({
      where: { id: pendingBooking.serviceId },
      select: { name: true, price: true },
    });
    if (svc) {
      serviceAmount = svc.price;
      serviceName = svc.name;
    }
  }

  // Create a MerchantPayment with chariow method
  try {
    await db.merchantPayment.create({
      data: {
        agentId: agent.id,
        companyId: agent.companyId,
        bookingId: pendingBooking?.id || null,
        chatId,
        customerName,
        serviceName,
        amount: serviceAmount,
        currency,
        paymentMethod: "chariow",
        merchantPhone: null,
        status: "pending",
      },
    });
  } catch (error) {
    console.error("[Telegram Webhook] Failed to create Chariow payment record:", error);
  }

  // Build Chariow guide message with amount
  const amountStr = serviceAmount > 0 ? `${serviceAmount.toLocaleString("fr-FR")} ${currency}` : "";

  const guide = lang === "fr"
    ? `🌐 <b>Paiement en ligne avec Chariow</b>\n\n${amountStr ? `💰 Montant à payer: <b>${amountStr}</b>\n\n` : ""}<b>Qu'est-ce que Chariow ?</b>\nChariow est une plateforme de paiement en ligne sécurisée. Vous pouvez payer avec:\n• 💳 Carte bancaire (Visa, Mastercard)\n• 📱 Mobile Money (Orange Money, MTN)\n• 🏦 Virement bancaire\n\n<b>📋 Étapes :</b>\n\n1️⃣ Cliquez sur le bouton <b>\"Payer avec Chariow\"</b> ci-dessous\n2️⃣ Vous serez redirigé vers la page de paiement sécurisée\n3️⃣ Choisissez votre méthode de paiement préférée\n4️⃣ Suivez les instructions pour compléter le paiement\n5️⃣ Vous recevrez une confirmation immédiate\n\n✅ <b>Avantages :</b>\n• Paiement instantané et automatique\n• Confirmation en temps réel\n• Aucun numéro de transaction à envoyer\n• Historique de paiement disponible\n\n⏳ Votre commande sera confirmée automatiquement après le paiement.\n\n💡 <b>Conseil:</b> Si vous rencontrez des problèmes, vous pouvez toujours changer pour le paiement Mobile Money.`
    : `🌐 <b>Online Payment with Chariow</b>\n\n${amountStr ? `💰 Amount to pay: <b>${amountStr}</b>\n\n` : ""}<b>What is Chariow?</b>\nChariow is a secure online payment platform. You can pay with:\n• 💳 Bank card (Visa, Mastercard)\n• 📱 Mobile Money (Orange Money, MTN)\n• 🏦 Bank transfer\n\n<b>📋 Steps:</b>\n\n1️⃣ Click the <b>\"Pay with Chariow\"</b> button below\n2️⃣ You'll be redirected to a secure payment page\n3️⃣ Choose your preferred payment method\n4️⃣ Follow the instructions to complete payment\n5️⃣ You'll receive instant confirmation\n\n✅ <b>Benefits:</b>\n• Instant and automatic payment\n• Real-time confirmation\n• No transaction number to send\n• Payment history available\n\n⏳ Your order will be automatically confirmed after payment.\n\n💡 <b>Tip:</b> If you encounter issues, you can always switch to Mobile Money payment.`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: lang === "fr" ? "🌐 Payer avec Chariow" : "🌐 Pay with Chariow", url: `https://${process.env.CHARIOW_STORE_DOMAIN || "pvgxjrjr.mychariow.shop"}?agent=${agent.id}&chat=${chatId}&company=${agent.companyId}` },
      ],
      [
        { text: lang === "fr" ? "📱 Changer pour Mobile Money" : "📱 Switch to Mobile Money", callback_data: "pay_method:mm" },
      ],
      [
        { text: lang === "fr" ? "📋 Menu" : "📋 Menu", callback_data: "menu" },
        { text: lang === "fr" ? "📞 Contact" : "📞 Contact", callback_data: "contact" },
      ],
    ],
  };

  await sendTelegramMessage(agent.token, chatId, guide, keyboard);
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
        const { text: confirmText, keyboard: confirmKeyboard } = await createBooking(agent, chatId, serviceId, userName, userLang);
        await sendTelegramMessage(botToken, chatId, confirmText, confirmKeyboard);
      } else if (callbackData === "pay_now") {
        // Customer clicked "I paid" button — prompt for transaction number
        await sendTelegramMessage(botToken, chatId, userLang === "fr"
          ? "💳 <b>Envoyez votre numéro de transaction</b>\n\nTapez: <b>/payer VOTRE_NUMERO_TRANSACTION</b>\n\nExemple: <code>/payer OM2024010100001</code>"
          : "💳 <b>Send your transaction number</b>\n\nType: <b>/payer YOUR_TRANSACTION_NUMBER</b>\n\nExample: <code>/payer OM2024010100001</code>");
      } else if (callbackData === "pay_method:mm") {
        // Customer chose Mobile Money — create payment and show instructions
        await handleMobileMoneyPayment(agent, chatId, userName, userLang);
      } else if (callbackData === "pay_method:chariow") {
        // Customer chose Chariow — create Chariow checkout
        await handleChariowPayment(agent, chatId, userName, userLang);
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

    // /payer — submit payment transaction number
    if (text.startsWith("/payer")) {
      const parts = text.split(/\s+/);
      const txRef = parts.slice(1).join(" ").trim();
      if (!txRef) {
        await sendTelegramMessage(botToken, chatId, userLang === "fr"
          ? "❌ Veuillez inclure votre numéro de transaction.\n\nUtilisez: <b>/payer VOTRE_NUMERO_TRANSACTION</b>\n\nExemple: <code>/payer OM2024010100001</code>"
          : "❌ Please include your transaction number.\n\nUse: <b>/payer YOUR_TRANSACTION_NUMBER</b>\n\nExample: <code>/payer OM2024010100001</code>");
      } else {
        const paymentResponse = await handlePaymentSubmission(agent, chatId, txRef, userName, userLang);
        await sendTelegramMessage(botToken, chatId, paymentResponse);
      }
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
