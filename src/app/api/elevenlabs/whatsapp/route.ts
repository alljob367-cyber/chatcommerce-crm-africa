import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleError } from "@/lib/security";
import {
  listWhatsAppAccounts,
  updateWhatsAppAccount,
  assignAgentToWhatsApp,
  isPlatformKeyConfigured,
  type WhatsAppAccount,
} from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: List WhatsApp accounts (platform-managed) ───────
// ElevenLabs gere les comptes WhatsApp directement.
// Cette route liste les comptes disponibles et les agents assignes.

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    if (!isPlatformKeyConfigured()) {
      return NextResponse.json({
        accounts: [],
        platformReady: false,
        message: "Service WhatsApp en cours d'activation.",
      });
    }

    // List WhatsApp accounts from ElevenLabs
    const accounts = await listWhatsAppAccounts();

    // Enrich with our DB agent info
    const dbAgents = await db.elevenLabsAgent.findMany({
      where: { companyId: session.companyId, elevenAgentId: { not: null } },
      select: { id: true, name: true, elevenAgentId: true, businessType: true, isActive: true },
    });

    const enriched = accounts.map((acc: WhatsAppAccount) => {
      const agentId = acc.agent_id || "";
      const matched = dbAgents.find((a) => a.elevenAgentId === agentId);
      return {
        id: acc.id,
        phoneNumber: acc.phone_number,
        phoneNumberId: acc.phone_number_id,
        agentId,
        agentName: matched?.name || acc.agent_name || null,
        ourAgentId: matched?.id || null,
        enabledMessaging: acc.enabled_messaging,
        enabledAudioResponse: acc.enabled_audio_response,
        enabledTypingIndicator: acc.enabled_typing_indicator,
        isOurs: !!matched,
      };
    });

    return NextResponse.json({
      accounts: enriched,
      platformReady: true,
      totalAccounts: enriched.length,
      ourAccounts: enriched.filter((a: { isOurs: boolean }) => a.isOurs).length,
    });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/whatsapp] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Assign agent to WhatsApp account ────────────────

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    if (!isPlatformKeyConfigured()) {
      return NextResponse.json({ error: "Service WhatsApp en cours d'activation." }, { status: 503 });
    }

    const body = await request.json();
    const { action, whatsappAccountId, agentId, elevenAgentId } = body;

    // ─── Action: assign ─────────────────────────────────────
    if (action === "assign") {
      if (!whatsappAccountId || !elevenAgentId) {
        return NextResponse.json({ error: "whatsappAccountId et elevenAgentId requis" }, { status: 400 });
      }

      // Verify the agent belongs to this company
      const agent = await db.elevenLabsAgent.findFirst({
        where: { id: agentId, companyId: session.companyId, elevenAgentId },
      });
      if (!agent) {
        return NextResponse.json({ error: "Agent non trouve ou non connecte" }, { status: 404 });
      }

      const updated = await assignAgentToWhatsApp(whatsappAccountId, elevenAgentId);
      return NextResponse.json({
        success: true,
        message: `Agent "${agent.name}" assigne au compte WhatsApp`,
        account: updated,
      });
    }

    // ─── Action: update_settings ────────────────────────────
    if (action === "update_settings") {
      if (!whatsappAccountId) {
        return NextResponse.json({ error: "whatsappAccountId requis" }, { status: 400 });
      }

      const settings: Record<string, unknown> = {};
      if (body.enabled_messaging !== undefined) settings.enabled_messaging = body.enabled_messaging;
      if (body.enabled_audio_response !== undefined) settings.enabled_audio_response = body.enabled_audio_response;
      if (body.enabled_typing_indicator !== undefined) settings.enabled_typing_indicator = body.enabled_typing_indicator;

      if (Object.keys(settings).length === 0) {
        return NextResponse.json({ error: "Aucun parametre a mettre a jour" }, { status: 400 });
      }

      const updated = await updateWhatsAppAccount(whatsappAccountId, settings as Parameters<typeof updateWhatsAppAccount>[1]);
      return NextResponse.json({ success: true, account: updated });
    }

    return NextResponse.json({ error: "Action non reconnue. Utilisez 'assign' ou 'update_settings'." }, { status: 400 });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/whatsapp POST] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
