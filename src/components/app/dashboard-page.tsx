"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

export default function DashboardPage() {
  const { token, setDashboardData } = useAppStore();
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [revByDay, setRevByDay] = useState<RevDay[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<{ status: string; _count: { id: number } }[]>([]);
  const [topProducts, setTopProducts] = useState<{ productName: string; _sum: { quantity: number; total: number } }[]>([]);
  const [recentOrders, setRecentOrders] = useState<unknown[]>([]);
  const [teamPerf, setTeamPerf] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch("/api/dashboard", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setKpis(data.kpis);
        setRevByDay(data.revenueByDay);
        setOrdersByStatus(data.ordersByStatus);
        setTopProducts(data.topProducts);
        setRecentOrders(data.recentOrders);
        setTeamPerf(data.teamPerformance);
        setDashboardData(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, setDashboardData]);

  const formatXAF = (n: number) =>
    new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

  const kpiCards = kpis
    ? [
        {
          label: "Total Clients",
          value: kpis.totalContacts.toString(),
          change: "+12%",
          up: true,
          icon: Users,
          color: "bg-blue-50 text-blue-600",
        },
        {
          label: "Commandes",
          value: kpis.totalOrders.toString(),
          change: "+8%",
          up: true,
          icon: ShoppingCart,
          color: "bg-green-50 text-green-600",
        },
        {
          label: "Chiffre d'affaires",
          value: formatXAF(kpis.totalRevenue),
          change: "+23%",
          up: true,
          icon: DollarSign,
          color: "bg-emerald-50 text-emerald-600",
        },
        {
          label: "Taux de conversion",
          value: kpis.conversionRate + "%",
          change: "-2%",
          up: false,
          icon: TrendingUp,
          color: "bg-purple-50 text-purple-600",
        },
        {
          label: "Nouvelles conversations",
          value: kpis.newConversations.toString(),
          change: "+5",
          up: true,
          icon: MessageSquare,
          color: "bg-orange-50 text-orange-600",
        },
        {
          label: "Temps de réponse moy.",
          value: kpis.avgResponseTime + " min",
          change: "-3 min",
          up: true,
          icon: Clock,
          color: "bg-cyan-50 text-cyan-600",
        },
      ]
    : [];

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    confirmed: "Confirmée",
    preparing: "En préparation",
    ready: "Prête",
    delivered: "Livrée",
    cancelled: "Annulée",
  };
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    preparing: "bg-orange-100 text-orange-700",
    ready: "bg-purple-100 text-purple-700",
    delivered: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
  };

  const maxRev = Math.max(...revByDay.map((d) => d.revenue), 1);

  if (loading) {
    return (
      <>
        <Header title="Tableau de bord" subtitle="Vue d'ensemble de votre activité" />
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 h-72 bg-gray-100 rounded-xl animate-pulse" />
            <div className="h-72 bg-gray-100 rounded-xl animate-pulse" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Tableau de bord" subtitle="Vue d'ensemble de votre activité" />
      <div className="p-6 space-y-6 animate-fade-in">
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
                <p className="text-xl font-bold text-[#0F172A]">{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-1">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2 border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenus (7 derniers jours)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-48">
                {revByDay.map((d, i) => {
                  const height = (d.revenue / maxRev) * 100;
                  const dayLabel = new Date(d.date).toLocaleDateString("fr", { weekday: "short" });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <span className="text-[10px] text-gray-400 font-medium">
                        {d.revenue > 0 ? formatXAF(d.revenue).replace(" FCFA", "") : ""}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-gradient-to-t from-[#25D366] to-[#25D366]/60 transition-all duration-500 hover:from-[#128C7E] hover:to-[#128C7E]/60"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-[10px] text-gray-400">{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Orders by Status */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Commandes par statut</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ordersByStatus.map((os) => {
                  const label = statusLabels[os.status] || os.status;
                  const color = statusColors[os.status] || "bg-gray-100 text-gray-600";
                  return (
                    <div key={os.status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${color.split(" ")[0].replace("bg-", "bg-")}`} />
                        <span className="text-sm text-gray-600">{label}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {os._count.id}
                      </Badge>
                    </div>
                  );
                })}
              </div>
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
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 truncate max-w-[120px]">
                        {p.productName}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A]">
                      {formatXAF(p._sum.total || 0)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team Performance */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Performance équipe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(teamPerf as Array<Record<string, unknown>>).map((t: Record<string, unknown>) => (
                  <div key={t.id as string} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-[10px] font-bold">
                      {String(t.name).split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{t.name as string}</p>
                      <p className="text-[11px] text-gray-400">
                        {(t.activeConversations as number)} conversation(s) active(s)
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.role as string}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Dernières commandes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(recentOrders as Array<Record<string, unknown>>).slice(0, 5).map((o: Record<string, unknown>) => (
                  <div key={o.id as string} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">{o.orderNumber as string}</p>
                      <p className="text-[11px] text-gray-400">
                        {(o.contact as Record<string, unknown>)?.name as string}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {formatXAF(o.total as number)}
                      </p>
                      <Badge className={`text-[9px] ${statusColors[o.status as string] || ""}`}>
                        {statusLabels[o.status as string] || o.status as string}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}