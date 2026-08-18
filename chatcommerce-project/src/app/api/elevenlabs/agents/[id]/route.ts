import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleError } from "@/lib/security";
import { getAgent, updateAgent, deleteAgent, chatWithAgent, type ElevenLabsConfig, type ElevenAgentResponse } from "@/lib/elevenlabs";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Single agent details ─────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;
    const agent = await db.elevenLabsAgent.findFirst({
      where: { id, companyId: session.companyId },
      include: { services: { orderBy: { sortOrder: "asc" } } },
    });

    if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });

    // Try to get live status from ElevenLabs
    let elevenLabsLive: ElevenAgentResponse | null = null;
    if (agent.elevenAgentId) {
      const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (ELEVEN_API_KEY) {
        try {
          const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
          elevenLabsLive = await getAgent(config, agent.elevenAgentId);
        } catch (e) {
          console.warn(`[ElevenLabs] Could not fetch agent ${agent.elevenAgentId} from API:`, e);
        }
      }
    }

    return NextResponse.json({ agent, elevenLabsLive });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/agents/[id]] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PATCH: Update agent ────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;
    const agent = await db.elevenLabsAgent.findFirst({
      where: { id, companyId: session.companyId },
    });

    if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });

    const body = await request.json();
    const { name, businessType, welcomeMessage, address, phone, openHours, currency, paymentMethod, voiceId, prompt, isActive } = body;

    // Update on ElevenLabs if connected
    if (agent.elevenAgentId) {
      const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (ELEVEN_API_KEY) {
        try {
          const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
          const updateParams: Record<string, unknown> = {};
          if (name) updateParams.name = name;
          if (prompt) updateParams.prompt = prompt;
          if (welcomeMessage) updateParams.firstMessage = welcomeMessage;
          if (voiceId) updateParams.voiceId = voiceId;

          if (Object.keys(updateParams).length > 0) {
            await updateAgent(config, agent.elevenAgentId, updateParams as Parameters<typeof updateAgent>[2]);
          }
        } catch (e) {
          console.error("[ElevenLabs] Failed to update agent on ElevenLabs:", e);
        }
      }
    }

    // Update in DB
    const updated = await db.elevenLabsAgent.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(businessType && { businessType }),
        ...(welcomeMessage !== undefined && { welcomeMessage }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(openHours !== undefined && { openHours: typeof openHours === "string" ? openHours : JSON.stringify(openHours) }),
        ...(currency && { currency }),
        ...(paymentMethod !== undefined && { paymentMethod }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ success: true, agent: updated });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/agents/[id] PATCH] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── DELETE: Delete agent ───────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;
    const agent = await db.elevenLabsAgent.findFirst({
      where: { id, companyId: session.companyId },
    });

    if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });

    // Delete from ElevenLabs if connected
    if (agent.elevenAgentId) {
      const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (ELEVEN_API_KEY) {
        try {
          const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
          await deleteAgent(config, agent.elevenAgentId);
        } catch (e) {
          console.error("[ElevenLabs] Failed to delete agent on ElevenLabs:", e);
        }
      }
    }

    // Delete from DB (cascades to services)
    await db.elevenLabsAgent.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Agent supprime" });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/agents/[id] DELETE] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Test chat with agent ─────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { message, action } = body;

    // ─── Action: connect to ElevenLabs ──────────────────────────
    if (action === "connect") {
      const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVEN_API_KEY) {
        return NextResponse.json({ error: "Cle API ElevenLabs non configuree" }, { status: 400 });
      }

      const agent = await db.elevenLabsAgent.findFirst({
        where: { id, companyId: session.companyId },
      });
      if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });

      // Import listAgents dynamically to avoid circular deps
      const { listAgents: listAll, createAgent } = await import("@/lib/elevenlabs");
      const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
      const elevenAgents = await listAll(config);

      // Find by name match or use first available
      let match = elevenAgents.find((a) => a.name === agent.name);

      if (!match && elevenAgents.length > 0 && body.elevenAgentId) {
        match = elevenAgents.find((a) => a.agent_id === body.elevenAgentId);
      }

      if (match) {
        await db.elevenLabsAgent.update({
          where: { id },
          data: { elevenAgentId: match.agent_id },
        });
        return NextResponse.json({ success: true, elevenAgentId: match.agent_id, message: `Connecte a l'agent ElevenLabs: ${match.name}` });
      }

      // If no match, create new
      const systemPrompt = agent.agentConfig ? JSON.parse(agent.agentConfig).prompt : undefined;
      const created = await createAgent(config, {
        name: agent.name,
        prompt: systemPrompt || "Tu es un assistant professionnel.",
        firstMessage: agent.welcomeMessage || "Bonjour ! Comment puis-je vous aider ?",
        voiceId: body.voiceId || "21m00Tcm4TlvDq8ikWAM",
        language: "fr",
      });

      await db.elevenLabsAgent.update({
        where: { id },
        data: {
          elevenAgentId: created.agent_id,
          agentConfig: JSON.stringify({
            agentId: created.agent_id,
            firstMessage: created.first_message,
            prompt: created.prompt,
            voiceId: created.voice_id,
            model: created.model,
          }),
          webhookSecret: `el_secret_${Date.now()}`,
        },
      });

      return NextResponse.json({ success: true, elevenAgentId: created.agent_id, message: `Agent ElevenLabs cree et connecte: ${created.name}` });
    }

    // ─── Action: toggle active ─────────────────────────────────
    if (action === "toggle") {
      const agent = await db.elevenLabsAgent.findFirst({
        where: { id, companyId: session.companyId },
      });
      if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });

      const updated = await db.elevenLabsAgent.update({
        where: { id },
        data: { isActive: !agent.isActive },
      });
      return NextResponse.json({ success: true, isActive: updated.isActive });
    }

    // ─── Action: chat test ─────────────────────────────────────
    if (action === "chat" || !action) {
      if (!message) return NextResponse.json({ error: "Message requis" }, { status: 400 });

      const agent = await db.elevenLabsAgent.findFirst({
        where: { id, companyId: session.companyId },
      });
      if (!agent) return NextResponse.json({ error: "Agent non trouve" }, { status: 404 });

      const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVEN_API_KEY) {
        return NextResponse.json({ error: "Cle API ElevenLabs non configuree" }, { status: 400 });
      }

      if (!agent.elevenAgentId) {
        return NextResponse.json({ error: "Agent non connecte a ElevenLabs. Cliquez sur 'Connecter' d'abord." }, { status: 400 });
      }

      const config: ElevenLabsConfig = { apiKey: ELEVEN_API_KEY };
      const result = await chatWithAgent(config, agent.elevenAgentId, message, body.conversationId);

      // Update stats
      await db.elevenLabsAgent.update({
        where: { id },
        data: {
          totalMessages: { increment: 2 }, // user + bot
          lastActivityAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        response: result.text,
        audioUrl: result.audioUrl,
        conversationId: result.conversationId,
      });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: unknown) {
    console.error("[API /elevenlabs/agents/[id] POST] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
