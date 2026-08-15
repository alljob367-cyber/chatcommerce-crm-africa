import { NextResponse } from "next/server";
import { db, ensureBootstrapped, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// POST /api/telegram/webhook-setup
// Registers the Telegram webhook so Telegram sends messages to our API
export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    const realCompanyId = await resolveCompanyId(session);

    await ensureBootstrapped();

    const isAdmin = session.role === "super_admin" || session.userId === "admin-hardcoded-001";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse. Seul un administrateur peut configurer le webhook." }, { status: 403 });
    }

    // Get the company's global bot token
    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { globalBotToken: true, globalBotUsername: true },
    });

    if (!company?.globalBotToken) {
      return NextResponse.json({ error: "Pas de token global configure. Configurez d'abord le Token Bot Global." }, { status: 400 });
    }

    const botToken = company.globalBotToken;

    // Build the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://alljob367-cyber-chatcommerce-crm-af.vercel.app";
    const webhookUrl = `${baseUrl}/api/telegram/webhook?token=${encodeURIComponent(botToken)}`;

    // Register the webhook with Telegram
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=["message","edited_message"]`,
      { method: "GET" }
    );
    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({
        error: `Erreur Telegram: ${data.description || "Impossible d'enregistrer le webhook"}`,
      }, { status: 400 });
    }

    // Verify the webhook
    const verifyRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const verifyData = await verifyRes.json();

    return NextResponse.json({
      success: true,
      message: `Webhook enregistre avec succes ! Votre bot ${company.globalBotUsername || ""} est maintenant actif.`,
      webhookUrl,
      webhookInfo: {
        url: verifyData.result?.url,
        hasCustomCertificate: verifyData.result?.has_custom_certificate,
        pendingUpdateCount: verifyData.result?.pending_update_count,
        lastErrorDate: verifyData.result?.last_error_date,
        lastErrorMessage: verifyData.result?.last_error_message,
      },
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// DELETE /api/telegram/webhook-setup
// Remove the webhook (stop receiving messages)
export async function DELETE(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    const realCompanyId = await resolveCompanyId(session);

    await ensureBootstrapped();

    const isAdmin = session.role === "super_admin" || session.userId === "admin-hardcoded-001";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse." }, { status: 403 });
    }

    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { globalBotToken: true },
    });

    if (!company?.globalBotToken) {
      return NextResponse.json({ error: "Pas de token global." }, { status: 400 });
    }

    // Delete the webhook
    const res = await fetch(`https://api.telegram.org/bot${company.globalBotToken}/deleteWebhook`);
    const data = await res.json();

    return NextResponse.json({
      success: true,
      message: data.ok ? "Webhook supprime. Le bot ne recevra plus de messages." : "Erreur lors de la suppression.",
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
