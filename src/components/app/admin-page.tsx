"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Shield,
  Building2,
  Users,
  CreditCard,
  Bot,
  ShoppingCart,
  Package,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Settings2,
  Eye,
  Power,
  PowerOff,
  Trash2,
  Loader2,
  DollarSign,
  Truck,
  Target,
  Zap,
  Megaphone,
  Bike,
  Globe,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

interface AdminMetrics {
  overview: {
    totalCompanies: number;
    activeCompanies: number;
    totalUsers: number;
    totalContacts: number;
    totalOrders: number;
    totalProducts: number;
    totalTelegramAgents: number;
    activeTelegramAgents: number;
    totalBookings: number;
    totalPayments: number;
    confirmedPayments: number;
    pendingPayments: number;
    totalRevenue: number;
    totalDeliveries: number;
    totalDrivers: number;
    totalCampaigns: number;
    totalAutomations: number;
    totalConversations: number;
    totalMessages: number;
  };
  companiesByPlan: Array<{ plan: string; _count: { id: number } }>;
  usersByRole: Array<{ role: string; _count: { id: number } }>;
  paymentsByStatus: Array<{ status: string; _count: { id: number }; _sum: { amount: number | null } }>;
  paymentsByPlan: Array<{ plan: string; _count: { id: number }; _sum: { amount: number | null } }>;
  revenueByMonth: Array<{ month: string; revenue: number; count: number }>;
  companiesByMonth: Record<string, number>;
  usersByMonth: Record<string, number>;
  topCompanies: Array<{
    id: string;
    name: string;
    plan: string;
    country: string | null;
    isActive: boolean;
    createdAt: string;
    _count: {
      contacts: number;
      users: number;
      orders: number;
      telegramAgents: number;
      products: number;
    };
  }>;
  recentPayments: Array<{
    id: string;
    reference: string;
    amount: number;
    plan: string;
    status: string;
    paymentMethod: string;
    createdAt: string;
    confirmedAt: string | null;
    company: { name: string; plan: string };
    confirmedBy: { name: string } | null;
  }>;
  telegramBotsByType: Array<{ businessType: string; _count: { id: number } }>;
  telegramBookingsByStatus: Array<{ status: string; _count: { id: number } }>;
}

interface AdminCompany {
  id: string;
  name: string;
  plan: string;
  country: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    contacts: number;
    users: number;
    orders: number;
    telegramAgents: number;
    products: number;
    payments: number;
  };
}

// ─── Constants ────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pro: "bg-[#25D366]/10 text-[#25D366]",
  business: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  enterprise: "bg-purple-500/10 text-purple-500 dark:text-purple-400",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof CheckCircle }> = {
  confirmed: { label: "Confirme", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  rejected: { label: "Rejete", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  expired: { label: "Expire", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: AlertTriangle },
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Main Component ──────────────────────────────────────────────────

export default function AdminPage() {
  const { user, token } = useAppStore();

  // Tab state
  const [activeTab, setActiveTab] = useState("overview");

  // Metrics state
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Companies list state
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companiesTotal, setCompaniesTotal] = useState(0);
  const [companiesPlanFilter, setCompaniesPlanFilter] = useState("all");
  const [companiesSearch, setCompaniesSearch] = useState("");
  const [companiesStatusFilter, setCompaniesStatusFilter] = useState("all");

  // Detail dialog
  const [detailCompany, setDetailCompany] = useState<AdminCompany | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [companyDetail, setCompanyDetail] = useState<Record<string, unknown> | null>(null);

  // Config dialog
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configCompany, setConfigCompany] = useState<AdminCompany | null>(null);
  const [configPlan, setConfigPlan] = useState("");
  const [configSaving, setConfigSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminCompany | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // ─── Fetch Metrics ─────────────────────────────────────────────────

  const fetchMetrics = useCallback(async () => {
    if (!token) return;
    setMetricsLoading(true);
    try {
      const res = await fetch("/api/admin?section=overview", { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMetrics(data);
    } catch {
      toast.error("Erreur lors du chargement des metriques");
    } finally {
      setMetricsLoading(false);
    }
  }, [token]);

  // ─── Fetch Companies ──────────────────────────────────────────────

  const fetchCompanies = useCallback(async (page: number = 1) => {
    if (!token) return;
    setCompaniesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (companiesPlanFilter !== "all") params.set("plan", companiesPlanFilter);
      if (companiesStatusFilter !== "all") params.set("status", companiesStatusFilter);
      if (companiesSearch) params.set("search", companiesSearch);

      const res = await fetch(`/api/admin?section=companies&${params}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCompanies(data.companies || []);
      setCompaniesTotal(data.pagination?.total || 0);
      setCompaniesPage(page);
    } catch {
      toast.error("Erreur lors du chargement des compagnies");
    } finally {
      setCompaniesLoading(false);
    }
  }, [token, companiesPlanFilter, companiesStatusFilter, companiesSearch]);

  // ─── Fetch Company Detail ─────────────────────────────────────────

  const fetchCompanyDetail = async (companyId: string) => {
    setDetailCompany(companies.find((c) => c.id === companyId) || null);
    setDetailLoading(true);
    setCompanyDetail(null);
    try {
      const res = await fetch(`/api/admin?section=company-detail&companyId=${companyId}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCompanyDetail(data.company);
    } catch {
      toast.error("Erreur lors du chargement du detail");
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Actions ──────────────────────────────────────────────────────

  const openConfigDialog = (company: AdminCompany) => {
    setConfigCompany(company);
    setConfigPlan(company.plan);
    setConfigDialogOpen(true);
  };

  const savePlan = async () => {
    if (!configCompany || !configPlan) return;
    setConfigSaving(true);
    try {
      const res = await fetch("/api/admin", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-company-plan", companyId: configCompany.id, plan: configPlan }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Plan mis a jour : ${PLAN_LABELS[configPlan]}`);
      setConfigDialogOpen(false);
      await Promise.all([fetchMetrics(), fetchCompanies(companiesPage)]);
    } catch {
      toast.error("Erreur lors de la mise a jour");
    } finally {
      setConfigSaving(false);
    }
  };

  const toggleCompanyStatus = async (company: AdminCompany) => {
    try {
      const res = await fetch("/api/admin", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-company-status", companyId: company.id, isActive: !company.isActive }),
      });
      if (!res.ok) throw new Error();
      toast.success(company.isActive ? "Compagnie desactivee" : "Compagnie activee");
      await Promise.all([fetchMetrics(), fetchCompanies(companiesPage)]);
    } catch {
      toast.error("Erreur lors du changement de statut");
    }
  };

  const confirmDeleteCompany = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/admin", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-company", companyId: deleteTarget.id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Compagnie supprimee avec succes");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await Promise.all([fetchMetrics(), fetchCompanies(companiesPage)]);
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleteLoading(false);
    }
  };

  // ─── Effects ───────────────────────────────────────────────────────

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    if (activeTab === "companies") {
      fetchCompanies(1);
    }
  }, [activeTab, companiesPlanFilter, companiesStatusFilter, fetchCompanies]);

  // Helper aliases for JSX
  const handleDeleteClick = (company: AdminCompany) => {
    setDeleteTarget(company);
    setDeleteDialogOpen(true);
  };

  // ─── Render Helpers ───────────────────────────────────────────────

  const o = metrics?.overview;

  const overviewCards = [
    { label: "Compagnies", value: o?.totalCompanies ?? 0, sub: `${o?.activeCompanies ?? 0} actives`, icon: Building2, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
    { label: "Utilisateurs", value: o?.totalUsers ?? 0, sub: `${o?.totalCompanies ?? 0} entreprises`, icon: Users, color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
    { label: "Contacts Total", value: o?.totalContacts ?? 0, icon: Users, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40" },
    { label: "Commandes", value: o?.totalOrders ?? 0, icon: ShoppingCart, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/40" },
    { label: "Agents Telegram", value: `${o?.activeTelegramAgents ?? 0}/${o?.totalTelegramAgents ?? 0}`, sub: "actifs/total", icon: Bot, color: "text-[#0088cc]", bg: "bg-[#0088cc]/10" },
    { label: "Reservations", value: o?.totalBookings ?? 0, icon: CalendarDays, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40" },
    { label: "Livreurs", value: o?.totalDrivers ?? 0, icon: Bike, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
    { label: "Campagnes Ads", value: o?.totalCampaigns ?? 0, icon: Megaphone, color: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-950/40" },
  ];

  const revenueCards = [
    { label: "Revenu Total", value: formatFCFA(o?.totalRevenue ?? 0), icon: DollarSign, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/40" },
    { label: "Paiements Confirms", value: o?.confirmedPayments ?? 0, sub: `sur ${o?.totalPayments ?? 0} total`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
    { label: "Paiements En Attente", value: o?.pendingPayments ?? 0, icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/40" },
    { label: "Produits", value: o?.totalProducts ?? 0, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-950/40" },
  ];

  const activityCards = [
    { label: "Conversations", value: o?.totalConversations ?? 0, icon: MessageSquare, color: "text-[#25D366]", bg: "bg-[#25D366]/10" },
    { label: "Messages", value: o?.totalMessages ?? 0, icon: Activity, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40" },
    { label: "Livraisons", value: o?.totalDeliveries ?? 0, icon: Truck, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/40" },
    { label: "Automatisations", value: o?.totalAutomations ?? 0, icon: Zap, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/40" },
  ];

  // ─── Render ────────────────────────────────────────────────────────

  if (metricsLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Header
        title="Administration"
        subtitle="Metriques de la plateforme et gestion des compagnies"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="w-4 h-4" />
            Compagnies
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-6 mt-4">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {overviewCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                      <p className={`text-xl font-bold ${card.color}`}>{card.value}</p>
                      {card.sub && <p className="text-[10px] text-muted-foreground">{card.sub}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Revenue + Activity Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  Revenus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {revenueCards.map((card) => (
                    <div key={card.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                        <card.icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{card.label}</p>
                        <p className={`text-sm font-bold ${card.color}`}>{card.value}</p>
                        {card.sub && <p className="text-[9px] text-muted-foreground">{card.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  Activite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {activityCards.map((card) => (
                    <div key={card.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center shrink-0`}>
                        <card.icon className={`w-4 h-4 ${card.color}`} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">{card.label}</p>
                        <p className={`text-sm font-bold ${card.color}`}>{card.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row: Plan Distribution + Revenue Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Companies by Plan */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Compagnies par Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics?.companiesByPlan.map((item) => {
                    const total = metrics.companiesByPlan.reduce((s, c) => s + c._count.id, 0);
                    const pct = total > 0 ? Math.round((item._count.id / total) * 100) : 0;
                    return (
                      <div key={item.plan} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={PLAN_COLORS[item.plan] || PLAN_COLORS.starter}>
                              {PLAN_LABELS[item.plan] || item.plan}
                            </Badge>
                            <span className="font-semibold">{item._count.id}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              item.plan === "enterprise" ? "bg-purple-500" :
                              item.plan === "business" ? "bg-blue-500" :
                              item.plan === "pro" ? "bg-[#25D366]" :
                              "bg-gray-400"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Revenue by Month */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Revenus par Mois (6 derniers mois)</CardTitle>
              </CardHeader>
              <CardContent>
                {metrics?.revenueByMonth && metrics.revenueByMonth.length > 0 ? (
                  <div className="space-y-2">
                    {metrics.revenueByMonth.map((item) => {
                      const maxRevenue = Math.max(...metrics.revenueByMonth.map((r) => r.revenue));
                      const pct = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
                      const [year, month] = item.month.split("-");
                      return (
                        <div key={item.month} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{MONTH_NAMES[parseInt(month) - 1]} {year.slice(2)}</span>
                            <span className="font-semibold">{formatFCFA(item.revenue)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[10px] text-muted-foreground">{item.count} paiements</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune donnee de revenu disponible</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Users by Role + Telegram Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Utilisateurs par Role</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metrics?.usersByRole.map((item) => {
                    const roleLabels: Record<string, string> = {
                      super_admin: "Super Admin",
                      company_admin: "Admin",
                      manager: "Manager",
                      agent: "Agent",
                    };
                    const roleColors: Record<string, string> = {
                      super_admin: "bg-purple-500",
                      company_admin: "bg-blue-500",
                      manager: "bg-amber-500",
                      agent: "bg-gray-400",
                    };
                    const total = metrics.usersByRole.reduce((s, r) => s + r._count.id, 0);
                    const pct = total > 0 ? Math.round((item._count.id / total) * 100) : 0;
                    return (
                      <div key={item.role} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${roleColors[item.role] || "bg-gray-400"}`} />
                        <span className="text-sm flex-1">{roleLabels[item.role] || item.role}</span>
                        <span className="text-sm font-bold">{item._count.id}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Agents Telegram par Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {metrics?.telegramBotsByType.map((item) => (
                    <div key={item.businessType} className="p-2 rounded-lg bg-muted/50 text-center">
                      <p className="text-lg font-bold text-[#0088cc]">{item._count.id}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{item.businessType.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
                {metrics?.telegramBookingsByStatus && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs font-medium mb-2">Reservations par statut</p>
                    <div className="flex gap-2 flex-wrap">
                      {metrics.telegramBookingsByStatus.map((item) => (
                        <Badge key={item.status} variant="outline" className="text-xs">
                          {item.status}: {item._count.id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Payments */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Derniers Paiements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metrics?.recentPayments && metrics.recentPayments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Compagnie</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Confirme par</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.recentPayments.slice(0, 10).map((p) => {
                        const sc = STATUS_CONFIG[p.status];
                        const StatusIcon = sc?.icon || Clock;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs">{formatDate(p.createdAt)}</TableCell>
                            <TableCell className="text-xs font-medium">{p.company?.name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={PLAN_COLORS[p.plan] || ""}>{PLAN_LABELS[p.plan] || p.plan}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold">{formatFCFA(p.amount)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={sc?.className || ""}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {sc?.label || p.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{p.confirmedBy?.name || "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6">Aucun paiement recent</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── COMPANIES TAB ─── */}
        <TabsContent value="companies" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une compagnie..."
                value={companiesSearch}
                onChange={(e) => setCompaniesSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={companiesPlanFilter} onValueChange={setCompaniesPlanFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les plans</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
            <Select value={companiesStatusFilter} onValueChange={setCompaniesStatusFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actives</SelectItem>
                <SelectItem value="inactive">Inactives</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Total */}
          <p className="text-xs text-muted-foreground">{companiesTotal} compagnies trouvees</p>

          {/* Companies Table */}
          <Card>
            <CardContent className="p-0">
              {companiesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : companies.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Aucune compagnie trouvee</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Compagnie</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Pays</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-center">Contacts</TableHead>
                        <TableHead className="text-center">Users</TableHead>
                        <TableHead className="text-center">Bots</TableHead>
                        <TableHead className="text-center">Paiements</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-lg ${PLAN_COLORS[c.plan]?.split(" ")[0] || "bg-gray-100"} flex items-center justify-center shrink-0`}>
                                <Building2 className={`w-4 h-4 ${PLAN_COLORS[c.plan]?.split(" ")[1] || "text-gray-500"}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium truncate max-w-[160px]">{c.name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={PLAN_COLORS[c.plan] || ""}>{PLAN_LABELS[c.plan] || c.plan}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.country || "—"}</TableCell>
                          <TableCell>
                            {c.isActive ? (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />Active
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs font-medium">{c._count.contacts}</TableCell>
                          <TableCell className="text-center text-xs font-medium">{c._count.users}</TableCell>
                          <TableCell className="text-center text-xs font-medium">{c._count.telegramAgents}</TableCell>
                          <TableCell className="text-center text-xs font-medium">{c._count.payments}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => fetchCompanyDetail(c.id)} className="h-7 w-7 p-0">
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => openConfigDialog(c)} className="h-7 w-7 p-0">
                                <Settings2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleCompanyStatus(c)}
                                className={`h-7 w-7 p-0 ${c.isActive ? "text-red-500 hover:text-red-700" : "text-green-600 hover:text-green-700"}`}
                              >
                                {c.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(c)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {companiesTotal > 20 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={companiesPage <= 1}
                onClick={() => fetchCompanies(companiesPage - 1)}
              >
                Precedent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {companiesPage} / {Math.ceil(companiesTotal / 20)}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={companiesPage >= Math.ceil(companiesTotal / 20)}
                onClick={() => fetchCompanies(companiesPage + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ─── CONFIG TAB ─── */}
        <TabsContent value="config" className="space-y-4 mt-4">
          {/* Platform Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="w-5 h-5" />
                Configuration Plateforme
              </CardTitle>
              <CardDescription>Vue d&apos;ensemble et actions rapides</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-2xl font-bold">{o?.totalCompanies ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Compagnies</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-2xl font-bold">{o?.activeCompanies ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Actives</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-2xl font-bold">{formatFCFA(o?.totalRevenue ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">Revenu Total</p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-2xl font-bold">{o?.pendingPayments ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Paiements en attente</p>
                </div>
              </div>

              <Separator />

              {/* Plan Distribution Summary */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Distribution des Plans</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {metrics?.companiesByPlan.map((item) => (
                    <div key={item.plan} className={`p-4 rounded-lg border-2 ${PLAN_COLORS[item.plan]?.includes("bg-purple") ? "border-purple-300 dark:border-purple-700" : PLAN_COLORS[item.plan]?.includes("bg-blue") ? "border-blue-300 dark:border-blue-700" : PLAN_COLORS[item.plan]?.includes("bg-[#25D366]") ? "border-[#25D366]/30" : "border-gray-200 dark:border-gray-700"}`}>
                      <p className="text-2xl font-bold">{item._count.id}</p>
                      <p className="text-xs text-muted-foreground">{PLAN_LABELS[item.plan] || item.plan}</p>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Revenue by Plan */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Revenus par Plan (confirms)</h3>
                <div className="space-y-2">
                  {metrics?.paymentsByPlan.map((item) => (
                    <div key={item.plan} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <Badge variant="outline" className={PLAN_COLORS[item.plan] || ""}>
                        {PLAN_LABELS[item.plan] || item.plan}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-bold">{formatFCFA(item._sum.amount || 0)}</p>
                        <p className="text-[10px] text-muted-foreground">{item._count.id} paiements</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Payments by Status */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Paiements par Statut</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {metrics?.paymentsByStatus.map((item) => {
                    const sc = STATUS_CONFIG[item.status];
                    return (
                      <div key={item.status} className={`p-3 rounded-lg ${sc?.className || ""} bg-opacity-20`}>
                        <p className="text-xl font-bold">{item._count.id}</p>
                        <p className="text-[10px]">{sc?.label || item.status}</p>
                        {item._sum.amount && item._sum.amount > 0 && (
                          <p className="text-[10px] opacity-75">{formatFCFA(item._sum.amount)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Growth Stats */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Croissance (6 derniers mois)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Nouvelles Compagnies / Mois</p>
                    {metrics?.companiesByMonth && Object.keys(metrics.companiesByMonth).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(metrics.companiesByMonth).slice(-6).map(([month, count]) => (
                          <div key={month} className="flex items-center justify-between text-xs">
                            <span>{MONTH_NAMES[parseInt(month.split("-")[1]) - 1]} {month.slice(2)}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune donnee</p>
                    )}
                  </div>
                  <div className="p-4 rounded-lg border space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Nouveaux Utilisateurs / Mois</p>
                    {metrics?.usersByMonth && Object.keys(metrics.usersByMonth).length > 0 ? (
                      <div className="space-y-1">
                        {Object.entries(metrics.usersByMonth).slice(-6).map(([month, count]) => (
                          <div key={month} className="flex items-center justify-between text-xs">
                            <span>{MONTH_NAMES[parseInt(month.split("-")[1]) - 1]} {month.slice(2)}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucune donnee</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Company Detail Dialog ─── */}
      <Dialog open={!!detailCompany} onOpenChange={() => { setDetailCompany(null); setCompanyDetail(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {detailCompany?.name}
            </DialogTitle>
            <DialogDescription>Detail de la compagnie</DialogDescription>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : companyDetail ? (
            <div className="space-y-4">
              {/* Company Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Plan</p>
                  <Badge variant="outline" className={PLAN_COLORS[(companyDetail as Record<string, string>).plan] || ""}>
                    {PLAN_LABELS[(companyDetail as Record<string, string>).plan] || (companyDetail as Record<string, string>).plan}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground">Statut</p>
                  <Badge className={(companyDetail as Record<string, boolean>).isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                    {(companyDetail as Record<string, boolean>).isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {/* Usage Stats */}
              <div className="grid grid-cols-3 gap-3">
                {(companyDetail._count as Record<string, number>) && Object.entries((companyDetail._count as Record<string, number>)).slice(0, 9).map(([key, val]) => {
                  const labels: Record<string, string> = {
                    contacts: "Contacts",
                    users: "Utilisateurs",
                    orders: "Commandes",
                    telegramAgents: "Bots Telegram",
                    products: "Produits",
                    conversations: "Conversations",
                    campaigns: "Campagnes",
                    automations: "Automatisations",
                    drivers: "Livreurs",
                    deliveries: "Livraisons",
                  };
                  return (
                    <div key={key} className="text-center p-3 rounded-lg bg-muted/50">
                      <p className="text-lg font-bold">{val}</p>
                      <p className="text-[10px] text-muted-foreground">{labels[key] || key}</p>
                    </div>
                  );
                })}
              </div>

              {/* Users */}
              {(companyDetail.users as Array<Record<string, string>>)?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Membres ({(companyDetail.users as Array<unknown>).length})</p>
                  <div className="space-y-1">
                    {(companyDetail.users as Array<Record<string, string>>).map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                        <div>
                          <p className="font-medium">{u.name}</p>
                          <p className="text-muted-foreground">{u.email}</p>
                        </div>
                        <Badge variant="outline">{u.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Payments */}
              {(companyDetail.payments as Array<Record<string, unknown>>)?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Derniers Paiements</p>
                  <div className="space-y-1">
                    {(companyDetail.payments as Array<Record<string, unknown>>).slice(0, 5).map((p) => (
                      <div key={p.id as string} className="flex items-center justify-between p-2 rounded-lg border text-xs">
                        <div>
                          <p className="font-medium">{PLAN_LABELS[p.plan as string] || (p.plan as string)} — {formatFCFA(p.amount as number)}</p>
                          <p className="text-muted-foreground">{formatDate(p.createdAt as string)}</p>
                        </div>
                        <Badge variant="outline" className={STATUS_CONFIG[p.status as string]?.className || ""}>
                          {STATUS_CONFIG[p.status as string]?.label || (p.status as string)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Aucun detail disponible</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Config Plan Dialog ─── */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Modifier le Plan
            </DialogTitle>
            <DialogDescription>
              {configCompany?.name} — Plan actuel : {PLAN_LABELS[configCompany?.plan || "starter"]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau Plan</Label>
              <Select value={configPlan} onValueChange={setConfigPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter (5 000 FCFA)</SelectItem>
                  <SelectItem value="pro">Pro (14 900 FCFA)</SelectItem>
                  <SelectItem value="business">Business (29 900 FCFA)</SelectItem>
                  <SelectItem value="enterprise">Enterprise (69 900 FCFA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Annuler</Button>
            <Button onClick={savePlan} disabled={configSaving || configPlan === configCompany?.plan} className="gap-2 bg-[#25D366] hover:bg-[#1da851]">
              {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Company Dialog ─── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Supprimer la Compagnie
            </DialogTitle>
            <DialogDescription>
              Cette action est irreversible. Toutes les donnees de {deleteTarget?.name} seront supprimees.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <p className="text-xs text-red-800 dark:text-red-300">
              Cela inclut : contacts, commandes, utilisateurs, agents Telegram, paiements, conversations, livraisons, et toutes autres donnees associees.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
            <Button onClick={confirmDeleteCompany} disabled={deleteLoading} className="gap-2 bg-red-600 hover:bg-red-700">
              {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer Definitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


