"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import Header from "./header";
import {
  BarChart3,
  CalendarCheck,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Types
interface BookingsReport {
  type: string;
  period: number;
  bookingsByStatus: { pending: number; confirmed: number; completed: number; cancelled: number };
  bookingsByAgent: { agentName: string; agentType: string; count: number }[];
  bookingsByDay: { date: string; count: number }[];
  revenueByAgent: { agentName: string; total: number }[];
  topServices: { serviceName: string; count: number }[];
}

interface ProductsReport {
  type: string;
  totalProducts: number;
  activeProducts: number;
  categoriesCount: number;
  productsByCategory: { categoryName: string; count: number }[];
  lowStockProducts: { name: string; stock: number }[];
}

interface TeamReport {
  type: string;
  period: number;
  teamMembers: {
    name: string;
    role: string;
    avatar: string | null;
    bookingsHandled: number;
    revenue: number;
    deliveredOrders: number;
    totalConversations: number;
  }[];
}

type ReportPeriod = "7d" | "30d" | "90d";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

const BAR_COLORS = ["#25D366", "#128C7E", "#F5A623", "#FF6B6B", "#34B7F1", "#9B59B6", "#E74C3C", "#1ABC9C", "#F39C12", "#2C3E50"];

export default function ReportsPage() {
  const { token } = useAppStore();
  const [activeTab, setActiveTab] = useState("bookings");
  const [bookingsPeriod, setBookingsPeriod] = useState<ReportPeriod>("30d");
  const [teamPeriod, setTeamPeriod] = useState<ReportPeriod>("30d");

  const [bookingsData, setBookingsData] = useState<BookingsReport | null>(null);
  const [productsData, setProductsData] = useState<ProductsReport | null>(null);
  const [teamData, setTeamData] = useState<TeamReport | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async (period: ReportPeriod) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/reports?type=bookings&period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setBookingsData(data);
      setError(null);
    } catch (err) {
      setError("Impossible de charger les données");
    }
  }, [token]);

  const fetchProducts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/reports?type=products", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setProductsData(data);
      setError(null);
    } catch (err) {
      setError("Impossible de charger les données");
    }
  }, [token]);

  const fetchTeam = useCallback(async (period: ReportPeriod) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/reports?type=team&period=${period}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur de chargement");
      const data = await res.json();
      setTeamData(data);
      setError(null);
    } catch (err) {
      setError("Impossible de charger les données");
    }
  }, [token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchBookings(bookingsPeriod),
      fetchProducts(),
      fetchTeam(teamPeriod),
    ]);
    setLoading(false);
  }, [fetchBookings, fetchProducts, fetchTeam, bookingsPeriod, teamPeriod]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch when period changes
  const handleBookingsPeriodChange = (p: ReportPeriod) => {
    setBookingsPeriod(p);
    fetchBookings(p);
  };

  const handleTeamPeriodChange = (p: ReportPeriod) => {
    setTeamPeriod(p);
    fetchTeam(p);
  };

  const formatXAF = (n: number) =>
    new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

  const periodOptions: { value: ReportPeriod; label: string }[] = [
    { value: "7d", label: "7j" },
    { value: "30d", label: "30j" },
    { value: "90d", label: "90j" },
  ];

  // Export bookings CSV
  const exportBookingsCSV = () => {
    if (!bookingsData) return;
    const headers = ["Date", "Réservations"];
    const rows = bookingsData.bookingsByDay.map((d) => [d.date, d.count.toString()]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-reservations-${bookingsPeriod}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Bookings chart data ----
  const bookingsChartData = (bookingsData?.bookingsByDay || []).map((d) => ({
    name: new Date(d.date + "T00:00:00").toLocaleDateString("fr", { day: "2-digit", month: "short" }),
    count: d.count,
  }));

  // ---- Summary calculations ----
  const totalBookings = bookingsData
    ? bookingsData.bookingsByStatus.pending +
      bookingsData.bookingsByStatus.confirmed +
      bookingsData.bookingsByStatus.completed +
      bookingsData.bookingsByStatus.cancelled
    : 0;

  const confirmedRate = totalBookings > 0
    ? ((bookingsData!.bookingsByStatus.completed / totalBookings) * 100).toFixed(1)
    : "0";

  const cancelledRate = totalBookings > 0
    ? ((bookingsData!.bookingsByStatus.cancelled / totalBookings) * 100).toFixed(1)
    : "0";

  // Max for category bars
  const maxCategoryCount = productsData
    ? Math.max(...productsData.productsByCategory.map((c) => c.count), 1)
    : 1;

  if (loading) {
    return (
      <>
        <Header title="Rapports & Analytiques" subtitle="Analysez votre activite en detail" />
        <div className="p-6 space-y-6">
          <div className="h-10 w-64 bg-muted rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-72 bg-muted rounded-xl animate-pulse" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Rapports & Analytiques" subtitle="Analysez votre activite en detail">
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={fetchAll}>
          <RefreshCw className="w-3 h-3" />
          Actualiser
        </Button>
      </Header>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}

      <div className="p-6 space-y-6 animate-fade-in">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="bookings" className="gap-1.5">
              <CalendarCheck className="w-4 h-4" />
              Réservations
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-1.5">
              <Package className="w-4 h-4" />
              Produits
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5">
              <Users className="w-4 h-4" />
              Équipe
            </TabsTrigger>
          </TabsList>

          {/* ==================== BOOKINGS TAB ==================== */}
          <TabsContent value="bookings" className="space-y-6 mt-4">
            {/* Period Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Periode:</span>
                {periodOptions.map((p) => (
                  <Button
                    key={p.value}
                    variant={bookingsPeriod === p.value ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleBookingsPeriodChange(p.value)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={exportBookingsCSV}>
                <Download className="w-3 h-3" />
                Exporter CSV
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-500/15 flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{totalBookings}</p>
                    <p className="text-xs text-muted-foreground">Total réservations</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-500/15 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{confirmedRate}%</p>
                    <p className="text-xs text-muted-foreground">Taux de confirmation</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-500/15 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{cancelledRate}%</p>
                    <p className="text-xs text-muted-foreground">Taux d'annulation</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {bookingsData && (
                <>
                  {[
                    { label: "En attente", count: bookingsData.bookingsByStatus.pending, color: "bg-yellow-400", icon: Clock },
                    { label: "Confirmées", count: bookingsData.bookingsByStatus.confirmed, color: "bg-blue-500", icon: CheckCircle },
                    { label: "Terminées", count: bookingsData.bookingsByStatus.completed, color: "bg-green-500", icon: CheckCircle },
                    { label: "Annulées", count: bookingsData.bookingsByStatus.cancelled, color: "bg-red-500", icon: XCircle },
                  ].map((s) => (
                    <Card key={s.label} className="border-0 shadow-sm">
                      <CardContent className="p-3 text-center">
                        <s.icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-lg font-bold text-foreground">{s.count}</p>
                        <p className="text-[11px] text-muted-foreground">{s.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>

            {/* Bookings Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  Réservations par jour ({bookingsPeriod === "7d" ? "7 derniers jours" : bookingsPeriod === "30d" ? "30 derniers jours" : "90 derniers jours"})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookingsChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={bookingsChartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 10 }}
                        interval={bookingsPeriod === "90d" ? 6 : 0}
                      />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: number) => [value, "Réservations"]}
                      />
                      <Bar dataKey="count" fill="#25D366" radius={[3, 3, 0, 0]} maxBarSize={bookingsPeriod === "90d" ? 12 : 30} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                    Aucune donnée disponible
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Table + Top Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bookings by Agent */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Réservations par agent</CardTitle>
                </CardHeader>
                <CardContent>
                  {bookingsData && bookingsData.bookingsByAgent.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll">
                      <div className="grid grid-cols-3 gap-2 text-[11px] font-medium text-muted-foreground px-2 pb-1 border-b border-border">
                        <span>Agent</span>
                        <span className="text-center">Type</span>
                        <span className="text-right">Réservations</span>
                      </div>
                      {bookingsData.bookingsByAgent.map((a, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-3 gap-2 items-center py-1.5 px-2 rounded hover:bg-muted/50"
                        >
                          <span className="text-sm text-foreground truncate">{a.agentName}</span>
                          <span className="text-center">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {a.agentType}
                            </Badge>
                          </span>
                          <span className="text-sm font-semibold text-foreground text-right">
                            {a.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucune donnée</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Services */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Top 5 services</CardTitle>
                </CardHeader>
                <CardContent>
                  {bookingsData && bookingsData.topServices.length > 0 ? (
                    <div className="space-y-3">
                      {bookingsData.topServices.slice(0, 5).map((s, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{s.serviceName}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs font-semibold shrink-0">
                            {s.count}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucun service</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Revenue by Agent */}
            {bookingsData && bookingsData.revenueByAgent.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Revenus par agent (Telegram)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {bookingsData.revenueByAgent.map((a, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-sm text-foreground w-40 truncate">{a.agentName}</span>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                (a.total / Math.max(...bookingsData!.revenueByAgent.map((r) => r.total), 1)) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-foreground w-32 text-right">
                          {formatXAF(a.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== PRODUCTS TAB ==================== */}
          <TabsContent value="products" className="space-y-6 mt-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center">
                    <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{productsData?.totalProducts ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Total produits</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-500/15 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{productsData?.activeProducts ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Produits actifs</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-500/15 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{productsData?.categoriesCount ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Categories</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Products by Category */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Produits par categorie</CardTitle>
                </CardHeader>
                <CardContent>
                  {productsData && productsData.productsByCategory.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto custom-scroll">
                      {productsData.productsByCategory.map((cat, i) => (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-foreground truncate">{cat.categoryName}</span>
                            <span className="font-semibold text-foreground shrink-0 ml-2">{cat.count}</span>
                          </div>
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${(cat.count / maxCategoryCount) * 100}%`,
                                backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">Aucune categorie</p>
                  )}
                </CardContent>
              </Card>

              {/* Low Stock Alerts */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Alertes stock faible
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {productsData && productsData.lowStockProducts.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scroll">
                      {productsData.lowStockProducts.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 border border-border/50"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                p.stock === 0
                                  ? "bg-red-500"
                                  : p.stock < 3
                                  ? "bg-orange-500"
                                  : "bg-yellow-500"
                              }`}
                            />
                            <span className="text-sm text-foreground truncate">{p.name}</span>
                          </div>
                          <Badge
                            variant={p.stock === 0 ? "destructive" : "outline"}
                            className={`text-[11px] shrink-0 ${
                              p.stock === 0
                                ? ""
                                : p.stock < 3
                                ? "border-orange-300 text-orange-600 dark:border-orange-500/30 dark:text-orange-400"
                                : "border-yellow-300 text-yellow-600 dark:border-yellow-500/30 dark:text-yellow-400"
                            }`}
                          >
                            {p.stock === 0 ? "Rupture" : `${p.stock} en stock`}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                      <p className="text-sm">Tous les produits sont en stock</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== TEAM TAB ==================== */}
          <TabsContent value="team" className="space-y-6 mt-4">
            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Periode:</span>
              {periodOptions.map((p) => (
                <Button
                  key={p.value}
                  variant={teamPeriod === p.value ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleTeamPeriodChange(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {teamData && teamData.teamMembers.length > 0 ? (
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Performance de l'équipe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-2 text-[11px] font-medium text-muted-foreground">Membre</th>
                          <th className="text-center py-2 px-2 text-[11px] font-medium text-muted-foreground">Rôle</th>
                          <th className="text-center py-2 px-2 text-[11px] font-medium text-muted-foreground">Réservations</th>
                          <th className="text-center py-2 px-2 text-[11px] font-medium text-muted-foreground">Livrées</th>
                          <th className="text-center py-2 px-2 text-[11px] font-medium text-muted-foreground">Conversations</th>
                          <th className="text-right py-2 px-2 text-[11px] font-medium text-muted-foreground">Revenu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamData.teamMembers.map((m, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2.5 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                  {m.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)}
                                </div>
                                <span className="font-medium text-foreground truncate">{m.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {m.role}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-2 text-center font-semibold text-foreground">
                              {m.bookingsHandled}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                {m.deliveredOrders}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center text-foreground">
                              {m.totalConversations}
                            </td>
                            <td className="py-2.5 px-2 text-right font-semibold text-foreground">
                              {formatXAF(m.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center gap-3">
                    <Users className="w-10 h-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Aucune donnée d'équipe</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ajoutez des membres à votre équipe pour voir les performances
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Team Performance Bars */}
            {teamData && teamData.teamMembers.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Réservations par membre</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {teamData.teamMembers
                        .sort((a, b) => b.bookingsHandled - a.bookingsHandled)
                        .map((m, i) => {
                          const maxVal = Math.max(
                            ...teamData!.teamMembers.map((t) => t.bookingsHandled),
                            1
                          );
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs text-foreground w-28 truncate">{m.name}</span>
                              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-green-500 transition-all duration-500"
                                  style={{ width: `${(m.bookingsHandled / maxVal) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-foreground w-8 text-right">
                                {m.bookingsHandled}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Revenus par membre</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {teamData.teamMembers
                        .sort((a, b) => b.revenue - a.revenue)
                        .map((m, i) => {
                          const maxVal = Math.max(
                            ...teamData!.teamMembers.map((t) => t.revenue),
                            1
                          );
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="text-xs text-foreground w-28 truncate">{m.name}</span>
                              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                  style={{ width: `${(m.revenue / maxVal) * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-foreground w-24 text-right">
                                {formatXAF(m.revenue)}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
