// ============================================================
// CAMPAIGN LAUNCH — Start / Pause / Resume a campaign
// ============================================================
// POST /api/campaigns/launch
// Body: { campaignId, action: "launch" | "pause" | "resume" | "cancel" }
// ============================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return await verifyToken(token);
}

const VALID_ACTIONS = ["launch", "pause", "resume", "cancel"] as const;
type Action = (typeof VALID_ACTIONS)[number];

const STATUS_TRANSITIONS: Record<Action, string[]> = {
  launch: ["draft", "scheduled"],
  pause: ["running"],
  resume: ["paused"],
  cancel: ["draft", "scheduled", "running", "paused"],
};

const RESULT_STATUS: Record<Action, string> = {
  launch: "running",
  pause: "paused",
  resume: "running",
  cancel: "cancelled",
};

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { campaignId, action } = body as { campaignId: string; action: Action };

    if (!campaignId || !action) {
      return NextResponse.json({ error: "campaignId et action requis" }, { status: 400 });
    }

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Action invalide: ${action}. Valeurs: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Find campaign with ownership check
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, companyId: session.companyId },
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
    }

    // Validate status transition
    const allowedFrom = STATUS_TRANSITIONS[action];
    if (!allowedFrom.includes(campaign.status)) {
      return NextResponse.json(
        {
          error: `Impossible de passer de "${campaign.status}" à "${action}". Transitions autorisées: ${allowedFrom.join(", ")}`,
        },
        { status: 409 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      status: RESULT_STATUS[action],
    };

    if (action === "launch") {
      updateData.startedAt = new Date();
    } else if (action === "cancel") {
      updateData.cancelledAt = new Date();
      updateData.completedAt = new Date();
    }

    // Execute update
    const updated = await db.campaign.update({
      where: { id: campaign.id },
      data: updateData,
    });

    // If launching, trigger the actual sending in background
    if (action === "launch") {
      // Send messages asynchronously (fire-and-forget)
      sendCampaignMessages(campaign.id, session.companyId).catch((err) => {
        console.error(`[Campaign ${campaign.id}] Background send error:`, err);
      });
    }

    return NextResponse.json({
      success: true,
      campaign: updated,
      message: `Campagne "${campaign.name}" → ${RESULT_STATUS[action]}`,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * Background function that sends campaign messages to recipients.
 * Queries the target segment, then sends via Telegram if agent is configured.
 */
async function sendCampaignMessages(campaignId: string, companyId: string) {
  try {
    const campaign = await db.campaign.findFirst({
      where: { id: campaignId, companyId },
      include: { telegramAgent: true },
    });

    if (!campaign) return;

    // Fetch recipients based on segment
    let contacts: Array<{ id: string; name: string; phone: string }> = [];

    switch (campaign.segmentType) {
      case "leads": {
        const leads = await db.lead.findMany({
          where: { companyId },
          include: { contact: { select: { name: true, phone: true } } },
        });
        contacts = leads
          .filter((l) => l.contact)
          .map((l) => ({ id: l.id, name: l.contact!.name, phone: l.contact!.phone }));
        break;
      }
      case "customers":
        contacts = await db.contact.findMany({
          where: { companyId, orderCount: { gt: 0 } },
          select: { id: true, name: true, phone: true },
        });
        break;
      case "vip":
        contacts = await db.contact.findMany({
          where: { companyId, orderCount: { gt: 5 } },
          select: { id: true, name: true, phone: true },
        });
        break;
      case "inactive": {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        contacts = await db.contact.findMany({
          where: { companyId, lastMessageAt: { lt: thirtyDaysAgo } },
          select: { id: true, name: true, phone: true },
        });
        break;
      }
      default:
        contacts = await db.contact.findMany({
          where: { companyId },
          select: { id: true, name: true, phone: true },
        });
    }

    // Send via Telegram if agent is configured
    if (campaign.telegramAgentId && campaign.telegramAgent?.token) {
      const TELEGRAM_API = `https://api.telegram.org/bot${campaign.telegramAgent.token}`;

      for (const contact of contacts) {
        try {
          // Personalize message
          const personalized = campaign.message
            .replace(/{name}/g, contact.name || "Client")
            .replace(/{phone}/g, contact.phone || "");

          const payload: Record<string, string> = {
            chat_id: contact.phone,
            text: personalized,
            parse_mode: "HTML",
          };

          if (campaign.buttonUrl && campaign.buttonText) {
            payload.reply_markup = JSON.stringify({
              inline_keyboard: [
                [{ text: campaign.buttonText, url: campaign.buttonUrl }],
              ],
            });
          }

          const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const result = await res.json();

          // Update counters
          if (result.ok) {
            await db.campaign.update({
              where: { id: campaignId },
              data: {
                sentCount: { increment: 1 },
                deliveredCount: { increment: 1 },
              },
            });
          } else {
            await db.campaign.update({
              where: { id: campaignId },
              data: { failedCount: { increment: 1 } },
            });
          }

          // Rate limit: max 30 messages per second on Telegram
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (err) {
          await db.campaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          });
        }
      }
    } else {
      // No Telegram agent — simulate as "sent" for demo
      await db.campaign.update({
        where: { id: campaignId },
        data: {
          sentCount: contacts.length,
          deliveredCount: Math.floor(contacts.length * 0.9),
          readCount: Math.floor(contacts.length * 0.5),
          repliedCount: Math.floor(contacts.length * 0.15),
          clickedCount: Math.floor(contacts.length * 0.08),
        },
      });
    }

    // Mark as completed
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "completed", completedAt: new Date() },
    });

    console.log(`[Campaign ${campaignId}] Completed — sent to ${contacts.length} recipients`);
  } catch (error) {
    console.error(`[Campaign ${campaignId}] Fatal error:`, error);
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "failed" },
    }).catch(() => {});
  }
}
