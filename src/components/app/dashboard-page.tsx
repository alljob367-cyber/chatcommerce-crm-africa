"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Header from "./header";
import {
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  MessageSquare,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  FileText,
  Filter,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface KPIs {
  totalContacts: number;
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  newConversations: number;
  openConversations: number;
  waitingConversations: number;
  closedConversations: number;
  totalMessages: number;
  avgResponseTime: number;
}

interface RevDay { date: string; revenue: number; orders: number }

type Period = "7d" | "30d" | "90d" | "custom";

const PIE_COLORS = ["#25D366", "#128C7E", "#075E54", "#34B7F1", "#F5A623", "#FF6B6B"];
const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready: "Prête",
  delivered: "Livrée",
  cancelled: "Annulée",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  preparing: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  ready: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

export default function DashboardPage() {
  const { token } = useAppStore();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [revByDay, setRevByDay] = useState<RevDay[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<{ status: string; _count: { id: number } }[]>([]);
  const [topProducts, setTopProducts] = useState<{ productName: string; _sum: { quantity: number; total: number } }[]>([]);
  const [recentOrders, setRecentOrders] = useState<unknown[]>([]);
  const [teamPerf, setTeamPerf] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ period });
      if (period === "custom" && customStart) params.set("start", customStart);
      if (period === "custom" && customEnd) params.set("end", customEnd);

      const res = await fetch(`/api/dashboard?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setKpis(data.kpis);
      setRevByDay(data.revenueByDay);
      setOrdersByStatus(data.ordersByStatus);
      setTopProducts(data.topProducts);
      setRecentOrders(data.recentOrders);
      setTeamPerf(data.teamPerformance);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, period, customStart, customEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatXAF = (n: number) =>
    new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

  const pieData = ordersByStatus.map((os) => ({
    name: STATUS_LABELS[os.status] || os.status,
    value: os._count.id,
  }));

  const kpiCards = kpis
    ? [
        {
          label: "Total Clients",
          value: kpis.totalContacts.toString(),
          change: "+12%",
          up: true,
          icon: Users,
          color: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
        },
        {
          label: "Commandes",
          value: kpis.totalOrders.toString(),
          change: "+8%",
          up: true,
          icon: ShoppingCart,
          color: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400",
        },
        {
          label: "Chiffre d'affaires",
          value: formatXAF(kpis.totalRevenue),
          change: "+23%",
          up: true,
          icon: DollarSign,
          color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
        },
        {
          label: "Taux de conversion",
          value: kpis.conversionRate + "%",
          change: "-2%",
          up: false,
          icon: TrendingUp,
          color: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
        },
        {
          label: "Conversations",
          value: kpis.newConversations.toString(),
          change: "+5",
          up: true,
          icon: MessageSquare,
          color: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
        },
        {
          label: "Temps rép. moy.",
          value: kpis.avgResponseTime + " min",
          change: "-3 min",
          up: true,
          icon: Clock,
          color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400",
        },
      ]
    : [];

  // ---- CSV EXPORT ----
  const exportCSV = () => {
    const headers = ["Date", "Revenu (FCFA)", "Commandes"];
    const rows = revByDay.map((d) => [
      d.date,
      (d.revenue || 0).toString(),
      (d.orders || 0).toString(),
    ]);
    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dashboard-${period}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- PDF-LIKE TEXT EXPORT (simple printable report) ----
  const exportReport = () => {
    const periodLabel = { "7d": "7 jours", "30d": "30 jours", "90d": "90 jours", custom: "Personnalisé" }[period];
    let content = `CHATCOMMERCE CRM AFRICA\nRAPPORT D'ACTIVITE - ${periodLabel}\n`;
    content += `Date: ${new Date().toLocaleDateString("fr-FR")}\n`;
    content += `${"=".repeat(60)}\n\n`;

    if (kpis) {
      content += `INDICATEURS CLES (KPI)\n${"-".repeat(40)}\n`;
      content += `Total Clients:        ${kpis.totalContacts}\n`;
      content += `Commandes:             ${kpis.totalOrders}\n`;
      content += `Chiffre d'affaires:    ${formatXAF(kpis.totalRevenue)}\n`;
      content += `Taux de conversion:    ${kpis.conversionRate}%\n`;
      content += `Nouvelles convos:      ${kpis.newConversations}\n`;
      content += `Conversations ouvertes: ${kpis.openConversations}\n`;
      content += `Messages total:         ${kpis.totalMessages}\n`;
      content += `Temps reponse moy.:     ${kpis.avgResponseTime} min\n\n`;
    }

    content += `COMMANDES PAR STATUT\n${"-".repeat(40)}\n`;
    ordersByStatus.forEach((os) => {
      content += `${STATUS_LABELS[os.status] || os.status}: ${os._count.id}\n`;
    });
    content += `\nTOP PRODUITS\n${"-".repeat(40)}\n`;
    topProducts.forEach((p, i) => {
      content += `${i + 1}. ${p.productName} - ${formatXAF(p._sum.total || 0)} (${p._sum.quantity} ventes)\n`;
    });
    content += `\nDERNIERES COMMANDES\n${"-".repeat(40)}\n`;
    (recentOrders as Array<Record<string, unknown>>).forEach((o) => {
      content += `${o.orderNumber} | ${(o.contact as Record<string, unknown>)?.name || ""} | ${formatXAF(o.total as number)} | ${STATUS_LABELS[o.status as string] || o.status}\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-${period}-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const periodOptions: { value: Period; label: string }[] = [
    { value: "7d", label: "7 jours" },
    { value: "30d", label: "30 jours" },
    { value: "90d", label: "90 jours" },
    { value: "custom", label: "Personnalisé" },
  ];

  if (loading && !kpis) {
    return (
      <>
        <Header title="Tableau de bord" subtitle="Vue d'ensemble de votre activite" />
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-72 bg-muted rounded-xl animate-pulse" />
            <div className="h-72 bg-muted rounded-xl animate-pulse" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Tableau de bord" subtitle="Vue d'ensemble de votre activite" />
      <div className="p-6 space-y-6 animate-fade-in">
        {/* Filters & Export Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground mr-2">Periode:</span>
            {periodOptions.map((p) => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(p.value)}
                className="h-8 text-xs"
              >
                {p.label}
              </Button>
            ))}
            {period === "custom" && (
              <div className="flex items-center gap-2 ml-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs border rounded px-2 bg-background"
                />
                <span className="text-muted-foreground">-</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs border rounded px-2 bg-background"
                />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={fetchData}>
                  Appliquer
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={fetchData}>
              <RefreshCw className="w-3 h-3" />
              Actualiser
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportCSV}>
              <Download className="w-3 h-3" />
              CSV
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportReport}>
              <FileText className="w-3 h-3" />
              Rapport
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {kpiCards.map((kpi) => (
            <Card key={kpi.label} className="kpi-card border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                    <kpi.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-[11px] font-medium flex items-center gap-0.5 ${
                      kpi.up ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {kpi.up ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {kpi.change}
                  </span>
                </div>
                <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Area Chart */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Revenus ({period === "custom" ? "Personnalise" : period === "7d" ? "7 derniers jours" : period === "30d" ? "30 derniers jours" : "90 derniers jours"})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => {
                      const d = new Date(v);
                      return d.toLocaleDateString("fr", { day: "2-digit", month: "short" });
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    width={45}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatXAF(value), "Revenu"]}
                    labelFormatter={(v) => new Date(v as string).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#25D366"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                    dot={revByDay.length <= 14}
                    activeDot={{ r: 5, fill: "#128C7E" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Orders Pie Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Commandes par statut</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                  Aucune commande
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Top Produits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="text-sm text-foreground truncate max-w-[120px]">
                        {p.productName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-foreground block">
                        {formatXAF(p._sum.total || 0)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {p._sum.quantity} ventes
                      </span>
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun produit</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Team Performance */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Performance equipe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(teamPerf as Array<Record<string, unknown>>).map((t: Record<string, unknown>) => (
                  <div key={t.id as string} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold">
                      {String(t.name).split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.name as string}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(t.activeConversations as number)} conversation(s) active(s)
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.role as string}
                    </Badge>
                  </div>
                ))}
                {teamPerf.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun membre</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Dernieres commandes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(recentOrders as Array<Record<string, unknown>>).slice(0, 5).map((o: Record<string, unknown>) => (
                  <div key={o.id as string} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">{o.orderNumber as string}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(o.contact as Record<string, unknown>)?.name as string}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatXAF(o.total as number)}
                      </p>
                      <Badge className={`text-[9px] ${STATUS_COLORS[o.status as string] || ""}`}>
                        {STATUS_LABELS[o.status as string] || o.status as string}
                      </Badge>
                    </div>
                  </div>
                ))}
                {recentOrders.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune commande</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
