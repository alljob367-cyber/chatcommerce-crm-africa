import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";
import { PLAN_LIMITS } from "@/lib/plan-limits";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Platform Metrics (super_admin only) ───────────────────────

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    // Only super_admin can access platform metrics
    if (session.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse. Reserve au super administrateur." }, { status: 403 });
    }

    const url = new URL(request.url);
    const section = url.searchParams.get("section") || "all";

    // ─── Overview Metrics ───
    if (section === "all" || section === "overview") {
      const [
        totalCompanies,
        activeCompanies,
        totalUsers,
        totalContacts,
        totalOrders,
        totalProducts,
        totalTelegramAgents,
        activeTelegramAgents,
        totalBookings,
        totalPayments,
        confirmedPayments,
        pendingPayments,
        totalDeliveries,
        totalDrivers,
        totalCampaigns,
        totalAutomations,
        totalConversations,
        totalMessages,
      ] = await Promise.all([
        db.company.count(),
        db.company.count({ where: { isActive: true } }),
        db.user.count(),
        db.contact.count(),
        db.order.count(),
        db.product.count(),
        db.telegramAgent.count(),
        db.telegramAgent.count({ where: { isActive: true } }),
        db.telegramBooking.count(),
        db.payment.count(),
        db.payment.count({ where: { status: "confirmed" } }),
        db.payment.count({ where: { status: "pending" } }),
        db.delivery.count(),
        db.driver.count(),
        db.campaign.count(),
        db.automation.count(),
        db.conversation.count(),
        db.message.count(),
      ]);

      // Revenue from confirmed payments
      const revenueResult = await db.payment.aggregate({
        where: { status: "confirmed" },
        _sum: { amount: true },
      });
      const totalRevenue = revenueResult._sum.amount || 0;

      // ─── Merchant Payments Metrics (all companies) ───
      const [
        merchantTotalPayments,
        merchantConfirmedPayments,
        merchantPendingPayments,
        merchantRejectedPayments,
        merchantTotalRevenueResult,
        merchantTodayRevenueResult,
        merchantWeekRevenueResult,
        merchantMonthRevenueResult,
      ] = await Promise.all([
        db.merchantPayment.count(),
        db.merchantPayment.count({ where: { status: "confirmed" } }),
        db.merchantPayment.count({ where: { status: "pending" } }),
        db.merchantPayment.count({ where: { status: "rejected" } }),
        db.merchantPayment.aggregate({ where: { status: "confirmed" }, _sum: { amount: true } }),
        (() => {
          const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
          return db.merchantPayment.aggregate({ where: { status: "confirmed", confirmedAt: { gte: startOfDay } }, _sum: { amount: true } });
        })(),
        (() => {
          const startOfWeek = new Date(); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); startOfWeek.setHours(0, 0, 0, 0);
          return db.merchantPayment.aggregate({ where: { status: "confirmed", confirmedAt: { gte: startOfWeek } }, _sum: { amount: true } });
        })(),
        (() => {
          const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
          return db.merchantPayment.aggregate({ where: { status: "confirmed", confirmedAt: { gte: startOfMonth } }, _sum: { amount: true } });
        })(),
      ]);

      const merchantTotalRevenue = merchantTotalRevenueResult._sum.amount || 0;
      const merchantTodayRevenue = merchantTodayRevenueResult._sum.amount || 0;
      const merchantWeekRevenue = merchantWeekRevenueResult._sum.amount || 0;
      const merchantMonthRevenue = merchantMonthRevenueResult._sum.amount || 0;

      // Merchant revenue by company (top 10)
      const merchantRevenueByCompany = await db.merchantPayment.groupBy({
        by: ["companyId"],
        where: { status: "confirmed" },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: "desc" } },
        take: 10,
      });

      // Get company names for the breakdown
      const merchantCompanyIds = merchantRevenueByCompany.map((m) => m.companyId);
      const merchantCompanyNames = merchantCompanyIds.length > 0
        ? await db.company.findMany({
            where: { id: { in: merchantCompanyIds } },
            select: { id: true, name: true },
          })
        : [];

      const merchantTopCompanies = merchantRevenueByCompany.map((m) => ({
        companyId: m.companyId,
        companyName: merchantCompanyNames.find((c) => c.id === m.companyId)?.name || "Inconnu",
        revenue: m._sum.amount || 0,
        paymentCount: m._count.id,
      }));

      // Merchant payments by method
      const merchantPaymentsByMethod = await db.merchantPayment.groupBy({
        by: ["paymentMethod"],
        _count: { id: true },
        _sum: { amount: true },
      });

      // Recent merchant payments (last 20)
      const recentMerchantPayments = await db.merchantPayment.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          agent: { select: { name: true, botUsername: true } },
          company: { select: { name: true } },
        },
      });

      // Companies by plan
      const companiesByPlan = await db.company.groupBy({
        by: ["plan"],
        _count: { id: true },
      });

      // Users by role
      const usersByRole = await db.user.groupBy({
        by: ["role"],
        _count: { id: true },
      });

      // Payments by status
      const paymentsByStatus = await db.payment.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { amount: true },
      });

      // Payments by plan
      const paymentsByPlan = await db.payment.groupBy({
        by: ["plan"],
        where: { status: "confirmed" },
        _count: { id: true },
        _sum: { amount: true },
      });

      // Revenue by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setDate(1);
      sixMonthsAgo.setHours(0, 0, 0, 0);

      const recentConfirmedPayments = await db.payment.findMany({
        where: {
          status: "confirmed",
          confirmedAt: { gte: sixMonthsAgo },
        },
        select: { amount: true, confirmedAt: true, plan: true },
        orderBy: { confirmedAt: "asc" },
      });

      const revenueByMonth: Record<string, { month: string; revenue: number; count: number }> = {};
      for (const p of recentConfirmedPayments) {
        if (!p.confirmedAt) continue;
        const key = p.confirmedAt.toISOString().slice(0, 7); // YYYY-MM
        if (!revenueByMonth[key]) revenueByMonth[key] = { month: key, revenue: 0, count: 0 };
        revenueByMonth[key].revenue += p.amount;
        revenueByMonth[key].count += 1;
      }

      // New companies per month (last 6 months)
      const recentCompanies = await db.company.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const companiesByMonth: Record<string, number> = {};
      for (const c of recentCompanies) {
        const key = c.createdAt.toISOString().slice(0, 7);
        companiesByMonth[key] = (companiesByMonth[key] || 0) + 1;
      }

      // New users per month (last 6 months)
      const recentUsers = await db.user.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      const usersByMonth: Record<string, number> = {};
      for (const u of recentUsers) {
        const key = u.createdAt.toISOString().slice(0, 7);
        usersByMonth[key] = (usersByMonth[key] || 0) + 1;
      }

      // Top companies by contacts count
      const topCompanies = await db.company.findMany({
        take: 10,
        select: {
          id: true,
          name: true,
          plan: true,
          country: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              contacts: true,
              users: true,
              orders: true,
              telegramAgents: true,
              products: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      // Recent activity (last 20 payments)
      const recentPaymentsList = await db.payment.findMany({
        take: 20,
        where: { status: { in: ["pending", "confirmed", "rejected"] } },
        include: {
          company: { select: { name: true, plan: true } },
          confirmedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Telegram bots stats
      const telegramBotsByType = await db.telegramAgent.groupBy({
        by: ["businessType"],
        _count: { id: true },
      });

      const telegramBookingsByStatus = await db.telegramBooking.groupBy({
        by: ["status"],
        _count: { id: true },
      });

      return NextResponse.json({
        overview: {
          totalCompanies,
          activeCompanies,
          totalUsers,
          totalContacts,
          totalOrders,
          totalProducts,
          totalTelegramAgents,
          activeTelegramAgents,
          totalBookings,
          totalPayments,
          confirmedPayments,
          pendingPayments,
          totalRevenue,
          totalDeliveries,
          totalDrivers,
          totalCampaigns,
          totalAutomations,
          totalConversations,
          totalMessages,
        },
        companiesByPlan,
        usersByRole,
        paymentsByStatus,
        paymentsByPlan,
        revenueByMonth: Object.values(revenueByMonth),
        companiesByMonth,
        usersByMonth,
        topCompanies,
        recentPayments: recentPaymentsList,
        telegramBotsByType,
        telegramBookingsByStatus,
        // Merchant payments metrics (all companies)
        merchantPayments: {
          total: merchantTotalPayments,
          confirmed: merchantConfirmedPayments,
          pending: merchantPendingPayments,
          rejected: merchantRejectedPayments,
          totalRevenue: merchantTotalRevenue,
          todayRevenue: merchantTodayRevenue,
          weekRevenue: merchantWeekRevenue,
          monthRevenue: merchantMonthRevenue,
          topCompanies: merchantTopCompanies,
          byMethod: merchantPaymentsByMethod,
          recent: recentMerchantPayments,
        },
      });
    }

    // ─── Companies List ───
    if (section === "companies") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const plan = url.searchParams.get("plan") || "";
      const search = url.searchParams.get("search") || "";
      const status = url.searchParams.get("status") || "";

      const where: Record<string, unknown> = {};
      if (plan) where.plan = plan;
      if (status === "active") where.isActive = true;
      if (status === "inactive") where.isActive = false;
      if (search) where.name = { contains: search, mode: "insensitive" };

      const [companies, total] = await Promise.all([
        db.company.findMany({
          where,
          include: {
            _count: {
              select: {
                contacts: true,
                users: true,
                orders: true,
                telegramAgents: true,
                products: true,
                payments: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.company.count({ where }),
      ]);

      return NextResponse.json({
        companies,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    // ─── Users List ───
    if (section === "users") {
      const page = parseInt(url.searchParams.get("page") || "1");
      const limit = parseInt(url.searchParams.get("limit") || "20");
      const search = url.searchParams.get("search") || "";
      const role = url.searchParams.get("role") || "";

      const where: Record<string, unknown> = {};
      if (search) where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
      if (role) where.role = role;

      const [users, total] = await Promise.all([
        db.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
            emailVerified: true,
            createdAt: true,
            company: { select: { id: true, name: true, plan: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        db.user.count({ where }),
      ]);

      return NextResponse.json({
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    // ─── Single Company Detail ───
    if (section === "company-detail") {
      const companyId = url.searchParams.get("companyId");
      if (!companyId) return NextResponse.json({ error: "companyId requis" }, { status: 400 });

      const company = await db.company.findUnique({
        where: { id: companyId },
        include: {
          users: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
          payments: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          subscriptions: {
            orderBy: { currentPeriodStart: "desc" },
            take: 5,
          },
          _count: {
            select: {
              contacts: true,
              orders: true,
              products: true,
              telegramAgents: true,
              conversations: true,
              campaigns: true,
              automations: true,
              drivers: true,
              deliveries: true,
            },
          },
        },
      });

      if (!company) return NextResponse.json({ error: "Compagnie introuvable" }, { status: 404 });
      return NextResponse.json({ company });
    }

    return NextResponse.json({ error: "Section invalide" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PUT: Platform Configuration (super_admin only) ──────────────

export async function PUT(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    if (session.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse. Reserve au super administrateur." }, { status: 403 });
    }

    const body = await request.json();
    const { action, ...data } = body;

    // ─── Update Company Plan ───
    if (action === "update-company-plan") {
      const { companyId, plan } = data;
      if (!companyId || !plan) {
        return NextResponse.json({ error: "companyId et plan requis" }, { status: 400 });
      }
      if (!PLAN_LIMITS[plan]) {
        return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
      }

      const company = await db.company.update({
        where: { id: companyId },
        data: {
          plan,
          maxContacts: PLAN_LIMITS[plan].maxContacts,
          maxAgents: PLAN_LIMITS[plan].maxAgents,
        },
      });

      // Update subscription
      const existingSub = await db.subscription.findFirst({
        where: { companyId, status: { in: ["active", "trialing"] } },
      });

      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      if (existingSub) {
        await db.subscription.update({
          where: { id: existingSub.id },
          data: { plan, status: "active", currentPeriodStart: new Date(), currentPeriodEnd: periodEnd },
        });
      } else {
        await db.subscription.create({
          data: { companyId, plan, status: "active", currentPeriodStart: new Date(), currentPeriodEnd: periodEnd },
        });
      }

      return NextResponse.json({ success: true, company });
    }

    // ─── Toggle Company Active Status ───
    if (action === "toggle-company-status") {
      const { companyId, isActive } = data;
      if (!companyId || isActive === undefined) {
        return NextResponse.json({ error: "companyId et isActive requis" }, { status: 400 });
      }

      const company = await db.company.update({
        where: { id: companyId },
        data: { isActive },
      });

      return NextResponse.json({ success: true, company });
    }

    // ─── Delete Company ───
    if (action === "delete-company") {
      const { companyId } = data;
      if (!companyId) {
        return NextResponse.json({ error: "companyId requis" }, { status: 400 });
      }

      // Delete in order (child models first)
      await db.delivery.deleteMany({ where: { companyId } });
      await db.driver.deleteMany({ where: { companyId } });
      await db.telegramBooking.deleteMany({ where: { agent: { companyId } } });
      await db.businessService.deleteMany({ where: { agent: { companyId } } });
      await db.telegramAgent.deleteMany({ where: { companyId } });
      await db.campaign.deleteMany({ where: { companyId } });
      await db.automation.deleteMany({ where: { companyId } });
      await db.orderItem.deleteMany({ where: { order: { companyId } } });
      await db.order.deleteMany({ where: { companyId } });
      await db.invoice.deleteMany({ where: { companyId } });
      await db.payment.deleteMany({ where: { companyId } });
      await db.subscription.deleteMany({ where: { companyId } });
      await db.message.deleteMany({ where: { conversation: { companyId } } });
      await db.conversation.deleteMany({ where: { companyId } });
      await db.notification.deleteMany({ where: { companyId } });
      await db.activityLog.deleteMany({ where: { companyId } });
      await db.contact.deleteMany({ where: { companyId } });
      await db.lead.deleteMany({ where: { companyId } });
      await db.user.deleteMany({ where: { companyId } });
      await db.company.delete({ where: { id: companyId } });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
