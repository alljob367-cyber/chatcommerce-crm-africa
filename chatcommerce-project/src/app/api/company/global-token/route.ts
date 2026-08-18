import { NextResponse } from "next/server";
import { db, ensureBootstrapped, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";
import { checkPlanLimit, PLAN_LIMITS } from "@/lib/plan-limits";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// Verify a Telegram bot token is valid by calling getMe
async function verifyBotToken(botToken: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await res.json();
    if (data.ok && data.result?.username) {
      return { valid: true, username: data.result.username };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

// GET /api/company/global-token — get the current global bot token status
export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    const realCompanyId = await resolveCompanyId(session);

    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { globalBotToken: true, globalBotUsername: true },
    });

    if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

    return NextResponse.json({
      hasGlobalToken: !!company.globalBotToken,
      botUsername: company.globalBotUsername,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// POST /api/company/global-token — save + verify + optionally activate all agents
export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    const realCompanyId = await resolveCompanyId(session);

    // Ensure DB is bootstrapped before accessing company
    await ensureBootstrapped();

    const isAdmin = session.role === "super_admin" || session.userId === "admin-hardcoded-001";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse. Seul un administrateur peut configurer le token global." }, { status: 403 });
    }

    const body = await request.json();
    const { token: botToken, activateAll } = body;

    if (!botToken || typeof botToken !== "string") {
      return NextResponse.json({ error: "Token requis" }, { status: 400 });
    }

    // Verify the token
    const { valid, username } = await verifyBotToken(botToken.trim());
    if (!valid) {
      return NextResponse.json({ error: "Token Telegram invalide. Verifiez votre token BotFather." }, { status: 400 });
    }

    // Save to company
    await db.company.update({
      where: { id: realCompanyId },
      data: {
        globalBotToken: botToken.trim(),
        globalBotUsername: username ? `@${username}` : null,
      },
    });

    let activatedCount = 0;

    // If activateAll is true, propagate token to all agents and activate them
    if (activateAll) {
      // ─── CHECK PLAN LIMIT ───────────────────────────────
      const company = await db.company.findUnique({
        where: { id: realCompanyId },
        select: { plan: true },
      });
      const currentPlan = company?.plan || "starter";
      const currentAgentCount = await db.telegramAgent.count({
        where: { companyId: realCompanyId },
      });
      const limitError = await checkPlanLimit(currentPlan, "maxTelegramAgents", currentAgentCount);
      if (limitError) {
        return NextResponse.json({ error: limitError }, { status: 403 });
      }

      // Also limit how many we activate to not exceed the plan
      const maxAllowed = PLAN_LIMITS[currentPlan]?.maxTelegramAgents || PLAN_LIMITS.starter.maxTelegramAgents;

      const agents = await db.telegramAgent.findMany({
        where: { companyId: realCompanyId },
        orderBy: { createdAt: "asc" },
      });

      // Only activate up to the plan limit
      const agentsToActivate = agents.slice(0, maxAllowed);

      for (const agent of agentsToActivate) {
        await db.telegramAgent.update({
          where: { id: agent.id },
          data: {
            token: botToken.trim(),
            botUsername: username ? `@${username}` : null,
            isActive: true,
          },
        });
        activatedCount++;
      }

      // Set bot commands for all activated agents
      const businessTypes = agentsToActivate.map((a) => a.businessType);
      const uniqueTypes = [...new Set(businessTypes)];
      for (const bt of uniqueTypes) {
        const commands = bt === "restaurant" || bt === "braiseuse_poisson"
          ? [
              { command: "start", description: "Commencer une commande" },
              { command: "menu", description: "Voir le menu" },
              { command: "contact", description: "Nos coordonnees" },
              { command: "horaire", description: "Horaires d'ouverture" },
              { command: "commander", description: "Passer une commande" },
              { command: "payer", description: "Envoyer numero de transaction" },
              { command: "aide", description: "Comment utiliser le bot" },
            ]
          : [
              { command: "start", description: "Prendre rendez-vous" },
              { command: "services", description: "Nos prestations" },
              { command: "contact", description: "Nos coordonnees" },
              { command: "horaire", description: "Horaires d'ouverture" },
              { command: "aide", description: "Comment utiliser le bot" },
            ];

        try {
          await fetch(`https://api.telegram.org/bot${botToken.trim()}/setMyCommands`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ commands }),
          });
        } catch {
          // Non-blocking
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: activateAll
        ? `Token global configure et ${activatedCount} agents actives avec @${username} !`
        : `Token global configure. Bot: @${username}`,
      botUsername: username ? `@${username}` : null,
      activatedCount,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// DELETE /api/company/global-token — remove global token and deactivate all agents
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

    // Remove global token
    await db.company.update({
      where: { id: realCompanyId },
      data: { globalBotToken: null, globalBotUsername: null },
    });

    // Deactivate all agents that used this token
    const result = await db.telegramAgent.updateMany({
      where: { companyId: realCompanyId, token: { not: "" } },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: "Token global supprime et agents desactives",
      deactivatedCount: result.count,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
