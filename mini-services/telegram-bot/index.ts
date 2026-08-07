// ═══════════════════════════════════════════════════════════════
// TELEGRAM BOT MINI-SERVICE — Restaurant & Salon Booking Bots
// Polls Telegram getUpdates for all active agents every 2 seconds
// ═══════════════════════════════════════════════════════════════

import { Database } from "bun:sqlite";

const dbPath = "/home/z/my-project/db/custom.db";
const db = new Database(dbPath);
db.exec("PRAGMA journal_mode=WAL");

const POLL_INTERVAL = 2000;
const TELEGRAM_API = "https://api.telegram.org/bot";

// ─── Types ───────────────────────────────────────────────────────

interface TelegramAgent {
  id: string;
  token: string;
  name: string;
  botUsername: string | null;
  businessType: string;
  isActive: number;
  welcomeMessage: string | null;
  currency: string;
  companyId: string;
}

interface BusinessService {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number | null;
  isActive: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; first_name: string; last_name?: string; username?: string };
    text?: string;
    contact?: { phone_number: string; first_name: string };
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string; last_name?: string };
    message: { message_id: number; chat: { id: number } };
    data: string;
  };
}

interface UserSession {
  agentToken: string;
  state: string;
  data: Record<string, string>;
}

// ─── State ───────────────────────────────────────────────────────

const agentsMap = new Map<string, TelegramAgent>();
const offsets = new Map<string, number>();
const sessions = new Map<number, UserSession>();

// ─── Telegram API Helpers ─────────────────────────────────────────

async function telegramApi(token: string, method: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${TELEGRAM_API}${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    console.error(`[Telegram API Error] ${method}:`, err);
    return null;
  }
}

async function sendMessage(token: string, chatId: number, text: string, replyMarkup?: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return telegramApi(token, "sendMessage", body);
}

function inlineKeyboard(rows: Array<Array<{ text: string; callback_data: string }>>): Record<string, unknown> {
  return { inline_keyboard: rows };
}

// ─── Database Helpers ─────────────────────────────────────────────

function loadActiveAgents(): TelegramAgent[] {
  return db.query(
    `SELECT id, token, name, botUsername, businessType, isActive, welcomeMessage, currency, companyId
     FROM TelegramAgent WHERE isActive = 1`
  ).all() as unknown as TelegramAgent[];
}

function getAgentServices(agentId: string): BusinessService[] {
  return db.query(
    `SELECT id, name, description, price, duration, isActive
     FROM BusinessService WHERE agentId = ? AND isActive = 1
     ORDER BY sortOrder ASC`
  ).all(agentId) as unknown as BusinessService[];
}

function createBooking(data: {
  agentId: string; companyId: string; chatId: string; customerName: string;
  serviceId: string; serviceName: string; bookingDate: string; bookingTime: string;
  telegramMessageId: number;
}) {
  db.query(
    `INSERT INTO TelegramBooking (id, agentId, companyId, chatId, customerName, serviceId, serviceName, bookingDate, bookingTime, status, telegramMessageId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    generateId(), data.agentId, data.companyId, data.chatId, data.customerName,
    data.serviceId, data.serviceName, data.bookingDate, data.bookingTime, data.telegramMessageId
  );
}

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  const bytes = new Uint8Array(25);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 25; i++) id += chars[bytes[i] % chars.length];
  return id;
}

// ─── Bot Conversation Handlers ───────────────────────────────────

function getCustomerName(msg: NonNullable<TelegramUpdate["message"]>): string {
  const parts = [msg.chat.first_name, msg.chat.last_name].filter(Boolean);
  return parts.join(" ") || "Client";
}

async function handleStart(token: string, agent: TelegramAgent, chatId: number, name: string) {
  const welcome = agent.welcomeMessage ||
    (agent.businessType === "restaurant"
      ? `Bienvenue chez <b>${agent.name}</b> ! 🍽️\n\nCommandez vos plats préférés directement ici.`
      : `Bienvenue chez <b>${agent.name}</b> ! ✂️\n\nRéservez votre créneau en quelques clics.`);

  const kb = inlineKeyboard([
    [
      { text: agent.businessType === "restaurant" ? "🍽️ Voir le Menu" : "✂️ Nos Services", callback_data: "menu" },
      { text: "📞 Contact", callback_data: "contact" },
    ],
  ]);

  await sendMessage(token, chatId, welcome, kb);
}

async function handleMenu(token: string, agent: TelegramAgent, chatId: number) {
  const services = getAgentServices(agent.id);
  if (services.length === 0) {
    await sendMessage(token, chatId, "😕 Aucun service disponible pour le moment. Revenez plus tard !");
    return;
  }

  const label = agent.businessType === "restaurant" ? "plat" : "service";
  let text = agent.businessType === "restaurant" ? "🍽️ <b>Notre Menu</b>\n\n" : "✂️ <b>Nos Services</b>\n\n";
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const svc of services) {
    const priceStr = `${svc.price.toLocaleString()} ${agent.currency}`;
    text += `• <b>${svc.name}</b> — ${priceStr}`;
    if (svc.duration) text += ` (${svc.duration}min)`;
    text += "\n";
    if (svc.description) text += `  <i>${svc.description}</i>\n`;
    rows.push([{ text: `${svc.name} — ${priceStr}`, callback_data: `svc_${svc.id}` }]);
  }

  text += `\n👆 Sélectionnez un ${label} pour continuer.`;
  const kb = inlineKeyboard([...rows, [{ text: "↩️ Retour", callback_data: "start" }]]);
  await sendMessage(token, chatId, text, kb);
}

async function handleServiceSelected(token: string, agent: TelegramAgent, chatId: number, serviceId: string) {
  const services = getAgentServices(agent.id);
  const svc = services.find(s => s.id === serviceId);
  if (!svc) {
    await sendMessage(token, chatId, "❌ Service introuvable.");
    return;
  }

  const session: UserSession = { agentToken: token, state: "awaiting_date", data: { serviceId: svc.id, serviceName: svc.name } };
  sessions.set(chatId, session);

  const label = agent.businessType === "restaurant" ? "ce plat" : "ce service";
  const priceStr = `${svc.price.toLocaleString()} ${agent.currency}`;
  let text = `Vous avez choisi :\n\n<b>${svc.name}</b> — ${priceStr}`;
  if (svc.description) text += `\n<i>${svc.description}</i>`;
  if (svc.duration) text += `\n⏱ Durée: ${svc.duration} minutes`;
  text += `\n\n📅 Quelle date souhaitez-vous réserver ${label} ?\n<i>Format: JJ/MM/AAAA (ex: 25/12/2024)</i>`;

  await sendMessage(token, chatId, text);
}

async function handleDateReceived(token: string, agent: TelegramAgent, chatId: number, dateStr: string) {
  const parsed = parseDate(dateStr);
  if (!parsed) {
    await sendMessage(token, chatId, "❌ Date invalide. Utilisez le format JJ/MM/AAAA (ex: 25/12/2024)");
    return;
  }

  const session = sessions.get(chatId);
  if (session) {
    session.data.bookingDate = parsed;
    session.state = "awaiting_time";
  }

  await sendMessage(token, chatId, `📅 Date: <b>${parsed}</b>\n\n🕐 Quelle heure souhaitez-vous ?\n<i>Format: HH:MM (ex: 14:30)</i>`);
}

async function handleTimeReceived(token: string, agent: TelegramAgent, chatId: number, timeStr: string) {
  const parsed = parseTime(timeStr);
  if (!parsed) {
    await sendMessage(token, chatId, "❌ Heure invalide. Utilisez le format HH:MM (ex: 14:30)");
    return;
  }

  const session = sessions.get(chatId);
  if (!session || !session.data.serviceId || !session.data.bookingDate) return;

  session.data.bookingTime = parsed;
  session.state = "awaiting_phone";

  await sendMessage(token, chatId, `🕐 Heure: <b>${parsed}</b>\n\n📱 Veuillez entrer votre numéro de téléphone (ou envoyez votre contact via le bouton ci-dessous) :`, {
    reply_markup: {
      keyboard: [[{ text: "📱 Envoyer mon numéro", request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  });
}

async function handlePhoneReceived(token: string, agent: TelegramAgent, chatId: number, phone: string, name: string) {
  const session = sessions.get(chatId);
  if (!session || !session.data.serviceId || !session.data.bookingDate || !session.data.bookingTime) return;

  session.data.customerPhone = phone;
  session.state = "confirming";

  const label = agent.businessType === "restaurant" ? "Commande" : "Réservation";
  const text = `✅ <b>Récapitulatif de votre ${label}</b>\n\n` +
    `👤 Client: <b>${name}</b>\n` +
    `📱 Téléphone: <b>${phone}</b>\n` +
    `📝 ${label === "Commande" ? "Plat" : "Service"}: <b>${session.data.serviceName}</b>\n` +
    `📅 Date: <b>${session.data.bookingDate}</b>\n` +
    `🕐 Heure: <b>${session.data.bookingTime}</b>\n\n` +
    `Confirmez-vous cette ${label.toLowerCase()} ?`;

  const kb = inlineKeyboard([
    [
      { text: "✅ Confirmer", callback_data: "confirm" },
      { text: "❌ Annuler", callback_data: "cancel" },
    ],
  ]);

  await sendMessage(token, chatId, text, kb);
}

async function handleConfirm(token: string, agent: TelegramAgent, chatId: number, name: string) {
  const session = sessions.get(chatId);
  if (!session || !session.data.serviceId || !session.data.bookingDate || !session.data.bookingTime) return;

  const label = agent.businessType === "restaurant" ? "commande" : "réservation";

  createBooking({
    agentId: agent.id,
    companyId: agent.companyId,
    chatId: String(chatId),
    customerName: name,
    serviceId: session.data.serviceId,
    serviceName: session.data.serviceName,
    bookingDate: session.data.bookingDate,
    bookingTime: session.data.bookingTime,
    telegramMessageId: 0,
  });

  const text = `🎉 <b>${label.charAt(0).toUpperCase() + label.slice(1)} confirmée !</b>\n\n` +
    `Votre ${label} a bien été enregistrée.\n` +
    `Nous vous contacterons pour confirmation.\n\n` +
    `Merci de votre confiance ! 🙏`;

  const kb = inlineKeyboard([
    [{ text: "🔄 Nouvelle réservation", callback_data: "menu" }],
  ]);

  await sendMessage(token, chatId, text, kb);
  sessions.delete(chatId);
}

async function handleCancel(token: string, chatId: number) {
  sessions.delete(chatId);
  await sendMessage(token, chatId, "❌ Réservation annulée.\n\nUtilisez /start pour recommencer.");
}

async function handleContact(token: string, agent: TelegramAgent, chatId: number) {
  const parts: string[] = [];
  if (agent.phone) parts.push(`📞 <b>Téléphone</b>: ${agent.phone}`);
  if (agent.address) parts.push(`📍 <b>Adresse</b>: ${agent.address}`);
  if (parts.length === 0) parts.push("Aucune information de contact disponible.");

  const kb = inlineKeyboard([[{ text: "↩️ Retour", callback_data: "start" }]]);
  await sendMessage(token, chatId, parts.join("\n"), kb);
}

// ─── Date/Time Parsers ───────────────────────────────────────────

function parseDate(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const day = parseInt(d);
  const month = parseInt(m);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseTime(input: string): string | null {
  const match = input.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, h, m] = match;
  const hour = parseInt(h);
  const min = parseInt(m);
  if (hour < 0 || hour > 23 || min < 0 || min > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ─── Update Processing ───────────────────────────────────────────

async function processUpdate(token: string, agent: TelegramAgent, update: TelegramUpdate) {
  // Handle callback queries (button clicks)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.from.id;
    const data = cb.data;

    // Ensure session has correct agent context for callbacks
    const existingSession = sessions.get(chatId);
    if (!existingSession && data !== "start" && data !== "menu" && data !== "contact") {
      // Fresh callback without session — show menu
      await handleMenu(token, agent, chatId);
      return;
    }

    switch (data) {
      case "start":
        sessions.delete(chatId);
        await handleStart(token, agent, chatId, `${cb.from.first_name} ${cb.from.last_name || ""}`.trim());
        break;
      case "menu":
        await handleMenu(token, agent, chatId);
        break;
      case "contact":
        await handleContact(token, agent, chatId);
        break;
      case "confirm":
        await handleConfirm(token, agent, chatId, `${cb.from.first_name} ${cb.from.last_name || ""}`.trim());
        break;
      case "cancel":
        await handleCancel(token, chatId);
        break;
      default:
        if (data.startsWith("svc_")) {
          const serviceId = data.slice(4);
          await handleServiceSelected(token, agent, chatId, serviceId);
        }
    }
    return;
  }

  // Handle text messages
  if (update.message) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const name = getCustomerName(msg);

    // Handle contact sharing
    if (msg.contact) {
      const session = sessions.get(chatId);
      if (session && session.state === "awaiting_phone") {
        await handlePhoneReceived(token, agent, chatId, msg.contact.phone_number, msg.contact.first_name || name);
        return;
      }
    }

    if (!msg.text) return;
    const text = msg.text.trim();
    const session = sessions.get(chatId);

    // Command: /start
    if (text === "/start" || text === "/menu") {
      sessions.delete(chatId);
      await handleStart(token, agent, chatId, name);
      return;
    }

    // Session-based input
    if (session) {
      switch (session.state) {
        case "awaiting_date":
          await handleDateReceived(token, agent, chatId, text);
          break;
        case "awaiting_time":
          await handleTimeReceived(token, agent, chatId, text);
          break;
        case "awaiting_phone":
          await handlePhoneReceived(token, agent, chatId, text, name);
          break;
      }
      return;
    }

    // Default: show welcome
    await handleStart(token, agent, chatId, name);
  }
}

// ─── Polling Loop ─────────────────────────────────────────────────

async function pollAgent(token: string, agent: TelegramAgent) {
  const offset = offsets.get(token) || 0;
  const result = await telegramApi(token, "getUpdates", {
    offset: offset + 1,
    timeout: 1,
    allowed_updates: ["message", "callback_query"],
  });

  if (!result || !result.ok) {
    if (result && result.error_code === 401) {
      console.error(`[Bot] Invalid token for agent ${agent.name}, deactivating...`);
      db.query(`UPDATE TelegramAgent SET isActive = 0 WHERE id = ?`).run(agent.id);
      agentsMap.delete(token);
    }
    return;
  }

  const updates: TelegramUpdate[] = result.result || [];
  for (const update of updates) {
    offsets.set(token, update.update_id);
    try {
      await processUpdate(token, agent, update);
    } catch (err) {
      console.error(`[Bot] Error processing update ${update.update_id} for ${agent.name}:`, err);
    }
  }
}

async function pollAll() {
  for (const [token, agent] of agentsMap) {
    await pollAgent(token, agent).catch((err) => {
      console.error(`[Bot] Poll error for ${agent.name}:`, err);
    });
  }
}

// ─── Agent Refresh (every 30s) ───────────────────────────────────

function refreshAgents() {
  const fresh = loadActiveAgents();
  const newMap = new Map<string, TelegramAgent>();

  for (const agent of fresh) {
    if (!agentsMap.has(agent.token)) {
      console.log(`[Bot] New agent registered: ${agent.name} (${agent.businessType})`);
    }
    newMap.set(agent.token, agent);
  }

  // Remove deactivated agents
  for (const [token, agent] of agentsMap) {
    if (!newMap.has(token)) {
      console.log(`[Bot] Agent removed: ${agent.name}`);
      offsets.delete(token);
    }
  }

  agentsMap.clear();
  for (const [k, v] of newMap) agentsMap.set(k, v);
}

// ─── Health Endpoint ─────────────────────────────────────────────

const server = Bun.serve({
  port: 3005,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        agents: agentsMap.size,
        sessions: sessions.size,
        uptime: process.uptime(),
      });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`[Telegram Bot Service] Running on port ${server.port}`);

// ─── Startup ─────────────────────────────────────────────────────

refreshAgents();
console.log(`[Bot] Loaded ${agentsMap.size} active agent(s)`);

// Poll every 2 seconds
setInterval(pollAll, POLL_INTERVAL);

// Refresh agent list every 30 seconds
setInterval(refreshAgents, 30_000);
