// ============================================================
// CAMPAIGNS API — Telegram Ads Campaign Management
// ============================================================
// CRUD + Launch + Pause + Stats for campaign management
// Multi-tenant: all queries filtered by companyId from JWT
// ============================================================

import { NextResponse } from "next/server";
import { resolveCompanyId, db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";
import { checkPlanLimit, PLAN_LIMITS } from "@/lib/plan-limits";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return await verifyToken(token);
}

// ── GET /api/campaigns — List all campaigns ──
export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const includeAgents = searchParams.get("agents") === "true";

    const where: Record<string, unknown> = { companyId: realCompanyId };
    if (status && status !== "all") where.status = status;
    if (type && type !== "all") where.type = type;

    const campaigns = await db.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        telegramAgent: {
          select: { id: true, name: true, botUsername: true },
        },
      },
    });

    // Aggregate stats
    const stats = await db.campaign.aggregate({
      where: { companyId: realCompanyId },
      _count: true,
      _sum: {
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        repliedCount: true,
        clickedCount: true,
        budgetSpent: true,
      },
    });

    // Get company plan info for limits display
    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { plan: true },
    });
    const companyPlan = company?.plan || "starter";
    const limits = PLAN_LIMITS[companyPlan] || PLAN_LIMITS.starter;
    const currentCount = campaigns.length;

    const response: Record<string, unknown> = {
      campaigns,
      stats: {
        total: stats._count,
        sent: (stats._sum?.sentCount as number) || 0,
        delivered: (stats._sum?.deliveredCount as number) || 0,
        read: (stats._sum?.readCount as number) || 0,
        replied: (stats._sum?.repliedCount as number) || 0,
        clicked: (stats._sum?.clickedCount as number) || 0,
        budgetSpent: (stats._sum?.budgetSpent as number) || 0,
      },
      plan: {
        current: companyPlan,
        maxCampaigns: limits.maxCampaigns,
        currentCampaigns: currentCount,
        canCreate: currentCount < limits.maxCampaigns,
      },
    };

    // Include Telegram agents for the create form dropdown
    if (includeAgents) {
      const agents = await db.telegramAgent.findMany({
        where: { companyId: realCompanyId, isActive: true },
        select: { id: true, name: true, botUsername: true },
        orderBy: { name: "asc" },
      });
      response.agents = agents;
    }

    return NextResponse.json(response);
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// Plans autorisés pour les campagnes Telegram Ads
const ADS_PLANS = ["pro", "business", "enterprise"];

// ── POST /api/campaigns — Create campaign ──
export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    // Plan check: Pro, Business, Enterprise uniquement
    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { plan: true },
    });
    const companyPlan = company?.plan || "starter";
    if (!ADS_PLANS.includes(companyPlan)) {
      return NextResponse.json(
        { error: "Les campagnes Telegram Ads sont disponibles uniquement pour les plans Pro, Business et Enterprise. Mettez à niveau votre plan pour continuer." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name, type, message, messageTemplate, imageUrl,
      buttonUrl, buttonText, targetAudience, segmentType,
      scheduledAt, telegramAgentId, budget,
    } = body;

    if (!name || !message) {
      return NextResponse.json({ error: "Nom et message requis" }, { status: 400 });
    }

    // Check plan limit for campaigns
    const campaignCount = await db.campaign.count({ where: { companyId: realCompanyId } });
    const limitError = await checkPlanLimit(companyPlan, "maxCampaigns", campaignCount);
    if (limitError) return NextResponse.json({ error: limitError }, { status: 403 });

    // Count recipients based on segment
    let recipientCount = 0;
    const segType = segmentType || "all";

    if (segType === "all") {
      recipientCount = await db.contact.count({ where: { companyId: realCompanyId } });
    } else if (segType === "contacts") {
      recipientCount = await db.contact.count({ where: { companyId: realCompanyId } });
    } else if (segType === "leads") {
      recipientCount = await db.lead.count({ where: { companyId: realCompanyId } });
    } else if (segType === "customers") {
      recipientCount = await db.contact.count({
        where: { companyId: realCompanyId, orderCount: { gt: 0 } },
      });
    } else if (segType === "vip") {
      recipientCount = await db.contact.count({
        where: { companyId: realCompanyId, orderCount: { gt: 5 } },
      });
    } else if (segType === "inactive") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      recipientCount = await db.contact.count({
        where: {
          companyId: realCompanyId,
          lastMessageAt: { lt: thirtyDaysAgo },
        },
      });
    }

    // Verify telegram agent belongs to company if specified
    if (telegramAgentId) {
      const agent = await db.telegramAgent.findFirst({
        where: { id: telegramAgentId, companyId: realCompanyId },
      });
      if (!agent) {
        return NextResponse.json({ error: "Agent Telegram introuvable" }, { status: 400 });
      }
    }

    const campaign = await db.campaign.create({
      data: {
        companyId: realCompanyId,
        name: sanitize(name),
        type: type || "telegram",
        message: sanitize(message),
        messageTemplate: messageTemplate || null,
        imageUrl: imageUrl || null,
        buttonUrl: buttonUrl || null,
        buttonText: buttonText || null,
        targetAudience: targetAudience ? JSON.stringify(targetAudience) : null,
        segmentType: segType,
        recipientCount,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        telegramAgentId: telegramAgentId || null,
        budget: budget || 0,
      },
      include: {
        telegramAgent: {
          select: { id: true, name: true, botUsername: true },
        },
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ── PATCH /api/campaigns — Update campaign ──
export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    // Plan check: Pro, Business, Enterprise uniquement
    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { plan: true },
    });
    const companyPlan = company?.plan || "starter";
    if (!ADS_PLANS.includes(companyPlan)) {
      return NextResponse.json(
        { error: "Fonctionnalité réservée aux plans Pro, Business et Enterprise." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const existing = await db.campaign.findFirst({
      where: { id, companyId: realCompanyId },
    });
    if (!existing) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    // Prevent editing running/completed campaigns
    if (["running", "completed"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Impossible de modifier une campagne en cours ou terminée" },
        { status: 400 }
      );
    }

    // Sanitize string fields
    if (updates.name) updates.name = sanitize(updates.name);
    if (updates.message) updates.message = sanitize(updates.message);
    if (updates.targetAudience) updates.targetAudience = JSON.stringify(updates.targetAudience);

    // Handle scheduledAt
    if (updates.scheduledAt) {
      updates.scheduledAt = new Date(updates.scheduledAt);
    }

    const campaign = await db.campaign.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ campaign });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ── DELETE /api/campaigns — Delete draft campaign ──
export async function DELETE(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    // Plan check: Pro, Business, Enterprise uniquement
    const company = await db.company.findUnique({
      where: { id: realCompanyId },
      select: { plan: true },
    });
    const companyPlan = company?.plan || "starter";
    if (!ADS_PLANS.includes(companyPlan)) {
      return NextResponse.json(
        { error: "Fonctionnalité réservée aux plans Pro, Business et Enterprise." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const existing = await db.campaign.findFirst({
      where: { id, companyId: realCompanyId },
    });
    if (!existing) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    // Only allow deleting draft/scheduled/failed campaigns
    if (!["draft", "scheduled", "failed", "cancelled"].includes(existing.status)) {
      return NextResponse.json(
        { error: "Impossible de supprimer une campagne en cours ou terminée" },
        { status: 400 }
      );
    }

    await db.campaign.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
