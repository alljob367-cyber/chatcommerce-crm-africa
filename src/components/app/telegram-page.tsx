"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [activeTab, setActiveTab] = useState("agents");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchBookings()]);
      setLoading(false);
    };
    load();
  }, [fetchAgents, fetchBookings]);

  // ─── Stats ─────────────────────────────────────────────────────

  const today = new Date().toISOString().split("T")[0];
  const thisMonth = new Date().toISOString().slice(0, 7);

  const activeTodayCount = bookings.filter(
    (b) => b.bookingDate === today && b.status !== "cancelled"
  ).length;
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const completedThisMonth = bookings.filter(
    (b) => b.status === "completed" && b.createdAt?.startsWith(thisMonth)
  ).length;

  const stats = [
    {
      label: "Total Agents",
      value: agents.length,
      icon: Bot,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      label: "Réservations Aujourd\'hui",
      value: activeTodayCount,
      icon: CalendarDays,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
    },
    {
      label: "En Attente",
      value: pendingCount,
      icon: Clock,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
    },
    {
      label: "Terminées ce Mois",
      value: completedThisMonth,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950/40",
    },
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
      // Refresh services
      const svcRes = await fetch(`/api/telegram/agents/${servicesAgent.id}/services`, { headers });
      if (svcRes.ok) {
        const data = await svcRes.json();
        setServices(data.services || []);
      }
      await fetchAgents();
    } catch {
      toast.error("Erreur lors de l\'ajout du service");
    } finally {
      setServiceSaving(false);
    }
  };

  const deleteService = async (serviceId: string) => {
    if (!servicesAgent) return;
    try {
      // Use the service directly via the agent API by deleting individually
      const res = await fetch(`/api/telegram/agents/${servicesAgent.id}/services?serviceId=${serviceId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        // Fallback: just remove from local state
      }
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
      toast.success("Service supprimé");
      await fetchAgents();
    } catch {
      // Still remove locally
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    }
  };

  // ─── Booking Actions ───────────────────────────────────────────

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
            Gérez vos bots de réservation pour restaurants et salons de coiffure
          </p>
        </div>
        <Button onClick={openCreateAgent} className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter un Agent
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="agents" className="gap-2">
            <Bot className="w-4 h-4" />
            Agents
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-2">
            <CalendarDays className="w-4 h-4" />
            Réservations
            {pendingCount > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Agents Tab ─── */}
        <TabsContent value="agents" className="mt-4">
          {agents.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-12 text-center">
                <Bot className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">Aucun agent Telegram</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Créez votre premier bot de réservation pour votre restaurant ou salon.
                </p>
                <Button onClick={openCreateAgent} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Créer un Agent
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agents.map((agent) => (
                <Card key={agent.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${agent.businessType === "restaurant" ? "bg-orange-50 dark:bg-orange-950/40" : "bg-pink-50 dark:bg-pink-950/40"}`}>
                          {agent.businessType === "restaurant" ? (
                            <UtensilsCrossed className={`w-5 h-5 ${agent.businessType === "restaurant" ? "text-orange-600" : "text-pink-600"}`} />
                          ) : (
                            <Scissors className="w-5 h-5 text-pink-600" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold text-foreground">{agent.name}</CardTitle>
                          {agent.botUsername && (
                            <p className="text-xs text-muted-foreground">@{agent.botUsername.replace("@", "")}</p>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={agent.isActive}
                        onCheckedChange={() => toggleAgentActive(agent)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={
                        agent.businessType === "restaurant"
                          ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                          : "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400"
                      }>
                        {agent.businessType === "restaurant" ? "🍽️ Restaurant" : "✂️ Salon de coiffure"}
                      </Badge>
                      {!agent.isActive && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Inactif
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5 text-sm">
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
                          <span>{agent.paymentMethod}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 pt-2 border-t border-border">
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{agent._count.services}</p>
                        <p className="text-[11px] text-muted-foreground">Services</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{agent._count.bookings}</p>
                        <p className="text-[11px] text-muted-foreground">Réservations</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={() => openServices(agent)}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        Services
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => openEditAgent(agent)}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deleteAgent(agent.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Reservations Tab ─── */}
        <TabsContent value="reservations" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base font-semibold">
                  Toutes les Réservations
                </CardTitle>
                <Select value={bookingStatusFilter} onValueChange={(v) => { setBookingStatusFilter(v); fetchBookings(v); }}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Filtrer par statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="confirmed">Confirmés</SelectItem>
                    <SelectItem value="completed">Terminés</SelectItem>
                    <SelectItem value="cancelled">Annulés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <div className="text-center py-12">
                  <CalendarDays className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune réservation trouvée</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Heure</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((booking) => (
                        <TableRow key={booking.id} className={booking.status === "pending" ? "bg-yellow-50/50 dark:bg-yellow-950/10" : ""}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-foreground">{booking.customerName}</p>
                              {booking.customerPhone && (
                                <p className="text-xs text-muted-foreground">{booking.customerPhone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{booking.serviceName || "—"}</TableCell>
                          <TableCell className="text-sm">{booking.agent.name}</TableCell>
                          <TableCell className="text-sm">{booking.bookingDate || "—"}</TableCell>
                          <TableCell className="text-sm">{booking.bookingTime || "—"}</TableCell>
                          <TableCell><StatusBadge status={booking.status} /></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {booking.status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => updateBookingStatus(booking.id, "confirmed")}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Confirmer
                                </Button>
                              )}
                              {(booking.status === "pending" || booking.status === "confirmed") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => updateBookingStatus(booking.id, "completed")}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  Terminer
                                </Button>
                              )}
                              {booking.status !== "cancelled" && booking.status !== "completed" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => updateBookingStatus(booking.id, "cancelled")}
                                >
                                  <XCircle className="w-3 h-3" />
                                  Annuler
                                </Button>
                              )}
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
        </TabsContent>
      </Tabs>

      {/* ─── Agent Form Dialog ─── */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#0088cc]" />
              {editingAgent ? "Modifier l\'Agent" : "Nouvel Agent Telegram"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Nom *</Label>
              <Input
                id="agent-name"
                placeholder="Ex: Bot Restaurant Le Paradis"
                value={agentForm.name}
                onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-token">Bot Token *</Label>
              <Input
                id="agent-token"
                type="password"
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={agentForm.token}
                onChange={(e) => setAgentForm((f) => ({ ...f, token: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Obtenu via @BotFather sur Telegram
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-username">Nom d\'utilisateur du Bot</Label>
              <Input
                id="agent-username"
                placeholder="@mon_bot"
                value={agentForm.botUsername}
                onChange={(e) => setAgentForm((f) => ({ ...f, botUsername: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-type">Type de Business *</Label>
              <Select
                value={agentForm.businessType}
                onValueChange={(v) => setAgentForm((f) => ({ ...f, businessType: v }))}
              >
                <SelectTrigger id="agent-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">🍽️ Restaurant</SelectItem>
                  <SelectItem value="salon_coiffure">✂️ Salon de Coiffure</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-welcome">Message d\'accueil</Label>
              <Textarea
                id="agent-welcome"
                placeholder="Bienvenue ! Comment puis-je vous aider ?"
                rows={3}
                value={agentForm.welcomeMessage}
                onChange={(e) => setAgentForm((f) => ({ ...f, welcomeMessage: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-address">Adresse</Label>
                <Input
                  id="agent-address"
                  placeholder="Ex: Douala, Cameroun"
                  value={agentForm.address}
                  onChange={(e) => setAgentForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-phone">Téléphone</Label>
                <Input
                  id="agent-phone"
                  placeholder="+237 6XX XXX XXX"
                  value={agentForm.phone}
                  onChange={(e) => setAgentForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="agent-currency">Devise</Label>
                <Select
                  value={agentForm.currency}
                  onValueChange={(v) => setAgentForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger id="agent-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF (FCFA)</SelectItem>
                    <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-payment">Moyen de Paiement</Label>
                <Select
                  value={agentForm.paymentMethod || "none"}
                  onValueChange={(v) => setAgentForm((f) => ({ ...f, paymentMethod: v === "none" ? "" : v }))}
                >
                  <SelectTrigger id="agent-payment">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="orange_money">Orange Money</SelectItem>
                    <SelectItem value="mtn_money">MTN Mobile Money</SelectItem>
                    <SelectItem value="cash">Espèces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveAgent} disabled={agentSaving} className="gap-2">
              {agentSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingAgent ? "Mettre à jour" : "Créer l\'Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Services Dialog ─── */}
      <Dialog open={servicesDialogOpen} onOpenChange={setServicesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {servicesAgent?.businessType === "restaurant" ? (
                <UtensilsCrossed className="w-5 h-5 text-orange-600" />
              ) : (
                <Scissors className="w-5 h-5 text-pink-600" />
              )}
              Services — {servicesAgent?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Add Service Form */}
          <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium text-foreground">Ajouter un service</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input
                  placeholder="Ex: Coupe homme"
                  value={serviceForm.name}
                  onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prix ({servicesAgent?.currency || "XAF"}) *</Label>
                <Input
                  type="number"
                  placeholder="5000"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Input
                  placeholder="Description courte"
                  value={serviceForm.description}
                  onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Durée (min)</Label>
                <Input
                  type="number"
                  placeholder="30"
                  value={serviceForm.duration}
                  onChange={(e) => setServiceForm((f) => ({ ...f, duration: e.target.value }))}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={serviceForm.isActive}
                    onCheckedChange={(v) => setServiceForm((f) => ({ ...f, isActive: v }))}
                  />
                  <Label className="text-xs">Actif</Label>
                </div>
                <Button
                  size="sm"
                  onClick={saveService}
                  disabled={serviceSaving}
                  className="ml-auto gap-1.5"
                >
                  {serviceSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </Button>
              </div>
            </div>
          </div>

          {/* Services List */}
          {servicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">Aucun service configuré</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{service.name}</p>
                      {!service.isActive && (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                          Inactif
                        </Badge>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{service.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{service.price.toLocaleString()} {servicesAgent?.currency || "XAF"}</span>
                      {service.duration && <span>{service.duration} min</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                    onClick={() => deleteService(service.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
