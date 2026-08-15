// ============================================================
// AGENTS DIAGNOSTIC & MISTRAL AI SETUP
// POST /api/telegram/agents/setup-ai
// ============================================================
// Admin-only endpoint that:
// 1. Lists all agents with their status
// 2. Enables Mistral AI on all active agents
// 3. Configures Telegram webhooks
// 4. Tests the Mistral API key
// ============================================================

import { NextResponse } from "next/server";
import { db, ensureBootstrapped, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://alljob367-cyber-chatcommerce-crm-af.vercel.app";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return await verifyToken(token);
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);
    await ensureBootstrapped();

    const isAdmin = session.role === "super_admin" || session.userId === "admin-hardcoded-001";
    if (!isAdmin) {
      return NextResponse.json({ error: "Accès refusé. Administrateur requis." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action || "full"; // "full" | "enable_ai" | "webhooks" | "test_mistral"
    const mistralKey = body.mistralApiKey || process.env.MISTRAL_API_KEY || "";
    if (!mistralKey && (action === "full" || action === "enable_ai" || action === "test_mistral")) {
      return NextResponse.json({ error: "Clé API Mistral requise. Passez mistralApiKey dans le body ou configurez MISTRAL_API_KEY." }, { status: 400 });
    }

    const results: Record<string, unknown> = {};

    // 1. List all agents for this company
    const agents = await db.telegramAgent.findMany({
      where: { companyId: realCompanyId },
      include: {
        company: { select: { name: true, plan: true } },
        services: { where: { isActive: true }, select: { id: true, name: true, price: true } },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    results.agentsCount = agents.length;
    results.agents = agents.map((a) => {
      let aiEnabled = false;
      try { aiEnabled = JSON.parse(a.aiConfig || "{}").enabled === true; } catch { /* ignore */ }
      return {
        id: a.id,
        name: a.name,
        botUsername: a.botUsername,
        isActive: a.isActive,
        hasToken: !!a.token,
        businessType: a.businessType,
        servicesCount: a.services.length,
        bookingsCount: a._count.bookings,
        aiEnabled,
        paymentMethod: a.paymentMethod,
      };
    });

    // 2. Enable Mistral AI on all active agents
    if (action === "full" || action === "enable_ai") {
      let enabledCount = 0;
      let skippedCount = 0;
      const details: Array<{ name: string; status: string }> = [];

      for (const agent of agents) {
        if (!agent.isActive) {
          details.push({ name: agent.name, status: "skipped_inactive" });
          skippedCount++;
          continue;
        }

        let currentConfig: Record<string, unknown> = {};
        if (agent.aiConfig) {
          try {
            currentConfig = JSON.parse(agent.aiConfig);
          } catch {
            // Invalid JSON — will overwrite
          }
        }

        if (currentConfig.enabled === true && currentConfig.provider === "mistral" && currentConfig.apiKey) {
          details.push({ name: agent.name, status: "already_enabled" });
          skippedCount++;
          continue;
        }

        const newConfig = {
          enabled: true,
          provider: "mistral",
          apiKey: mistralKey,
          model: currentConfig.model || "mistral-small-latest",
          systemPrompt: currentConfig.systemPrompt || "",
          temperature: currentConfig.temperature || 0.7,
          maxTokens: currentConfig.maxTokens || 500,
          baseUrl: currentConfig.baseUrl || "",
        };

        await db.telegramAgent.update({
          where: { id: agent.id },
          data: { aiConfig: JSON.stringify(newConfig) },
        });

        details.push({ name: agent.name, status: "enabled_mistral" });
        enabledCount++;
      }

      results.aiSetup = { enabled: enabledCount, skipped: skippedCount, details };
    }

    // 3. Configure webhooks for all active agents with tokens
    if (action === "full" || action === "webhooks") {
      let configured = 0;
      let failed = 0;
      const webhookDetails: Array<{ name: string; botUsername: string | null; status: string; error?: string }> = [];

      for (const agent of agents) {
        if (!agent.token || !agent.isActive) {
          webhookDetails.push({ name: agent.name, botUsername: agent.botUsername, status: "skipped" });
          continue;
        }

        try {
          const webhookUrl = `${APP_URL}/api/telegram/webhook?token=${encodeURIComponent(agent.token)}`;
          const res = await fetch(
            `https://api.telegram.org/bot${agent.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=["message","edited_message","callback_query"]`
          );
          const data = await res.json() as { ok: boolean; description?: string };

          if (data.ok) {
            webhookDetails.push({ name: agent.name, botUsername: agent.botUsername, status: "configured" });
            configured++;
          } else {
            webhookDetails.push({ name: agent.name, botUsername: agent.botUsername, status: "error", error: data.description });
            failed++;
          }
        } catch (err) {
          webhookDetails.push({ name: agent.name, botUsername: agent.botUsername, status: "error", error: String(err) });
          failed++;
        }
      }

      results.webhooks = { configured, failed, details: webhookDetails };
    }

    // 4. Test Mistral API key
    if (action === "full" || action === "test_mistral") {
      try {
        const mistralRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${mistralKey}`,
          },
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [
              { role: "system", content: "Tu es un assistant test. Réponds en 1 phrase courte." },
              { role: "user", content: "Dis bonjour en français." },
            ],
            temperature: 0.7,
            max_tokens: 50,
          }),
        });

        if (mistralRes.ok) {
          const data = await mistralRes.json() as { choices: Array<{ message: { content: string } }> };
          const reply = data.choices?.[0]?.message?.content || "(pas de réponse)";
          results.mistralTest = { valid: true, response: reply };
        } else {
          const errText = await mistralRes.text();
          results.mistralTest = { valid: false, error: `Status ${mistralRes.status}: ${errText}` };
        }
      } catch (err) {
        results.mistralTest = { valid: false, error: String(err) };
      }
    }

    return NextResponse.json({
      success: true,
      message: "Diagnostic terminé avec succès",
      ...results,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
