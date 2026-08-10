/**
 * Plan limits for ChatCommerce CRM Africa
 * Used across all creation APIs to enforce subscription tiers
 */
export const PLAN_LIMITS: Record<string, {
  maxContacts: number;
  maxAgents: number; // Team members (Users)
  maxProducts: number;
  maxAutomations: number;
  maxTelegramAgents: number;
  maxBookings: number;
  maxMessages: number;
}> = {
  starter: {
    maxContacts: 500,
    maxAgents: 3,
    maxProducts: 50,
    maxAutomations: 3,
    maxTelegramAgents: 2,
    maxBookings: 100,
    maxMessages: 1000,
  },
  business: {
    maxContacts: 5000,
    maxAgents: 10,
    maxProducts: 500,
    maxAutomations: 20,
    maxTelegramAgents: 12,
    maxBookings: 5000,
    maxMessages: 10000,
  },
  enterprise: {
    maxContacts: 999999,
    maxAgents: 999999,
    maxProducts: 999999,
    maxAutomations: 999999,
    maxTelegramAgents: 999999,
    maxBookings: 999999,
    maxMessages: 999999,
  },
};

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
      maxAgents: "membres d'équipe",
      maxProducts: "produits",
      maxAutomations: "automatisations",
      maxTelegramAgents: "agents Telegram",
      maxBookings: "réservations",
      maxMessages: "messages",
    };

    if (max >= 999999) return null; // Unlimited

    return `Limite atteinte : ${currentCount}/${max} ${labels[resource]}. Passez a un plan superieur pour continuer.`;
  }

  return null;
}
