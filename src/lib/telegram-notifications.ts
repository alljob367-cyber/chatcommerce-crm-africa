// ============================================================
// TELEGRAM NOTIFICATIONS — ChatCommerce Africa
// Sends order/delivery status notifications via Telegram Bot API
// ============================================================

import { db } from "@/lib/db";

const TELEGRAM_API = "https://api.telegram.org/bot";

// ── Types ───────────────────────────────────────────────────

interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

interface ReplyMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

interface OrderStatusDetails {
  customerName?: string;
  items?: string[];
  total?: number;
  currency?: string;
}

interface DeliveryInfo {
  id: string;
  orderNumber?: string;
  pickupAddress: string;
  deliveryAddress: string;
  driverEarnings: number;
  customerName: string;
  customerPhone: string;
  fee?: number;
}

/**
 * Raw utility: send a Telegram message via the Bot API.
 * @param botToken - The Telegram bot token
 * @param chatId - The target chat ID (telegramId)
 * @param text - The message text (supports HTML)
 * @param replyMarkup - Optional inline keyboard markup
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: ReplyMarkup
): Promise<boolean> {
  if (!botToken || !chatId) return false;

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    };
    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const res = await fetch(`${TELEGRAM_API}${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[Telegram] send failed to ${chatId}: ${res.status} ${errBody}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Telegram] send error to ${chatId}:`, err);
    return false;
  }
}

// ── Get bot token from delivery's agent ─────────────────────

async function getBotTokenForDelivery(deliveryId: string): Promise<string | null> {
  const delivery = await db.delivery.findFirst({
    where: { id: deliveryId },
    select: { agentId: true },
  });
  if (!delivery?.agentId) return null;

  const agent = await db.telegramAgent.findFirst({
    where: { id: delivery.agentId },
    select: { token: true },
  });
  return agent?.token || null;
}

async function getBotTokenForOrder(orderId: string): Promise<string | null> {
  const delivery = await db.delivery.findFirst({
    where: { orderId },
    select: { agentId: true },
  });
  if (!delivery?.agentId) return null;

  const agent = await db.telegramAgent.findFirst({
    where: { id: delivery.agentId },
    select: { token: true },
  });
  return agent?.token || null;
}

// ── Status message templates ────────────────────────────────

const ORDER_STATUS_MESSAGES: Record<string, string> = {
  confirmed: "✅ <b>Votre commande a été acceptée</b>",
  preparing: "👨‍🍳 <b>Votre commande est en préparation</b>",
  ready: "📦 <b>Commande prête</b>\nRecherche d\'un livreur en cours...",
  delivered: "✅ <b>Commande livrée !</b>\nMerci pour votre confiance ! N\'hésitez pas à nous évaluer ⭐",
  cancelled: "❌ <b>Commande annulée</b>",
};

const DELIVERY_STATUS_MESSAGES: Record<string, string> = {
  searching: "📦 Commande prête, recherche d\'un livreur...",
  assigned: "🛵 Livreur assigné",
  picked_up: "📦 Commande récupérée par le livreur",
  on_the_way: "🚚 <b>En route !</b>\nLe livreur arrive bientôt chez vous.",
  delivered: "✅ <b>Commande livrée !</b>\nMerci pour votre confiance ! N\'hésitez pas à nous évaluer ⭐",
  cancelled: "❌ Livraison annulée",
};

// ════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════

/**
 * Notify a customer about their order status change.
 */
export async function notifyCustomerOrderStatus(
  chatId: string,
  orderNumber: string,
  status: string,
  details?: OrderStatusDetails
): Promise<boolean> {
  if (!chatId) return false;

  const botToken = await getBotTokenForDeliveryByChatId(chatId);
  if (!botToken) return false;

  let message = ORDER_STATUS_MESSAGES[status];
  if (!message) return false;

  // Build rich message with order details
  const parts: string[] = [];
  parts.push(message);
  parts.push("");
  parts.push(`<b>Commande ${orderNumber}</b>`);

  if (details?.items && details.items.length > 0) {
    parts.push("");
    parts.push("<b>Articles :</b>");
    for (const item of details.items) {
      parts.push(`  • ${item}`);
    }
  }

  if (details?.total !== undefined) {
    parts.push("");
    parts.push(`<b>Total :</b> ${details.total.toLocaleString()} ${details.currency || "XAF"}`);
  }

  return sendTelegramMessage(botToken, chatId, parts.join("\n"));
}

/**
 * Notify a driver about a new delivery assignment.
 */
export async function notifyDriverNewDelivery(
  driverTelegramId: string,
  delivery: DeliveryInfo
): Promise<boolean> {
  if (!driverTelegramId) return false;

  const botToken = await getBotTokenForDelivery(delivery.id);
  if (!botToken) return false;

  const message = [
    "🚨 <b>NOUVELLE LIVRAISON</b>",
    "",
    `<b>Commande :</b> #${delivery.orderNumber || delivery.id.slice(-6).toUpperCase()}`,
    `📍 <b>Retrait :</b> ${delivery.pickupAddress}`,
    `📍 <b>Livraison :</b> ${delivery.deliveryAddress}`,
    `💰 <b>Gain :</b> ${delivery.driverEarnings.toLocaleString()} FCFA`,
    "",
    `<b>Client :</b> ${delivery.customerName}`,
    `<b>Tel :</b> ${delivery.customerPhone}`,
  ].join("\n");

  const replyMarkup: ReplyMarkup = {
    inline_keyboard: [
      [
        {
          text: "✅ ACCEPTER",
          callback_data: `driver_accept_${delivery.id}`,
        },
        {
          text: "❌ REFUSER",
          callback_data: `driver_reject_${delivery.id}`,
        },
      ],
    ],
  };

  return sendTelegramMessage(botToken, driverTelegramId, message, replyMarkup);
}

/**
 * Notify a driver that they have been assigned to a delivery.
 */
export async function notifyDriverAssigned(
  driverTelegramId: string,
  delivery: DeliveryInfo
): Promise<boolean> {
  if (!driverTelegramId) return false;

  const botToken = await getBotTokenForDelivery(delivery.id);
  if (!botToken) return false;

  const message = [
    "🛵 <b>LIVRAISON ASSIGNÉE</b>",
    "",
    `<b>Commande :</b> #${delivery.orderNumber || delivery.id.slice(-6).toUpperCase()}`,
    `📍 <b>Retrait :</b> ${delivery.pickupAddress}`,
    `📍 <b>Livraison :</b> ${delivery.deliveryAddress}`,
    `💰 <b>Gains :</b> ${delivery.driverEarnings.toLocaleString()} FCFA`,
    "",
    `<b>Client :</b> ${delivery.customerName}`,
    `<b>Tel :</b> ${delivery.customerPhone}`,
    "",
    "<i>Rendez-vous au point de retrait.</i>",
  ].join("\n");

  return sendTelegramMessage(botToken, driverTelegramId, message);
}

/**
 * Notify a customer about delivery status change.
 */
export async function notifyCustomerDeliveryStatus(
  chatId: string,
  orderNumber: string | undefined,
  status: string,
  driverName?: string
): Promise<boolean> {
  if (!chatId) return false;

  const botToken = await getBotTokenForDeliveryByChatId(chatId);
  if (!botToken) return false;

  let baseMessage = DELIVERY_STATUS_MESSAGES[status];
  if (!baseMessage) return false;

  // Enrich assigned status with driver name
  if (status === "assigned" && driverName) {
    baseMessage = `🛵 <b>Livreur assigné :</b> ${driverName}`;
  }

  const parts: string[] = [];
  parts.push(baseMessage);
  if (orderNumber) {
    parts.push(`\n<b>Commande ${orderNumber}</b>`);
  }

  return sendTelegramMessage(botToken, chatId, parts.join("\n"));
}

// ── Helpers ─────────────────────────────────────────────────

/**
 * Find the bot token for a given customer chatId by looking up
 * any delivery that has this chatId.
 */
async function getBotTokenForDeliveryByChatId(chatId: string): Promise<string | null> {
  const delivery = await db.delivery.findFirst({
    where: { telegramChatId: chatId },
    select: { agentId: true },
  });
  if (!delivery?.agentId) return null;

  const agent = await db.telegramAgent.findFirst({
    where: { id: delivery.agentId },
    select: { token: true },
  });
  return agent?.token || null;
}
