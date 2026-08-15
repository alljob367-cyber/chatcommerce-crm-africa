import { NextResponse } from "next/server";
import { db, ensureBootstrapped, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

async function setTelegramCommands(botToken: string, businessType: string) {
  const commands = businessType === "restaurant" 
    ? [
        { command: "start", description: "Commencer une commande" },
        { command: "menu", description: "Voir le menu" },
        { command: "contact", description: "Nos coordonnées" },
        { command: "horaire", description: "Horaires d'ouverture" },
        { command: "aide", description: "Comment utiliser le bot" },
      ]
    : [
        { command: "start", description: "Prendre rendez-vous" },
        { command: "services", description: "Nos prestations" },
        { command: "contact", description: "Nos coordonnées" },
        { command: "horaire", description: "Horaires d'ouverture" },
        { command: "aide", description: "Comment utiliser le bot" },
      ];

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commands }),
    });
  } catch {
    // Non-blocking: commands will be set next time the bot polls
  }
}

async function verifyBotToken(botToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    return data.ok === true && data.result?.username;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const realCompanyId = await resolveCompanyId(session);

    await ensureBootstrapped();

    const body = await request.json();
    const { agentId, token: botToken } = body;

    if (!agentId || !botToken) {
      return NextResponse.json({ error: "ID agent et token requis" }, { status: 400 });
    }

    // Verify the agent belongs to this company
    const agent = await db.telegramAgent.findFirst({
      where: { id: agentId, companyId: realCompanyId },
    });
    if (!agent) return NextResponse.json({ error: "Agent introuvable" }, { status: 404 });

    // Verify the bot token is valid
    const isValid = await verifyBotToken(botToken);
    if (!isValid) {
      return NextResponse.json({ error: "Token Telegram invalide. Vérifiez votre token BotFather." }, { status: 400 });
    }

    // Get bot info
    let botUsername: string | null = null;
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const meData = await meRes.json();
      if (meData.ok) {
        botUsername = meData.result.username;
      }
    } catch {
      // Continue without username
    }

    // Update agent with real token and activate
    const updated = await db.telegramAgent.update({
      where: { id: agentId },
      data: {
        token: botToken,
        botUsername: botUsername ? `@${botUsername}` : null,
        isActive: true,
      },
    });

    // Set Telegram commands
    await setTelegramCommands(botToken, agent.businessType);

    return NextResponse.json({
      success: true,
      message: `Agent "${updated.name}" activé avec succès !`,
      agent: updated,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
