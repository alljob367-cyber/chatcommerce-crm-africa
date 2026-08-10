/**
 * Plan limits for ChatCommerce CRM Africa
 * Used across all creation APIs to enforce subscription tiers
 * 
 * 4 plans: starter → pro → business → enterprise
 */
export const PLAN_LIMITS: Record<string, {
  maxContacts: number;
  maxAgents: number;
  maxProducts: number;
  maxAutomations: number;
  maxTelegramAgents: number;
  maxBookings: number;
  maxMessages: number;
  maxDrivers: number;
  maxCampaigns: number;
}> = {
  starter: {
    maxContacts: 500,
    maxAgents: 3,
    maxProducts: 50,
    maxAutomations: 3,
    maxTelegramAgents: 2,
    maxBookings: 100,
    maxMessages: 1000,
    maxDrivers: 0,
    maxCampaigns: 0, // Telegram Ads: Pro+ only
  },
  pro: {
    maxContacts: 2000,
    maxAgents: 5,
    maxProducts: 200,
    maxAutomations: 10,
    maxTelegramAgents: 5,
    maxBookings: 500,
    maxMessages: 3000,
    maxDrivers: 3,
    maxCampaigns: 10, // Telegram Ads: limited
  },
  business: {
    maxContacts: 5000,
    maxAgents: 10,
    maxProducts: 500,
    maxAutomations: 20,
    maxTelegramAgents: 12,
    maxBookings: 5000,
    maxMessages: 10000,
    maxDrivers: 10,
    maxCampaigns: 50,
  },
  enterprise: {
    maxContacts: 999999,
    maxAgents: 999999,
    maxProducts: 999999,
    maxAutomations: 999999,
    maxTelegramAgents: 999999,
    maxBookings: 999999,
    maxMessages: 999999,
    maxDrivers: 999999,
    maxCampaigns: 999999,
  },
};

// Plan hierarchy — used for upgrade checks
export const PLAN_ORDER = ["starter", "pro", "business", "enterprise"] as const;
export type PlanType = typeof PLAN_ORDER[number];

/**
 * Check if a company has reached the limit for a specific resource.
 * Usage in API routes:
 *   const limit = await checkPlanLimit(companyId, "maxProducts", db.product.count({ where: { companyId } }));
 *   if (limit) return NextResponse.json({ error: limit }, { status: 403 });
 */
export async function checkPlanLimit(
  plan: string,
  resource: keyof typeof PLAN_LIMITS[string],
  currentCount: number
): Promise<string | null> {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
  const max = limits[resource];

  if (currentCount >= max) {
    const labels: Record<string, string> = {
      maxContacts: "contacts",
      maxAgents: "membres d'equipe",
      maxProducts: "produits",
      maxAutomations: "automatisations",
      maxTelegramAgents: "agents Telegram",
      maxBookings: "reservations",
      maxMessages: "messages",
      maxDrivers: "chauffeurs",
      maxCampaigns: "campagnes",
    };

    if (max >= 999999) return null; // Unlimited

    return `Limite atteinte : ${currentCount}/${max} ${labels[resource]}. Passez a un plan superieur pour continuer.`;
  }

  return null;
}
