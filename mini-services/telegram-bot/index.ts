// ═══════════════════════════════════════════════════════════════
// TELEGRAM BOT MINI-SERVICE — Restaurant & Salon Booking Bots
// Polls Telegram getUpdates for all active agents every 2 seconds
// Features: multi-service orders, open hours check, /horaire, /aide
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
  address: string | null;
  phone: string | null;
  openHours: string | null;
  currency: string;
  paymentMethod: string | null;
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

interface CartItem {
  serviceId: string;
  serviceName: string;
  price: number;
  quantity: number;
}

interface UserSession {
  agentId: string;
  agentToken: string;
  state: string;
  data: Record<string, string>;
  cart: CartItem[];
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
    disable_web_page_preview: true,
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  return telegramApi(token, "sendMessage", body);
}

async function answerCallbackQuery(token: string, callbackQueryId: string, text?: string) {
  return telegramApi(token, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text || "",
  });
}

function inlineKeyboard(rows: Array<Array<{ text: string; callback_data: string }>>): Record<string, unknown> {
  return { inline_keyboard: rows };
}

function removeKeyboard(): Record<string, unknown> {
  return { remove_keyboard: true };
}

// ─── Database Helpers ─────────────────────────────────────────────

function loadActiveAgents(): TelegramAgent[] {
  return db.query(
    `SELECT id, token, name, botUsername, businessType, isActive, welcomeMessage, 
            address, phone, openHours, currency, paymentMethod, companyId
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
  customerPhone: string; serviceId: string; serviceName: string;
  bookingDate: string; bookingTime: string; notes: string;
  telegramMessageId: number;
}) {
  db.query(
    `INSERT INTO TelegramBooking (id, agentId, companyId, chatId, customerName, customerPhone,
     serviceId, serviceName, bookingDate, bookingTime, notes, status, telegramMessageId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  ).run(
    generateId(), data.agentId, data.companyId, data.chatId, data.customerName,
    data.customerPhone, data.serviceId, data.serviceName,
    data.bookingDate, data.bookingTime, data.notes, data.telegramMessageId
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

// ─── Open Hours Helpers ───────────────────────────────────────────

const DAY_KEYS: Record<string, string> = {
  "1": "lun", "2": "mar", "3": "mer", "4": "jeu",
  "5": "ven", "6": "sam", "0": "dim",
};

const DAY_NAMES: Record<string, string> = {
  lun: "Lundi", mar: "Mardi", mer: "Mercredi", jeu: "Jeudi",
  ven: "Vendredi", sam: "Samedi", dim: "Dimanche",
};

function isOpenNow(agent: TelegramAgent): { open: boolean; hours?: string } {
  if (!agent.openHours) return { open: true }; // No hours = always open
  try {
    const hours = JSON.parse(agent.openHours) as Record<string, string>;
    const now = new Date();
    const dayKey = DAY_KEYS[String(now.getDay())] || "lun";
    const todayHours = hours[dayKey];
    if (!todayHours) return { open: false };
    const [open, close] = todayHours.split("-").map((t: string) => t.trim());
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [oh, om] = open.split(":").map(Number);
    const [ch, cm] = close.split(":").map(Number);
    return {
      open: currentMinutes >= oh * 60 + om && currentMinutes <= ch * 60 + cm,
      hours: todayHours,
    };
  } catch {
    return { open: true };
  }
}

function formatOpenHours(agent: TelegramAgent): string {
  if (!agent.openHours) return "Non défini";
  try {
    const hours = JSON.parse(agent.openHours) as Record<string, string>;
    const lines = Object.entries(DAY_NAMES)
      .map(([key, name]) => {
        const h = hours[key];
        return h ? `  <b>${name}</b>: ${h}` : `  <b>${name}</b>: Fermé`;
      });
    return lines.join("\n");
  } catch {
    return "Erreur de format";
  }
}

// ─── Bot Conversation Handlers ───────────────────────────────────

function getCustomerName(msg: NonNullable<TelegramUpdate["message"]>): string {
  const parts = [msg.chat.first_name, msg.chat.last_name].filter(Boolean);
  return parts.join(" ") || "Client";
}

function getSession(chatId: number, agent: TelegramAgent): UserSession {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      agentId: agent.id,
      agentToken: agent.token,
      state: "idle",
      data: {},
      cart: [],
    });
  }
  const session = sessions.get(chatId)!;
  session.agentId = agent.id;
  session.agentToken = agent.token;
  return session;
}

async function handleStart(token: string, agent: TelegramAgent, chatId: number, name: string) {
  const session = getSession(chatId, agent);
  session.state = "idle";
  session.data = {};
  session.cart = [];

  const openStatus = isOpenNow(agent);
  const openNotice = !openStatus.open
    ? `\n\n⚠️ <i>Nous sommes actuellement fermés. Vous pouvez quand même parcourir notre menu et réserver pour plus tard.</i>`
    : "";

  const BUSINESS_ICONS: Record<string, string> = {
    restaurant: "🍽️", salon_coiffure: "✂️💅", pharmacie: "💊🏥",
    taxi_transport: "🚕", pressing_laverie: "👔✨", ecole_formation: "📚🎓",
    supermarche: "🛒🥘", clinique: "🏥❤️", agence_voyage: "✈️🌍",
    boulangerie: "🥖🥐", garage_auto: "🔧🚗", salle_sport: "💪🏋️",
  };
  const BUSINESS_MENU_LABEL: Record<string, string> = {
    restaurant: "🍽️ Voir le Menu", salon_coiffure: "💇 Nos Services",
    pharmacie: "💊 Nos Produits", taxi_transport: "🚕 Réserver Course",
    pressing_laverie: "👔 Nos Services", ecole_formation: "📚 Nos Formations",
    supermarche: "🛒 Nos Produits", clinique: "🏥 Nos Consultations",
    agence_voyage: "✈️ Nos Offres", boulangerie: "🥖 Nos Produits",
    garage_auto: "🔧 Nos Services", salle_sport: "🏋️ Nos Cours",
  };
  const BUSINESS_ORDER_LABEL: Record<string, string> = {
    restaurant: "📦 Ma Commande", salon_coiffure: "📋 Ma Réservation",
    pharmacie: "🛒 Ma Commande", taxi_transport: "🚕 Ma Course",
    pressing_laverie: "📦 Ma Commande", ecole_formation: "📝 Mon Inscription",
    supermarche: "🛒 Ma Commande", clinique: "📋 Mon Rendez-vous",
    agence_voyage: "✈️ Ma Réservation", boulangerie: "📦 Ma Commande",
    garage_auto: "🔧 Mon RDV", salle_sport: "💪 Mon Abonnement",
  };
  const icon = BUSINESS_ICONS[agent.businessType] || "🤖";
  const menuLabel = BUSINESS_MENU_LABEL[agent.businessType] || "📋 Nos Services";
  const orderLabel = BUSINESS_ORDER_LABEL[agent.businessType] || "📦 Ma Commande";

  const welcome = agent.welcomeMessage ||
    `Bienvenue chez <b>${agent.name}</b> ! ${icon}\n\nCommandez et réservez directement ici.\nService rapide et fiable ! ⚡`;

  const kb = inlineKeyboard([
    [
      { text: menuLabel, callback_data: "menu" },
      { text: orderLabel, callback_data: "cart" },
    ],
    [
      { text: "📞 Contact", callback_data: "contact" },
      { text: "🕐 Horaires", callback_data: "horaire" },
    ],
  ]);

  await sendMessage(token, chatId, welcome + openNotice, kb);
}

async function handleMenu(token: string, agent: TelegramAgent, chatId: number) {
  const services = getAgentServices(agent.id);
  if (services.length === 0) {
    await sendMessage(token, chatId, "😕 Aucun service disponible pour le moment. Revenez plus tard !");
    return;
  }

  const BUSINESS_TITLE: Record<string, string> = {
    restaurant: "🍽️ <b>Notre Menu</b>", salon_coiffure: "💇 <b>Nos Prestations</b>",
    pharmacie: "💊 <b>Nos Produits</b>", taxi_transport: "🚕 <b>Nos Courses</b>",
    pressing_laverie: "👔 <b>Nos Services</b>", ecole_formation: "📚 <b>Nos Formations</b>",
    supermarche: "🛒 <b>Nos Produits</b>", clinique: "🏥 <b>Nos Consultations</b>",
    agence_voyage: "✈️ <b>Nos Offres</b>", boulangerie: "🥖 <b>Nos Produits</b>",
    garage_auto: "🔧 <b>Nos Services</b>", salle_sport: "🏋️ <b>Nos Cours</b>",
  };
  const isResto = agent.businessType === "restaurant";
  let text = (BUSINESS_TITLE[agent.businessType] || "📋 <b>Nos Services</b>") + "\n\n";
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (const svc of services) {
    const priceStr = `${svc.price.toLocaleString()} ${agent.currency}`;
    text += `• <b>${svc.name}</b> — ${priceStr}`;
    if (svc.duration) text += ` (${svc.duration}min)`;
    text += "\n";
    if (svc.description) text += `  <i>${svc.description}</i>\n`;
    rows.push([{ text: `➕ ${svc.name}`, callback_data: `add_${svc.id}` }]);
  }

  // Add "view cart" row
  text += `\n👆 Tapez sur un service pour l'ajouter à votre commande.`;

  const kb = inlineKeyboard([
    ...rows,
    [
      { text: "📦 Voir ma commande", callback_data: "cart" },
      { text: "↩️ Retour", callback_data: "start" },
    ],
  ]);

  await sendMessage(token, chatId, text, kb);
}

async function handleAddToCart(token: string, agent: TelegramAgent, chatId: number, serviceId: string) {
  const services = getAgentServices(agent.id);
  const svc = services.find(s => s.id === serviceId);
  if (!svc) {
    await sendMessage(token, chatId, "❌ Service introuvable.");
    return;
  }

  const session = getSession(chatId, agent);

  // Check if already in cart
  const existing = session.cart.find(c => c.serviceId === serviceId);
  if (existing) {
    existing.quantity += 1;
  } else {
    session.cart.push({
      serviceId: svc.id,
      serviceName: svc.name,
      price: svc.price,
      quantity: 1,
    });
  }

  const priceStr = `${svc.price.toLocaleString()} ${agent.currency}`;
  await sendMessage(token, chatId,
    `✅ <b>${svc.name}</b> ajouté ! (${priceStr})\n\n` +
    `Total: <b>${session.cart.length}</b> article(s) dans votre commande.\n` +
    `Tapez 📦 pour voir votre commande ou ajoutez d'autres services.`
  );
}

async function handleViewCart(token: string, agent: TelegramAgent, chatId: number) {
  const session = getSession(chatId, agent);

  if (session.cart.length === 0) {
    await sendMessage(token, chatId,
      "🛒 Votre commande est vide.\n\nAjoutez des services depuis le menu !",
      inlineKeyboard([
        [{ text: "🍽️ Voir le Menu", callback_data: "menu" }],
        [{ text: "↩️ Retour", callback_data: "start" }],
      ])
    );
    return;
  }

  const CART_TITLE: Record<string, string> = {
    restaurant: "🛒 <b>Votre Commande</b>", salon_coiffure: "📋 <b>Votre Réservation</b>",
    pharmacie: "🛒 <b>Votre Commande</b>", taxi_transport: "🚕 <b>Votre Course</b>",
    pressing_laverie: "📦 <b>Votre Commande</b>", ecole_formation: "📝 <b>Votre Inscription</b>",
    supermarche: "🛒 <b>Votre Commande</b>", clinique: "📋 <b>Votre RDV</b>",
    agence_voyage: "✈️ <b>Votre Réservation</b>", boulangerie: "📦 <b>Votre Commande</b>",
    garage_auto: "🔧 <b>Votre RDV</b>", salle_sport: "💪 <b>Votre Abonnement</b>",
  };
  const isResto = agent.businessType === "restaurant";
  let total = 0;
  let text = (CART_TITLE[agent.businessType] || "🛒 <b>Votre Commande</b>") + "\n\n";

  for (const item of session.cart) {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    text += `• ${item.quantity}x <b>${item.serviceName}</b> — ${itemTotal.toLocaleString()} ${agent.currency}\n`;
  }

  text += `\n💰 <b>Total: ${total.toLocaleString()} ${agent.currency}</b>`;

  if (agent.paymentMethod) {
    const pm = agent.paymentMethod === "orange_money" ? "Orange Money" : agent.paymentMethod === "mtn_money" ? "MTN Mobile Money" : agent.paymentMethod;
    text += `\n💳 Paiement: ${pm}`;
  }

  const kb = inlineKeyboard([
    [
      { text: "✅ Commander / Réserver", callback_data: "checkout" },
      { text: "🗑️ Vider", callback_data: "clear_cart" },
    ],
    [
      { text: "➕ Ajouter encore", callback_data: "menu" },
      { text: "↩️ Retour", callback_data: "start" },
    ],
  ]);

  await sendMessage(token, chatId, text, kb);
}

async function handleClearCart(token: string, agent: TelegramAgent, chatId: number) {
  const session = getSession(chatId, agent);
  session.cart = [];
  await sendMessage(token, chatId,
    "🗑️ Votre commande a été vidée.\n\nParcourez notre menu pour recommencer !",
    inlineKeyboard([
      [{ text: "🍽️ Voir le Menu", callback_data: "menu" }],
      [{ text: "↩️ Retour", callback_data: "start" }],
    ])
  );
}

async function handleCheckout(token: string, agent: TelegramAgent, chatId: number) {
  const session = getSession(chatId, agent);

  if (session.cart.length === 0) {
    await sendMessage(token, chatId, "😕 Votre commande est vide. Ajoutez d'abord des services !");
    return;
  }

  // Build a summary of all services
  const serviceNames = session.cart.map(c => `${c.quantity}x ${c.serviceName}`).join(", ");
  const total = session.cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  session.state = "awaiting_date";
  session.data.serviceNames = serviceNames;
  session.data.total = String(total);

  // For single item, store individual service info too
  if (session.cart.length === 1) {
    session.data.serviceId = session.cart[0].serviceId;
    session.data.serviceName = session.cart[0].serviceName;
  }

  const isResto = agent.businessType === "restaurant";
  const label = isResto ? "commande" : "réservation";

  await sendMessage(token, chatId,
    `📅 <b>Étape 1/3</b>\n\n` +
    `Quelle date souhaitez-vous pour votre ${label} ?\n` +
    `<i>Format: JJ/MM/AAAA (ex: 25/12/2026)</i>`,
    removeKeyboard()
  );
}

async function handleDateReceived(token: string, agent: TelegramAgent, chatId: number, dateStr: string) {
  const parsed = parseDate(dateStr);
  if (!parsed) {
    await sendMessage(token, chatId, "❌ Date invalide. Utilisez le format JJ/MM/AAAA (ex: 25/12/2026)");
    return;
  }

  const session = sessions.get(chatId);
  if (session) {
    session.data.bookingDate = parsed;
    session.state = "awaiting_time";
  }

  await sendMessage(token, chatId,
    `✅ Date: <b>${parsed}</b>\n\n` +
    `🕐 <b>Étape 2/3</b>\n\n` +
    `Quelle heure souhaitez-vous ?\n` +
    `<i>Format: HH:MM (ex: 14:30)</i>`
  );
}

async function handleTimeReceived(token: string, agent: TelegramAgent, chatId: number, timeStr: string) {
  const parsed = parseTime(timeStr);
  if (!parsed) {
    await sendMessage(token, chatId, "❌ Heure invalide. Utilisez le format HH:MM (ex: 14:30)");
    return;
  }

  const session = sessions.get(chatId);
  if (!session) return;

  session.data.bookingTime = parsed;
  session.state = "awaiting_phone";

  await sendMessage(token, chatId,
    `✅ Heure: <b>${parsed}</b>\n\n` +
    `📱 <b>Étape 3/3</b>\n\n` +
    `Veuillez entrer votre numéro de téléphone\n` +
    `<i>(ou envoyez votre contact via le bouton ci-dessous)</i>`,
    {
      reply_markup: {
        keyboard: [[{ text: "📱 Envoyer mon numéro", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }
  );
}

async function handlePhoneReceived(token: string, agent: TelegramAgent, chatId: number, phone: string, name: string) {
  const session = sessions.get(chatId);
  if (!session || !session.data.bookingDate || !session.data.bookingTime) return;

  session.data.customerPhone = phone;
  session.state = "confirming";

  const isResto = agent.businessType === "restaurant";
  const label = isResto ? "Commande" : "Réservation";
  const total = parseInt(session.data.total || "0");

  let text = `✅ <b>Récapitulatif de votre ${label}</b>\n\n` +
    `👤 Client: <b>${name}</b>\n` +
    `📱 Téléphone: <b>${phone}</b>\n` +
    `📝 Détails: <b>${session.data.serviceNames}</b>\n`;

  if (isResto) {
    text += `💰 Total: <b>${total.toLocaleString()} ${agent.currency}</b>\n`;
    if (agent.paymentMethod) {
      const pm = agent.paymentMethod === "orange_money" ? "Orange Money" : agent.paymentMethod === "mtn_money" ? "MTN Mobile Money" : agent.paymentMethod;
      text += `💳 Paiement: <b>${pm}</b>\n`;
    }
  }

  text += `\n📅 Date: <b>${session.data.bookingDate}</b>\n` +
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
  if (!session || !session.data.bookingDate || !session.data.bookingTime) return;

  const isResto = agent.businessType === "restaurant";
  const label = isResto ? "commande" : "réservation";
  const total = parseInt(session.data.total || "0");

  // Create a booking record for each item in cart (or single booking)
  const serviceId = session.data.serviceId || session.cart[0]?.serviceId || "";
  const serviceName = session.data.serviceName || session.cart.map(c => c.serviceName).join(", ");

  createBooking({
    agentId: agent.id,
    companyId: agent.companyId,
    chatId: String(chatId),
    customerName: name,
    customerPhone: session.data.customerPhone || "",
    serviceId,
    serviceName,
    bookingDate: session.data.bookingDate,
    bookingTime: session.data.bookingTime,
    notes: session.data.serviceNames,
    telegramMessageId: 0,
  });

  let text = `🎉 <b>${label.charAt(0).toUpperCase() + label.slice(1)} confirmée !</b>\n\n` +
    `Merci <b>${name}</b> !\n` +
    `Votre ${label} a bien été enregistrée.\n`;

  if (isResto && total > 0) {
    text += `💰 Total: <b>${total.toLocaleString()} ${agent.currency}</b>\n`;
  }

  text += `\nNous vous contacterons pour confirmation.\n\n` +
    `Merci de votre confiance ! 🙏`;

  const kb = inlineKeyboard([
    [
      { text: "🔄 Nouvelle commande", callback_data: "menu" },
      { text: "📞 Contact", callback_data: "contact" },
    ],
  ]);

  await sendMessage(token, chatId, text, kb, removeKeyboard());
  sessions.delete(chatId);
}

async function handleCancel(token: string, chatId: number) {
  sessions.delete(chatId);
  await sendMessage(token, chatId,
    "❌ Commande annulée.\n\nUtilisez /start pour recommencer.",
    removeKeyboard()
  );
}

async function handleContact(token: string, agent: TelegramAgent, chatId: number) {
  const parts: string[] = [];
  parts.push(`<b>${agent.name}</b>`);
  if (agent.phone) parts.push(`📞 <b>Téléphone</b>: ${agent.phone}`);
  if (agent.address) parts.push(`📍 <b>Adresse</b>: ${agent.address}`);
  if (agent.paymentMethod) {
    const pm = agent.paymentMethod === "orange_money" ? "Orange Money" : agent.paymentMethod === "mtn_money" ? "MTN Mobile Money" : agent.paymentMethod;
    parts.push(`💳 <b>Paiement</b>: ${pm}`);
  }
  if (parts.length <= 1) parts.push("Aucune information de contact disponible.");

  const kb = inlineKeyboard([[{ text: "↩️ Retour", callback_data: "start" }]]);
  await sendMessage(token, chatId, parts.join("\n"), kb);
}

async function handleHoraires(token: string, agent: TelegramAgent, chatId: number) {
  const status = isOpenNow(agent);
  const statusText = status.open ? "🟢 <b>OUVERT</b>" : "🔴 <b>FERMÉ</b>";
  const nowText = status.hours ? `\nHeures du jour: <b>${status.hours}</b>` : "";

  const text = `🕐 <b>Horaires d'ouverture</b>\n\n` +
    `${statusText}${nowText}\n\n${formatOpenHours(agent)}`;

  const kb = inlineKeyboard([[{ text: "↩️ Retour", callback_data: "start" }]]);
  await sendMessage(token, chatId, text, kb);
}

async function handleAide(token: string, agent: TelegramAgent, chatId: number) {
  const isResto = agent.businessType === "restaurant";

  const text = `❓ <b>Comment utiliser ce bot</b>\n\n` +
    `1️⃣ Tapez <b>/start</b> pour commencer\n` +
    `2️⃣ Parcourez notre ${isResto ? "menu" : "liste de services"} et ajoutez à votre commande\n` +
    `3️⃣ Consultez votre commande avec 📦\n` +
    `4️⃣ Confirmez et choisissez date, heure et téléphone\n` +
    `5️⃣ Recevez une confirmation !\n\n` +
    `<b>Commandes disponibles :</b>\n` +
    `/start — Commencer\n` +
    `/menu — Voir le ${isResto ? "menu" : "catalogue"}\n` +
    `/horaire — Nos horaires\n` +
    `/contact — Nos coordonnées\n` +
    `/aide — Cette aide`;

  const kb = inlineKeyboard([[{ text: "↩️ Retour au début", callback_data: "start" }]]);
  await sendMessage(token, chatId, text, kb);
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

    // Acknowledge callback
    await answerCallbackQuery(token, cb.id);

    switch (data) {
      case "start":
        sessions.delete(chatId);
        await handleStart(token, agent, chatId, `${cb.from.first_name} ${cb.from.last_name || ""}`.trim());
        break;
      case "menu":
        await handleMenu(token, agent, chatId);
        break;
      case "cart":
        await handleViewCart(token, agent, chatId);
        break;
      case "clear_cart":
        await handleClearCart(token, agent, chatId);
        break;
      case "checkout":
        await handleCheckout(token, agent, chatId);
        break;
      case "contact":
        await handleContact(token, agent, chatId);
        break;
      case "horaire":
        await handleHoraires(token, agent, chatId);
        break;
      case "confirm":
        await handleConfirm(token, agent, chatId, `${cb.from.first_name} ${cb.from.last_name || ""}`.trim());
        break;
      case "cancel":
        await handleCancel(token, chatId);
        break;
      default:
        if (data.startsWith("add_")) {
          const serviceId = data.slice(4);
          await handleAddToCart(token, agent, chatId, serviceId);
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

    // Commands
    if (text === "/start") {
      sessions.delete(chatId);
      await handleStart(token, agent, chatId, name);
      return;
    }
    if (text === "/menu" || text === "/services") {
      await handleMenu(token, agent, chatId);
      return;
    }
    if (text === "/horaire" || text === "/hours") {
      await handleHoraires(token, agent, chatId);
      return;
    }
    if (text === "/contact") {
      await handleContact(token, agent, chatId);
      return;
    }
    if (text === "/aide" || text === "/help") {
      await handleAide(token, agent, chatId);
      return;
    }

    // Session-based input
    if (session && session.agentId === agent.id) {
      switch (session.state) {
        case "awaiting_date":
          await handleDateReceived(token, agent, chatId, text);
          return;
        case "awaiting_time":
          await handleTimeReceived(token, agent, chatId, text);
          return;
        case "awaiting_phone":
          await handlePhoneReceived(token, agent, chatId, text, name);
          return;
      }
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
