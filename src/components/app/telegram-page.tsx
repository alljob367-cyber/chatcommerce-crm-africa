"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Bot,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  UtensilsCrossed,
  Scissors,
  MapPin,
  Phone,
  CreditCard,
  Loader2,
  AlertCircle,
  CalendarDays,
  Users,
  Settings2,
  Zap,
  TrendingUp,
  Eye,
  Power,
  PowerOff,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Copy,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

interface TelegramAgent {
  id: string;
  name: string;
  token: string;
  botUsername: string | null;
  businessType: string;
  isActive: boolean;
  welcomeMessage: string | null;
  address: string | null;
  phone: string | null;
  openHours: string | null;
  currency: string;
  paymentMethod: string | null;
  _count: { services: number; bookings: number };
}

interface BusinessService {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number | null;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface TelegramBooking {
  id: string;
  agentId: string;
  chatId: string;
  customerName: string;
  customerPhone: string | null;
  serviceId: string | null;
  serviceName: string | null;
  bookingDate: string | null;
  bookingTime: string | null;
  notes: string | null;
  status: string;
  agent: { name: string; businessType: string };
  createdAt: string;
}

interface TelegramStats {
  summary: {
    totalAgents: number;
    activeAgents: number;
    totalServices: number;
    totalBookings: number;
    todayBookings: number;
    pendingBookings: number;
    confirmedBookings: number;
    completedBookings: number;
    thisMonthBookings: number;
  };
  agents: Array<{
    id: string;
    name: string;
    businessType: string;
    isActive: boolean;
    _count: { services: number; bookings: number };
  }>;
  recentBookings: TelegramBooking[];
  dailyBookings: Array<{ date: string; count: number }>;
}

// ─── Status Badge Helper ─────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmed: { label: "Confirmé", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Terminé", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  cancelled: { label: "Annulé", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.pending;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

// ─── Main Component ──────────────────────────────────────────────

export default function TelegramPage() {
  const { token } = useAppStore();

  // Data states
  const [agents, setAgents] = useState<TelegramAgent[]>([]);
  const [bookings, setBookings] = useState<TelegramBooking[]>([]);
  const [stats, setStats] = useState<TelegramStats | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);

  // Agent form dialog
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<TelegramAgent | null>(null);
  const [agentForm, setAgentForm] = useState({
    name: "",
    token: "",
    botUsername: "",
    businessType: "restaurant",
    welcomeMessage: "",
    address: "",
    phone: "",
    currency: "XAF",
    paymentMethod: "",
  });
  const [agentSaving, setAgentSaving] = useState(false);

  // Activate dialog
  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [activateAgent, setActivateAgent] = useState<TelegramAgent | null>(null);
  const [activateToken, setActivateToken] = useState("");
  const [activating, setActivating] = useState(false);

  // Services dialog
  const [servicesDialogOpen, setServicesDialogOpen] = useState(false);
  const [servicesAgent, setServicesAgent] = useState<TelegramAgent | null>(null);
  const [services, setServices] = useState<BusinessService[]>([]);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    price: "",
    duration: "",
    isActive: true,
  });
  const [serviceSaving, setServiceSaving] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  // ─── Fetch Data ────────────────────────────────────────────────

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/agents", { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      toast.error("Erreur lors du chargement des agents");
    }
  }, [headers]);

  const fetchBookings = useCallback(async (status?: string) => {
    try {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      const res = await fetch(`/api/telegram/bookings?${params}`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      toast.error("Erreur lors du chargement des réservations");
    }
  }, [headers]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/stats", { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStats(data);
    } catch {
      // Stats are optional
    }
  }, [headers]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchBookings(), fetchStats()]);
      setLoading(false);
    };
    load();
  }, [fetchAgents, fetchBookings, fetchStats]);

  // ─── One-Click Setup ───────────────────────────────────────────

  const handleOneClickSetup = async () => {
    setSettingUp(true);
    try {
      const res = await fetch("/api/telegram/setup", {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Agents créés avec succès !");
      await Promise.all([fetchAgents(), fetchStats()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSettingUp(false);
    }
  };

  // ─── Activate Agent ────────────────────────────────────────────

  const openActivateDialog = (agent: TelegramAgent) => {
    setActivateAgent(agent);
    setActivateToken("");
    setActivateDialogOpen(true);
  };

  const activateAgentBot = async () => {
    if (!activateAgent || !activateToken.trim()) {
      toast.error("Token requis");
      return;
    }
    setActivating(true);
    try {
      const res = await fetch("/api/telegram/activate", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: activateAgent.id, token: activateToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Agent activé !");
      setActivateDialogOpen(false);
      await Promise.all([fetchAgents(), fetchStats()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'activation");
    } finally {
      setActivating(false);
    }
  };

  // ─── Stats Cards ───────────────────────────────────────────────

  const s = stats?.summary;

  const statCards = [
    { label: "Agents Actifs", value: s?.activeAgents ?? 0, icon: Bot, color: "text-[#0088cc]", bg: "bg-[#0088cc]/10" },
    { label: "Réservations Aujourd'hui", value: s?.todayBookings ?? 0, icon: CalendarDays, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40" },
    { label: "En Attente", value: s?.pendingBookings ?? 0, icon: Clock, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/40" },
    { label: "Ce Mois", value: s?.thisMonthBookings ?? 0, icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/40" },
  ];

  // ─── Agent CRUD ────────────────────────────────────────────────

  const openCreateAgent = () => {
    setEditingAgent(null);
    setAgentForm({
      name: "",
      token: "",
      botUsername: "",
      businessType: "restaurant",
      welcomeMessage: "",
      address: "",
      phone: "",
      currency: "XAF",
      paymentMethod: "",
    });
    setAgentDialogOpen(true);
  };

  const openEditAgent = (agent: TelegramAgent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      token: agent.token,
      botUsername: agent.botUsername || "",
      businessType: agent.businessType,
      welcomeMessage: agent.welcomeMessage || "",
      address: agent.address || "",
      phone: agent.phone || "",
      currency: agent.currency,
      paymentMethod: agent.paymentMethod || "",
    });
    setAgentDialogOpen(true);
  };

  const saveAgent = async () => {
    if (!agentForm.name || !agentForm.token) {
      toast.error("Nom et token requis");
      return;
    }
    setAgentSaving(true);
    try {
      if (editingAgent) {
        const res = await fetch(`/api/telegram/agents/${editingAgent.id}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(agentForm),
        });
        if (!res.ok) throw new Error();
        toast.success("Agent mis à jour");
      } else {
        const res = await fetch("/api/telegram/agents", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(agentForm),
        });
        if (!res.ok) throw new Error();
        toast.success("Agent créé");
      }
      setAgentDialogOpen(false);
      await fetchAgents();
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setAgentSaving(false);
    }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm("Supprimer cet agent et toutes ses données ?")) return;
    try {
      const res = await fetch(`/api/telegram/agents/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error();
      toast.success("Agent supprimé");
      await fetchAgents();
      await fetchBookings(bookingStatusFilter);
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  const toggleAgentActive = async (agent: TelegramAgent) => {
    try {
      const res = await fetch(`/api/telegram/agents/${agent.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      if (!res.ok) throw new Error();
      await fetchAgents();
    } catch {
      toast.error("Erreur lors du changement de statut");
    }
  };

  // ─── Services Management ───────────────────────────────────────

  const openServices = async (agent: TelegramAgent) => {
    setServicesAgent(agent);
    setServiceForm({ name: "", description: "", price: "", duration: "", isActive: true });
    setServicesDialogOpen(true);
    setServicesLoading(true);
    try {
      const res = await fetch(`/api/telegram/agents/${agent.id}/services`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setServices(data.services || []);
    } catch {
      toast.error("Erreur lors du chargement des services");
    } finally {
      setServicesLoading(false);
    }
  };

  const saveService = async () => {
    if (!servicesAgent || !serviceForm.name || !serviceForm.price) {
      toast.error("Nom et prix requis");
      return;
    }
    setServiceSaving(true);
    try {
      const res = await fetch(`/api/telegram/agents/${servicesAgent.id}/services`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(serviceForm),
      });
      if (!res.ok) throw new Error();
      toast.success("Service ajouté");
      setServiceForm({ name: "", description: "", price: "", duration: "", isActive: true });
      const svcRes = await fetch(`/api/telegram/agents/${servicesAgent.id}/services`, { headers });
      if (svcRes.ok) {
        const data = await svcRes.json();
        setServices(data.services || []);
      }
      await fetchAgents();
    } catch {
      toast.error("Erreur lors de l'ajout du service");
    } finally {
      setServiceSaving(false);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!servicesAgent) return;
    try {
      await fetch(`/api/telegram/agents/${servicesAgent.id}/services?serviceId=${serviceId}`, {
        method: "DELETE",
        headers,
      });
      setServices((prev) => prev.filter((sv) => sv.id !== serviceId));
      toast.success("Service supprimé");
      await fetchAgents();
    } catch {
      setServices((prev) => prev.filter((sv) => sv.id !== serviceId));
    }
  };

  const updateBookingStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/telegram/bookings", {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Réservation ${status === "confirmed" ? "confirmée" : status === "completed" ? "terminée" : "annulée"}`);
      await fetchBookings(bookingStatusFilter);
      await fetchStats();
    } catch {
      toast.error("Erreur lors de la mise à jour");
    }
  };

  // ─── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasAgents = agents.length > 0;
  const isPlaceholder = (t: string) => t.startsWith("PLACEHOLDER_");

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-7 h-7 text-[#0088cc]" />
            Agents Telegram
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            12 types de bots pre-configures : Restaurant, Salon, Pharmacie, Taxi,
            Pressing, Ecole, Supermarche, Clinique, Voyage, Boulangerie, Garage, Sport
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOneClickSetup} disabled={settingUp} variant="outline" className="gap-2">
            {settingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {hasAgents ? "Ajouter Agents Manquants" : "Creer les 12 Agents"}
          </Button>
          <Button onClick={openCreateAgent} className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
            <Plus className="w-4 h-4" />
            Agent Personnalisé
          </Button>
        </div>
      </div>

      {/* ─── Empty State ─── */}
      {!hasAgents && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-6">
            <div className="w-20 h-20 rounded-full bg-[#0088cc]/10 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-[#0088cc]" />
            </div>
            <div className="space-y-2 max-w-lg">
              <h2 className="text-xl font-bold text-foreground">12 Agents Telegram Prêts à l&apos;Emploi</h2>
              <p className="text-muted-foreground">
                Créez instantanément des bots pour toutes vos activites commerciales.
                Menus, services et tarifs sont pre-configures — collez votre token et c&apos;est parti.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 w-full max-w-3xl">
              {[
                { icon: UtensilsCrossed, label: "Restaurant", desc: "12 plats camerounais", bg: "bg-orange-100 dark:bg-orange-900/30", color: "text-orange-600" },
                { icon: Scissors, label: "Salon Coiffure", desc: "14 prestations", bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600" },
                { icon: Bot, label: "Pharmacie", desc: "10 services sante", bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600" },
                { icon: MapPin, label: "Taxi Transport", desc: "9 types de courses", bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600" },
                { icon: ShoppingBag, label: "Pressing", desc: "11 services laverie", bg: "bg-cyan-100 dark:bg-cyan-900/30", color: "text-cyan-600" },
                { icon: Users, label: "Ecole / Formation", desc: "11 formations", bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600" },
                { icon: ShoppingBag, label: "Supermarche", desc: "12 produits courses", bg: "bg-lime-100 dark:bg-lime-900/30", color: "text-lime-600" },
                { icon: Bot, label: "Clinique", desc: "10 services medical", bg: "bg-red-100 dark:bg-red-900/30", color: "text-red-600" },
                { icon: MessageCircle, label: "Agence Voyage", desc: "10 services voyage", bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600" },
                { icon: Sparkles, label: "Boulangerie", desc: "11 produits boulange", bg: "bg-yellow-100 dark:bg-yellow-900/30", color: "text-yellow-600" },
                { icon: Zap, label: "Garage Auto", desc: "10 services auto", bg: "bg-zinc-100 dark:bg-zinc-800/50", color: "text-zinc-600" },
                { icon: Users, label: "Salle de Sport", desc: "10 abonnements", bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600" },
              ].map((a) => (
                <Card key={a.label} className="border hover:shadow-md transition-shadow cursor-pointer" onClick={handleOneClickSetup}>
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
                      <a.icon className={`w-5 h-5 ${a.color}`} />
                    </div>
                    <h3 className="font-semibold text-xs">{a.label}</h3>
                    <p className="text-[10px] text-muted-foreground text-center">{a.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button size="lg" onClick={handleOneClickSetup} disabled={settingUp} className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
              {settingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {settingUp ? "Création en cours..." : "Creer Mes 12 Agents Maintenant"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Dashboard Stats ─── */}
      {hasAgents && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                    <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard" className="gap-2">
                <Eye className="w-4 h-4" />
                Vue d&apos;ensemble
              </TabsTrigger>
              <TabsTrigger value="agents" className="gap-2">
                <Bot className="w-4 h-4" />
                Agents
                {agents.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{agents.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="bookings" className="gap-2">
                <CalendarDays className="w-4 h-4" />
                Réservations
                {bookings.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">{bookings.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ─── Dashboard Tab ─── */}
            <TabsContent value="dashboard" className="space-y-4 mt-4">
              {/* Agents Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent) => (
                  <Card key={agent.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${agent.businessType === "restaurant" ? "bg-orange-100 dark:bg-orange-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                            {agent.businessType === "restaurant" ? (
                              <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                            ) : (
                              <Scissors className="w-5 h-5 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-base">{agent.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {agent.businessType === "restaurant" ? "Restaurant" : "Salon de Coiffure"}
                              {" · "}
                              {agent._count.services} services
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {agent.isActive ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                              Actif
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                              Inactif
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold">{agent._count.services}</p>
                          <p className="text-xs text-muted-foreground">Services</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold">{agent._count.bookings}</p>
                          <p className="text-xs text-muted-foreground">Réservations</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold">
                            {isPlaceholder(agent.token) ? (
                              <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">Token</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        {isPlaceholder(agent.token) ? (
                          <Button size="sm" onClick={() => openActivateDialog(agent)} className="gap-2 bg-[#0088cc] hover:bg-[#006699] flex-1">
                            <Power className="w-4 h-4" />
                            Activer avec Token Telegram
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openServices(agent)} className="gap-2 flex-1">
                              <ShoppingBag className="w-4 h-4" />
                              Services ({agent._count.services})
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openEditAgent(agent)} className="gap-2">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => toggleAgentActive(agent)} className="gap-2">
                              {agent.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recent Bookings */}
              {bookings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Dernières Réservations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Heure</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.slice(0, 5).map((b) => (
                            <TableRow key={b.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-sm">{b.customerName}</p>
                                  {b.customerPhone && <p className="text-xs text-muted-foreground">{b.customerPhone}</p>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {b.agent.businessType === "restaurant" ? (
                                      <UtensilsCrossed className="w-3 h-3 mr-1" />
                                    ) : (
                                      <Scissors className="w-3 h-3 mr-1" />
                                    )}
                                    {b.serviceName || "—"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">{b.bookingDate || "—"}</TableCell>
                              <TableCell className="text-sm">{b.bookingTime || "—"}</TableCell>
                              <TableCell><StatusBadge status={b.status} /></TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  {b.status === "pending" && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "confirmed")} className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "cancelled")} className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                  {b.status === "confirmed" && (
                                    <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "completed")} className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ─── Agents Tab ─── */}
            <TabsContent value="agents" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {agents.map((agent) => (
                  <Card key={agent.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${agent.businessType === "restaurant" ? "bg-orange-100 dark:bg-orange-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                            {agent.businessType === "restaurant" ? (
                              <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                            ) : (
                              <Scissors className="w-5 h-5 text-purple-600" />
                            )}
                          </div>
                          <div>
                            <CardTitle className="text-sm">{agent.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {agent.botUsername || "Pas de username"}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={agent.isActive}
                          onCheckedChange={() => toggleAgentActive(agent)}
                          disabled={isPlaceholder(agent.token)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Info */}
                      <div className="space-y-1.5 text-xs">
                        {agent.address && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{agent.address}</span>
                          </div>
                        )}
                        {agent.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span>{agent.phone}</span>
                          </div>
                        )}
                        {agent.paymentMethod && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CreditCard className="w-3.5 h-3.5 shrink-0" />
                            <span>{agent.paymentMethod === "orange_money" ? "Orange Money" : agent.paymentMethod === "mtn_money" ? "MTN Mobile Money" : agent.paymentMethod}</span>
                          </div>
                        )}
                      </div>

                      {/* Token Status */}
                      <div className={`p-2 rounded-lg text-xs flex items-center gap-2 ${isPlaceholder(agent.token) ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"}`}>
                        {isPlaceholder(agent.token) ? (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            Token placeholder — cliquez pour activer
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                            Bot connecté et actif
                          </>
                        )}
                      </div>

                      {/* Counts */}
                      <div className="flex gap-3 text-center">
                        <div className="flex-1 p-2 rounded-lg bg-muted/50">
                          <p className="text-sm font-bold">{agent._count.services}</p>
                          <p className="text-[10px] text-muted-foreground">Services</p>
                        </div>
                        <div className="flex-1 p-2 rounded-lg bg-muted/50">
                          <p className="text-sm font-bold">{agent._count.bookings}</p>
                          <p className="text-[10px] text-muted-foreground">Réservations</p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        {isPlaceholder(agent.token) ? (
                          <Button size="sm" onClick={() => openActivateDialog(agent)} className="gap-2 flex-1 bg-[#0088cc] hover:bg-[#006699] text-white">
                            <Power className="w-3.5 h-3.5" />
                            Activer
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => openServices(agent)} className="gap-2 flex-1">
                            <ShoppingBag className="w-3.5 h-3.5" />
                            Services
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEditAgent(agent)} className="gap-2">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => deleteAgent(agent.id)} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ─── Bookings Tab ─── */}
            <TabsContent value="bookings" className="space-y-4 mt-4">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex gap-2 flex-wrap">
                  {["all", "pending", "confirmed", "completed", "cancelled"].map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={bookingStatusFilter === status ? "default" : "outline"}
                      onClick={() => {
                        setBookingStatusFilter(status);
                        fetchBookings(status);
                      }}
                      className="text-xs"
                    >
                      {status === "all" ? "Toutes" : statusConfig[status]?.label || status}
                      {status !== "all" && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {status === "all"
                            ? bookings.length
                            : bookings.filter((b) => b.status === status).length}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
                <Button size="sm" variant="outline" onClick={() => { fetchBookings(bookingStatusFilter); fetchStats(); }} className="gap-2 ml-auto">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Actualiser
                </Button>
              </div>

              {/* Bookings Table */}
              {bookings.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucune réservation pour le moment</p>
                    <p className="text-xs text-muted-foreground mt-1">Les réservations apparaîtront quand vos clients utiliseront vos bots Telegram</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Client</TableHead>
                            <TableHead>Service</TableHead>
                            <TableHead>Agent</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Heure</TableHead>
                            <TableHead>Téléphone</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Créé le</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bookings.map((b) => (
                            <TableRow key={b.id}>
                              <TableCell>
                                <p className="font-medium text-sm">{b.customerName}</p>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {b.agent.businessType === "restaurant" ? (
                                    <UtensilsCrossed className="w-3 h-3 text-orange-500" />
                                  ) : (
                                    <Scissors className="w-3 h-3 text-purple-500" />
                                  )}
                                  <span className="text-sm">{b.serviceName || "—"}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{b.agent.name}</TableCell>
                              <TableCell className="text-sm">{b.bookingDate || "—"}</TableCell>
                              <TableCell className="text-sm">{b.bookingTime || "—"}</TableCell>
                              <TableCell className="text-sm">{b.customerPhone || "—"}</TableCell>
                              <TableCell><StatusBadge status={b.status} /></TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(b.createdAt).toLocaleDateString("fr-FR")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  {b.status === "pending" && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "confirmed")} className="h-7 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50" title="Confirmer">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "cancelled")} className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50" title="Annuler">
                                        <XCircle className="w-3.5 h-3.5" />
                                      </Button>
                                    </>
                                  )}
                                  {b.status === "confirmed" && (
                                    <Button size="sm" variant="ghost" onClick={() => updateBookingStatus(b.id, "completed")} className="h-7 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50" title="Terminer">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ─── Agent Create/Edit Dialog ─── */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "Modifier l'Agent" : "Nouvel Agent Telegram"}</DialogTitle>
            <DialogDescription>
              {editingAgent ? "Modifiez les informations de votre bot" : "Créez un nouveau bot de réservation Telegram"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                placeholder="Ex: Restaurant Le Paradis"
                value={agentForm.name}
                onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de Business *</Label>
              <Select value={agentForm.businessType} onValueChange={(v) => setAgentForm({ ...agentForm, businessType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">
                    <span className="flex items-center gap-2"><UtensilsCrossed className="w-4 h-4" /> Restaurant</span>
                  </SelectItem>
                  <SelectItem value="salon_coiffure">
                    <span className="flex items-center gap-2"><Scissors className="w-4 h-4" /> Salon de Coiffure</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Token Bot *</Label>
              <Input
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={agentForm.token}
                onChange={(e) => setAgentForm({ ...agentForm, token: e.target.value })}
                type="password"
              />
              <p className="text-xs text-muted-foreground">
                Obtenez votre token via @BotFather sur Telegram
              </p>
            </div>
            <div className="space-y-2">
              <Label>Username du Bot</Label>
              <Input
                placeholder="@mon_restaurant_bot"
                value={agentForm.botUsername}
                onChange={(e) => setAgentForm({ ...agentForm, botUsername: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input
                placeholder="Douala, Quartier Bonapriso"
                value={agentForm.address}
                onChange={(e) => setAgentForm({ ...agentForm, address: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input
                placeholder="+237 6XX XXX XXX"
                value={agentForm.phone}
                onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Devise</Label>
                <Select value={agentForm.currency} onValueChange={(v) => setAgentForm({ ...agentForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">FCFA (XAF)</SelectItem>
                    <SelectItem value="XOF">FCFA (XOF)</SelectItem>
                    <SelectItem value="EUR">Euro</SelectItem>
                    <SelectItem value="USD">Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paiement</Label>
                <Select value={agentForm.paymentMethod} onValueChange={(v) => setAgentForm({ ...agentForm, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orange_money">Orange Money</SelectItem>
                    <SelectItem value="mtn_money">MTN Mobile Money</SelectItem>
                    <SelectItem value="cash">Espèces</SelectItem>
                    <SelectItem value="">Aucun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Message de bienvenue</Label>
              <Textarea
                placeholder="Message affiché quand un client lance le bot..."
                rows={3}
                value={agentForm.welcomeMessage}
                onChange={(e) => setAgentForm({ ...agentForm, welcomeMessage: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveAgent} disabled={agentSaving} className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
              {agentSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingAgent ? "Mettre à jour" : "Créer l'Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Activate Dialog ─── */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5 text-[#0088cc]" />
              Activer le Bot Telegram
            </DialogTitle>
            <DialogDescription>
              Connectez votre bot en entrant le token fourni par @BotFather
            </DialogDescription>
          </DialogHeader>
          {activateAgent && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activateAgent.businessType === "restaurant" ? "bg-orange-100 dark:bg-orange-900/30" : "bg-purple-100 dark:bg-purple-900/30"}`}>
                  {activateAgent.businessType === "restaurant" ? (
                    <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                  ) : (
                    <Scissors className="w-5 h-5 text-purple-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">{activateAgent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {activateAgent._count.services} services pré-configurés
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Token du Bot *</Label>
                <Input
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  value={activateToken}
                  onChange={(e) => setActivateToken(e.target.value)}
                  type="password"
                />
              </div>

              <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 space-y-2">
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Comment obtenir votre token :</p>
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>Ouvrez Telegram et recherchez <b>@BotFather</b></li>
                  <li>Envoyez <b>/newbot</b> et suivez les instructions</li>
                  <li>Choisissez un nom et un username pour votre bot</li>
                  <li>Copiez le token que BotFather vous donne</li>
                  <li>Collez-le ci-dessus et cliquez sur Activer</li>
                </ol>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>Annuler</Button>
                <Button onClick={activateAgentBot} disabled={activating || !activateToken.trim()} className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  Activer le Bot
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Services Dialog ─── */}
      <Dialog open={servicesDialogOpen} onOpenChange={setServicesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Services — {servicesAgent?.name}
            </DialogTitle>
            <DialogDescription>
              Gérez les {servicesAgent?.businessType === "restaurant" ? "plats de votre menu" : "prestations de votre salon"}
            </DialogDescription>
          </DialogHeader>

          {/* Service List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
            {servicesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : services.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun service configuré</p>
            ) : (
              services.map((svc, i) => (
                <div key={svc.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{svc.name}</p>
                      {svc.duration && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Clock className="w-3 h-3" />
                          {svc.duration}min
                        </Badge>
                      )}
                    </div>
                    {svc.description && (
                      <p className="text-xs text-muted-foreground truncate">{svc.description}</p>
                    )}
                  </div>
                  <p className="font-semibold text-sm whitespace-nowrap">
                    {svc.price.toLocaleString()} FCFA
                  </p>
                  <Button size="sm" variant="ghost" onClick={() => deleteService(svc.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Add Service Form */}
          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium">Ajouter un service</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                placeholder="Nom du service"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
              />
              <Input
                placeholder="Prix (FCFA)"
                value={serviceForm.price}
                onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                type="number"
              />
              <Input
                placeholder="Durée (minutes, optionnel)"
                value={serviceForm.duration}
                onChange={(e) => setServiceForm({ ...serviceForm, duration: e.target.value })}
                type="number"
              />
              <Input
                placeholder="Description (optionnel)"
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              />
            </div>
            <Button onClick={saveService} disabled={serviceSaving || !serviceForm.name || !serviceForm.price} size="sm" className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
              {serviceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
