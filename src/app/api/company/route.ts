import { NextResponse } from "next/server";
import { db, ensureBootstrapped } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError, rateLimit } from "@/lib/security";

// Hardcoded accounts (DB-independent fallback)
const HARDCODED_ACCOUNTS: Record<string, { userId: string; companyId: string; companyName: string; country: string; plan: string; role: string }> = {
  "admin-hardcoded-001": { userId: "admin-hardcoded-001", companyId: "company-admin-001", companyName: "ChatCommerce CRM Africa", country: "Cameroun", plan: "enterprise", role: "company_admin" },
  "demo-hardcoded-001": { userId: "demo-hardcoded-001", companyId: "company-demo-001", companyName: "ChatCommerce Demo", country: "Cameroun", plan: "business", role: "company_admin" },
};

// Helper: authenticate and get user + company from token
async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  // Hardcoded accounts fallback (works even without DB)
  const hardcoded = HARDCODED_ACCOUNTS[payload.userId];
  if (hardcoded) {
    return {
      user: { id: hardcoded.userId, name: hardcoded.role === "company_admin" ? "Administrateur" : "Demo User", email: "", role: hardcoded.role },
      company: { id: hardcoded.companyId, name: hardcoded.companyName, country: hardcoded.country, plan: hardcoded.plan, maxContacts: 99999, maxAgents: 999, whatsappNumber: null, notificationSettings: null },
      payload,
    };
  }

  try {
    await ensureBootstrapped();
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { company: true },
    });
    if (!user || !user.company) return null;
    return { user, company: user.company, payload };
  } catch {
    return null;
  }
}

// GET /api/company — fetch company details + subscription + usage
export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }
    const { company } = auth;

    // Get subscription info
    const subscription = await db.subscription.findFirst({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
    });

    // Get usage counts
    const [contactCount, agentCount] = await Promise.all([
      db.contact.count({ where: { companyId: company.id } }),
      db.user.count({ where: { companyId: company.id, isActive: true } }),
    ]);

    // Parse notification settings from company or use defaults
    let notifications = {
      new_orders: true,
      new_messages: true,
      payment_confirmations: true,
      daily_reports: false,
    };
    if (company.notificationSettings) {
      try {
        notifications = JSON.parse(company.notificationSettings);
      } catch { /* use defaults */ }
    }

    // Get telegram agent count
    const telegramAgentCount = await db.telegramAgent.count({ where: { companyId: company.id } });

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        country: company.country,
        whatsappNumber: company.whatsappNumber || "",
        plan: company.plan,
        maxContacts: company.maxContacts,
        maxAgents: company.maxAgents,
        notifications,
      },
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      usage: { contactCount, agentCount, telegramAgentCount },
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// POST /api/company — update company info or notification settings
export async function POST(request: Request) {
  try {
    const auth = await authenticate(request);
    if (!auth) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }
    if (auth.user.role !== "company_admin" && auth.user.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse. Admin requis." }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    // Rate limit
    const rl = rateLimit(`company:update:${auth.payload.userId}`, 10, 60000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de requetes. Patientez." }, { status: 429 });
    }

    // ─── UPDATE COMPANY INFO ─────────────────────────
    if (action === "update") {
      const { name, phone, country, whatsappNumber, currency } = body;

      if (name) {
        await db.company.update({
          where: { id: auth.company.id },
          data: {
            name: sanitize(name).slice(0, 200),
            country: country ? sanitize(country).slice(0, 100) : undefined,
            whatsappNumber: whatsappNumber ? sanitize(whatsappNumber).slice(0, 30) : undefined,
            ...(currency !== undefined && { currency }),
          },
        });
      }

      return NextResponse.json({ success: true, message: "Entreprise mise a jour avec succes" });
    }

    // ─── UPDATE NOTIFICATIONS ─────────────────────────
    if (action === "update_notifications") {
      const { new_orders, new_messages, payment_confirmations, daily_reports } = body;

      const notifData = JSON.stringify({
        new_orders: !!new_orders,
        new_messages: !!new_messages,
        payment_confirmations: !!payment_confirmations,
        daily_reports: !!daily_reports,
      });

      // Store notification preferences in the company's notificationSettings field
      await db.company.update({
        where: { id: auth.company.id },
        data: {
          notificationSettings: notifData,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "Preferences de notifications mises a jour",
        notifications: JSON.parse(notifData),
      });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
