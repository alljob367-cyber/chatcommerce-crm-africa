// ─────────────────────────────────────────────────────────────
// ChatCommerce CRM Africa — WhatsApp Cloud API Client
// Meta WhatsApp Business Platform integration
// ─────────────────────────────────────────────────────────────

const WA_API_BASE = "https://graph.facebook.com/v21.0";

export interface WhatsAppConfig {
  accessToken: string;
  phoneId: string;
  verifyToken?: string;
}

// ─── Get WhatsApp config from company ────────────────────────────

export async function getWhatsAppConfig(db: { company: { findUnique: (args: { where: { id: string }; select: Record<string, boolean> }) => Promise<Record<string, string | null | undefined>> } }, companyId: string): Promise<WhatsAppConfig | null> {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { whatsappToken: true, whatsappPhoneId: true },
  });
  if (!company?.whatsappToken || !company?.whatsappPhoneId) return null;
  return {
    accessToken: company.whatsappToken,
    phoneId: company.whatsappPhoneId,
  };
}

// ─── Verify WhatsApp webhook (Meta GET handshake) ────────────────

export function verifyWhatsAppWebhook(mode: string, token: string, verifyToken: string): boolean {
  return mode === "subscribe" && token === verifyToken;
}

// ─── Send WhatsApp Text Message ──────────────────────────────────

export async function sendTextMessage(
  config: WhatsAppConfig,
  to: string,
  text: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WA_API_BASE}/${config.phoneId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const data = await res.json();
    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: data.error?.message || JSON.stringify(data) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── Send WhatsApp Voice Message (audio URL) ─────────────────────

export async function sendVoiceMessage(
  config: WhatsAppConfig,
  to: string,
  audioUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WA_API_BASE}/${config.phoneId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "audio",
        audio: { link: audioUrl },
      }),
    });
    const data = await res.json();
    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: data.error?.message || JSON.stringify(data) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── Send WhatsApp Image Message ─────────────────────────────────

export async function sendImageMessage(
  config: WhatsAppConfig,
  to: string,
  imageUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WA_API_BASE}/${config.phoneId}/messages`;
    const body: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl },
    };
    if (caption) {
      (body.image as Record<string, unknown>).caption = caption;
    }
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: data.error?.message || JSON.stringify(data) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── Send WhatsApp Template Message ───────────────────────────────

export async function sendTemplateMessage(
  config: WhatsAppConfig,
  to: string,
  templateName: string,
  parameters?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const url = `${WA_API_BASE}/${config.phoneId}/messages`;
    const components = parameters
      ? [{ type: "body", parameters: parameters.map((p) => ({ type: "text", text: p })) }]
      : undefined;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: templateName, language: { code: "fr" }, components },
      }),
    });
    const data = await res.json();
    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    return { success: false, error: data.error?.message || JSON.stringify(data) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ─── Media Upload (for local files → WhatsApp media ID) ───────────

export async function uploadMedia(
  config: WhatsAppConfig,
  mediaUrl: string,
  type: "audio" | "image" | "video" | "document"
): Promise<{ mediaId?: string; error?: string }> {
  try {
    const url = `${WA_API_BASE}/${config.phoneId}/media`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        type,
        [type]: { link: mediaUrl },
      }),
    });
    const data = await res.json();
    if (data.id) {
      return { mediaId: data.id };
    }
    return { error: data.error?.message || "Upload failed" };
  } catch (error) {
    return { error: String(error) };
  }
}

// ─── Parse incoming WhatsApp webhook body ─────────────────────────

export interface IncomingWhatsAppMessage {
  from: string;       // phone number with country code
  messageId: string;  // WhatsApp message ID
  type: string;      // text, audio, image, interactive, etc.
  text?: string;     // text content
  timestamp: string;
  contactName?: string;
}

export function parseIncomingMessage(body: Record<string, unknown>): IncomingWhatsAppMessage | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = (body as any).entry?.[0];
  if (!entry) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const change = entry.changes?.[0];
  if (!change) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = change.value as any;
  if (value?.statuses) return null; // Ignore status updates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msg = value.messages?.[0] as any;
  if (!msg) return null;
  return {
    from: msg.from,
    messageId: msg.id,
    type: msg.type || "text",
    text: msg.text?.body || "",
    timestamp: msg.timestamp || String(Math.floor(Date.now() / 1000)),
    contactName: value.contacts?.[0]?.profile?.name,
  };
}
