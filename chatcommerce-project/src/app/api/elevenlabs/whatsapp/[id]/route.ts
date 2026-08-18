import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleError } from "@/lib/security";
import {
  getWhatsAppAccount,
  updateWhatsAppAccount,
  deleteWhatsAppAccount,
  type ElevenLabsConfig,
} from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

function getPlatformConfig(): ElevenLabsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}

// ─── GET: WhatsApp account details ───────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const config = getPlatformConfig();
    if (!config) {
      return NextResponse.json({ error: "Service WhatsApp non disponible" }, { status: 400 });
    }

    const { id } = await params;
    const account = await getWhatsAppAccount(config, id);

    return NextResponse.json({ account });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/whatsapp/[id] GET] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PATCH: Update WhatsApp account (assign agent, etc.) ─

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const config = getPlatformConfig();
    if (!config) {
      return NextResponse.json({ error: "Service WhatsApp non disponible" }, { status: 400 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, agentId, messagingEnabled, audioResponseEnabled, typingEnabled, callEnabled } = body;

    // ─── Action: assign_agent ───────────────────────────────
    if (action === "assign_agent") {
      if (!agentId) {
        return NextResponse.json({ error: "agentId requis" }, { status: 400 });
      }

      // Verify the agent belongs to this company
      const agent = await db.elevenLabsAgent.findFirst({
        where: { id: agentId, companyId: session.companyId },
      });

      if (!agent) {
        return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });
      }

      // If this agent already had a WhatsApp account, the ElevenLabs side
      // assignment will be overwritten — that's fine.

      // Assign on ElevenLabs side
      const elevenAgentId = agent.elevenAgentId;
      if (elevenAgentId) {
        const updated = await updateWhatsAppAccount(config, id, {
          assigned_agent_id: elevenAgentId,
          messaging_enabled: messagingEnabled !== false,
          audio_message_response_enabled: audioResponseEnabled !== false,
          typing_indicator_enabled: typingEnabled !== false,
          call_enabled: callEnabled === true,
        });

        // Update our DB: link WhatsApp account to agent
        await db.elevenLabsAgent.update({
          where: { id: agentId },
          data: {
            whatsappAccountId: id,
            whatsappEnabled: true,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Agent "${agent.name}" assigne au numero WhatsApp ${updated.phone_number}`,
          account: updated,
        });
      } else {
        return NextResponse.json({
          error: "L'agent doit d'abord etre connecte a ElevenLabs avant d'etre assigne a WhatsApp.",
        }, { status: 400 });
      }
    }

    // ─── Action: unassign_agent ─────────────────────────────
    if (action === "unassign_agent") {
      // Find the agent linked to this WhatsApp account
      const agent = await db.elevenLabsAgent.findFirst({
        where: { whatsappAccountId: id, companyId: session.companyId },
      });

      if (agent) {
        await db.elevenLabsAgent.update({
          where: { id: agent.id },
          data: { whatsappAccountId: null, whatsappEnabled: false },
        });
      }

      // Remove assignment on ElevenLabs side
      const updated = await updateWhatsAppAccount(config, id, {
        assigned_agent_id: "",
      });

      return NextResponse.json({
        success: true,
        message: "Agent dissocie du compte WhatsApp",
        account: updated,
      });
    }

    // ─── Direct settings update ─────────────────────────────
    const updateParams: Record<string, unknown> = {};
    if (messagingEnabled !== undefined) updateParams.messaging_enabled = messagingEnabled;
    if (audioResponseEnabled !== undefined) updateParams.audio_message_response_enabled = audioResponseEnabled;
    if (typingEnabled !== undefined) updateParams.typing_indicator_enabled = typingEnabled;
    if (callEnabled !== undefined) updateParams.call_enabled = callEnabled;

    if (Object.keys(updateParams).length > 0) {
      const updated = await updateWhatsAppAccount(
        config,
        id,
        updateParams as Parameters<typeof updateWhatsAppAccount>[2]
      );
      return NextResponse.json({ success: true, account: updated });
    }

    return NextResponse.json({ error: "Aucune modification a appliquer" }, { status: 400 });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/whatsapp/[id] PATCH] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── DELETE: Remove WhatsApp account ─────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    // Only super_admin can delete WhatsApp accounts
    if (session.role !== "super_admin") {
      return NextResponse.json({ error: "Action reservee a l'administrateur plateforme" }, { status: 403 });
    }

    const config = getPlatformConfig();
    if (!config) {
      return NextResponse.json({ error: "Service WhatsApp non disponible" }, { status: 400 });
    }

    const { id } = await params;

    // Unlink any agent using this account
    await db.elevenLabsAgent.updateMany({
      where: { whatsappAccountId: id },
      data: { whatsappAccountId: null, whatsappEnabled: false },
    });

    // Delete from ElevenLabs
    await deleteWhatsAppAccount(config, id);

    return NextResponse.json({ success: true, message: "Compte WhatsApp supprime" });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/whatsapp/[id] DELETE] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
