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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import type { LucideIcon } from "lucide-react";
import {
  MessageCircle, Plus, Edit, Trash2, CheckCircle, XCircle,
  Phone, CreditCard, Loader2, AlertCircle, CalendarDays,
  Users, Zap, TrendingUp, Eye, Power, PowerOff,
  ShoppingBag, ArrowRight, RefreshCw, LayoutList,
  Save, Pill, Car, Shirt, GraduationCap, Globe,
  Wrench, Dumbbell, Flame, Store, Scissors, UtensilsCrossed,
  Hotel, BarChart3, Settings2, Clock, MapPin, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencies";

// ─── TYPES ───────────────────────────────────────────
interface WhatsAppAgent {
  id: string; companyId: string; name: string; phoneNumber: string;
  phoneId?: string; accessToken?: string; businessType: string;
  isActive: boolean; welcomeMessage?: string; address?: string;
  phone?: string; openHours?: string; currency: string;
  paymentMethod?: string; aiConfig?: string;
  createdAt: string; _count?: { bookings: number; services: number };
  services?: BusinessService[];
}
interface BusinessService {
  id: string; name: string; description?: string;
  price: number; duration?: number; image?: string;
  isActive: boolean; sortOrder: number;
}
interface WhatsAppBooking {
  id: string; agentId: string; waPhoneId: string;
  customerName: string; customerPhone?: string;
  serviceName?: string; bookingDate?: string;
  bookingTime?: string; notes?: string; status: string;
  createdAt: string; agent?: { name: string; businessType: string };
}
interface WhatsAppStats {
  totalAgents: number; activeAgents: number; totalBookings: number;
  pendingBookings: number; confirmedBookings: number;
  completedBookings: number; cancelledBookings: number;
}

// ─── BUSINESS TYPE CONFIG ────────────────────────────
const BUSINESS_TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon; bg: string; bgDark: string; color: string; servicesLabel: string }> = {
  restaurant: { label: "Restaurant", icon: UtensilsCrossed, bg: "bg-orange-100", bgDark: "dark:bg-orange-900/30", color: "text-orange-600", servicesLabel: "plats & menus" },
  salon_coiffure: { label: "Salon Coiffure", icon: Scissors, bg: "bg-pink-100", bgDark: "dark:bg-pink-900/30", color: "text-pink-600", servicesLabel: "prestations coiffure" },
  pharmacie: { label: "Pharmacie", icon: Pill, bg: "bg-green-100", bgDark: "dark:bg-green-900/30", color: "text-green-600", servicesLabel: "produits & services" },
  taxi: { label: "Taxi", icon: Car, bg: "bg-blue-100", bgDark: "dark:bg-blue-900/30", color: "text-blue-600", servicesLabel: "trajets" },
  epicerie: { label: "Epicerie", icon: ShoppingBag, bg: "bg-yellow-100", bgDark: "dark:bg-yellow-900/30", color: "text-yellow-600", servicesLabel: "produits" },
  pressing: { label: "Pressing", icon: Shirt, bg: "bg-cyan-100", bgDark: "dark:bg-cyan-900/30", color: "text-cyan-600", servicesLabel: "services pressing" },
  boulangerie: { label: "Boulangerie", icon: Store, bg: "bg-amber-100", bgDark: "dark:bg-amber-900/30", color: "text-amber-600", servicesLabel: "produits boulangerie" },
  hotel: { label: "Hotel", icon: Hotel, bg: "bg-indigo-100", bgDark: "dark:bg-indigo-900/30", color: "text-indigo-600", servicesLabel: "chambres & services" },
  barbershop: { label: "Barbershop", icon: Scissors, bg: "bg-violet-100", bgDark: "dark:bg-violet-900/30", color: "text-violet-600", servicesLabel: "prestations" },
  boutique: { label: "Boutique", icon: Shirt, bg: "bg-rose-100", bgDark: "dark:bg-rose-900/30", color: "text-rose-600", servicesLabel: "articles" },
  auto_ecole: { label: "Auto Ecole", icon: Car, bg: "bg-sky-100", bgDark: "dark:bg-sky-900/30", color: "text-sky-600", servicesLabel: "formations" },
  clinique: { label: "Clinique", icon: Pill, bg: "bg-emerald-100", bgDark: "dark:bg-emerald-900/30", color: "text-emerald-600", servicesLabel: "consultations" },
  braiseuse_poisson: { label: "Braiseuse Poisson", icon: Flame, bg: "bg-rose-100", bgDark: "dark:bg-rose-900/30", color: "text-rose-600", servicesLabel: "poissons braises" },
};

const TEMPLATES = Object.entries(BUSINESS_TYPE_CONFIG).map(([type, cfg]) => ({
  icon: cfg.icon, label: cfg.label, type, desc: cfg.servicesLabel,
  bg: cfg.bg, bgDark: cfg.bgDark, color: cfg.color,
}));

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  confirmed: { label: "Confirme", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Termine", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  cancelled: { label: "Annule", cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

// ─── MAIN COMPONENT ──────────────────────────────────
export default function WhatsAppPage() {
  const { token, user } = useAppStore();
  const isAdmin = user?.role === "company_admin" || user?.role === "super_admin";

  const [agents, setAgents] = useState<WhatsAppAgent[]>([]);
  const [bookings, setBookings] = useState<WhatsAppBooking[]>([]);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");

  // Agent dialog
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<WhatsAppAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [agentForm, setAgentForm] = useState({
    name: "", phoneNumber: "", phoneId: "", accessToken: "",
    businessType: "restaurant", welcomeMessage: "", address: "",
    phone: "", currency: "XAF", paymentMethod: "",
  });

  // Service dialog
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [serviceAgentId, setServiceAgentId] = useState<string>("");
  const [services, setServices] = useState<BusinessService[]>([]);
  const [serviceForm, setServiceForm] = useState({ name: "", description: "", price: "", duration: "" });

  // Bookings filter
  const [bookingFilter, setBookingFilter] = useState<string>("all");

  // ─── FETCH DATA ────────────────────────────────
  const fetchAgents = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/whatsapp/agents", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setAgents(data.agents || []); }
    } catch { /* ignore */ }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/whatsapp/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setStats(data.stats || null); }
    } catch { /* ignore */ }
  }, [token]);

  const fetchBookings = useCallback(async () => {
    if (!token) return;
    try {
      const params = bookingFilter !== "all" ? `?status=${bookingFilter}` : "";
      const res = await fetch(`/api/whatsapp/bookings${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setBookings(data.bookings || []); }
    } catch { /* ignore */ }
  }, [token, bookingFilter]);

  const fetchServices = useCallback(async (agentId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/whatsapp/agents/${agentId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setServices(data.agent?.services || []); }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => {
    Promise.all([fetchAgents(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchAgents, fetchStats]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // ─── AGENT CRUD ────────────────────────────────
  const openCreateAgent = () => {
    setEditingAgent(null);
    setAgentForm({ name: "", phoneNumber: "", phoneId: "", accessToken: "", businessType: "restaurant", welcomeMessage: "", address: "", phone: "", currency: "XAF", paymentMethod: "" });
    setAgentDialogOpen(true);
  };

  const openEditAgent = (agent: WhatsAppAgent) => {
    setEditingAgent(agent);
    let aiCfg: any = null;
    if (agent.aiConfig) { try { aiCfg = JSON.parse(agent.aiConfig); } catch { /* */ } }
    setAgentForm({
      name: agent.name, phoneNumber: agent.phoneNumber, phoneId: agent.phoneId || "",
      accessToken: agent.accessToken || "", businessType: agent.businessType,
      welcomeMessage: agent.welcomeMessage || "", address: agent.address || "",
      phone: agent.phone || "", currency: agent.currency, paymentMethod: agent.paymentMethod || "",
    });
    setAgentDialogOpen(true);
  };

  const saveAgent = async () => {
    if (!agentForm.name || !agentForm.phoneNumber || !agentForm.businessType) {
      toast.error("Nom, numero et type de business requis"); return;
    }
    setSaving(true);
    try {
      const url = editingAgent ? `/api/whatsapp/agents/${editingAgent.id}` : "/api/whatsapp/agents";
      const method = editingAgent ? "PUT" : "POST";
      const body = editingAgent ? agentForm : agentForm;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editingAgent ? "Agent modifie" : "Agent cree avec succes");
        setAgentDialogOpen(false);
        fetchAgents(); fetchStats();
      } else {
        const err = await res.json();
        toast.error(err.error || "Erreur");
      }
    } catch { toast.error("Erreur de connexion"); }
    finally { setSaving(false); }
  };

  const deleteAgent = async (id: string) => {
    if (!confirm("Supprimer cet agent et tous ses services ?")) return;
    try {
      const res = await fetch(`/api/whatsapp/agents/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Agent supprime"); fetchAgents(); fetchStats(); }
    } catch { toast.error("Erreur"); }
  };

  const toggleAgent = async (agent: WhatsAppAgent) => {
    try {
      const res = await fetch(`/api/whatsapp/agents/${agent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      if (res.ok) { toast.success(agent.isActive ? "Agent desactive" : "Agent active"); fetchAgents(); }
    } catch { toast.error("Erreur"); }
  };

  // ─── SERVICE CRUD ─────────────────────────────
  const openServiceDialog = (agentId: string) => {
    setServiceAgentId(agentId);
    setServiceForm({ name: "", description: "", price: "", duration: "" });
    fetchServices(agentId);
    setServiceDialogOpen(true);
  };

  const addService = async () => {
    if (!serviceForm.name || !serviceForm.price) { toast.error("Nom et prix requis"); return; }
    try {
      const res = await fetch(`/api/whatsapp/agents/${serviceAgentId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: serviceForm.name, description: serviceForm.description, price: parseFloat(serviceForm.price), duration: serviceForm.duration ? parseInt(serviceForm.duration) : null }),
      });
      if (res.ok) { toast.success("Service ajoute"); setServiceForm({ name: "", description: "", price: "", duration: "" }); fetchServices(serviceAgentId); fetchAgents(); }
    } catch { toast.error("Erreur"); }
  };

  const deleteService = async (serviceId: string) => {
    try {
      const res = await fetch(`/api/whatsapp/agents/${serviceAgentId}/services?serviceId=${serviceId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { toast.success("Service supprime"); fetchServices(serviceAgentId); fetchAgents(); }
    } catch { toast.error("Erreur"); }
  };

  // ─── BOOKING STATUS UPDATE ────────────────────
  const updateBookingStatus = async (id: string, status: string) => {
    try {
      const res = await fetch("/api/whatsapp/bookings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) { toast.success("Statut mis a jour"); fetchBookings(); fetchStats(); }
    } catch { toast.error("Erreur"); }
  };

  // ─── RENDER ──────────────────────────────────────
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const activeAgents = agents.filter(a => a.isActive);
  const cfg = (bt: string) => BUSINESS_TYPE_CONFIG[bt] || { label: bt, icon: Store, bg: "bg-gray-100", bgDark: "dark:bg-gray-900/30", color: "text-gray-600", servicesLabel: "services" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-900/30">
            <MessageCircle className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Agents WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Gerez vos agents WhatsApp Business avec menu automatique et IA</p>
          </div>
        </div>
        {isAdmin && <Button onClick={openCreateAgent} className="gap-2 bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4" /> Nouvel Agent</Button>}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="w-4 h-4" /> Tableau de bord</TabsTrigger>
          <TabsTrigger value="agents" className="gap-2"><MessageCircle className="w-4 h-4" /> Agents ({activeAgents.length})</TabsTrigger>
          <TabsTrigger value="bookings" className="gap-2"><CalendarDays className="w-4 h-4" /> Reservations</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings2 className="w-4 h-4" /> Config</TabsTrigger>
        </TabsList>

        {/* ═══ DASHBOARD TAB ═══ */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Agents actifs", value: stats?.activeAgents || 0, icon: MessageCircle, color: "text-green-600 bg-green-100 dark:bg-green-900/30" },
              { label: "Total reservations", value: stats?.totalBookings || 0, icon: CalendarDays, color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30" },
              { label: "En attente", value: stats?.pendingBookings || 0, icon: Clock, color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30" },
              { label: "Terminees", value: stats?.completedBookings || 0, icon: CheckCircle, color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30" },
            ].map((s) => (
              <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div>
                <div><p className="text-2xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
              </CardContent></Card>
            ))}
          </div>

          {/* Agent breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-base">Agents WhatsApp</CardTitle></CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucun agent WhatsApp configure</p>
                  <p className="text-xs mt-1">Cliquez sur "Nouvel Agent" pour commencer</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {agents.map(agent => {
                    const c = cfg(agent.businessType);
                    const Icon = c.icon;
                    return (
                      <div key={agent.id} className={`flex items-center gap-3 p-3 rounded-lg border ${agent.isActive ? c.bg + " " + c.bgDark : "bg-gray-50 dark:bg-gray-900/30"} transition-all`}>
                        <div className={`p-2 rounded-lg ${c.bg} ${c.bgDark}`}><Icon className={`w-5 h-5 ${c.color}`} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2"><p className="font-medium text-sm truncate">{agent.name}</p>
                            <Badge variant={agent.isActive ? "default" : "secondary"} className="text-[9px]">{agent.isActive ? "Actif" : "Inactif"}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{agent.phoneNumber} &middot; {c.label}</p>
                          <p className="text-[10px] text-muted-foreground">{agent._count?.services || 0} services &middot; {agent._count?.bookings || 0} reservations</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ AGENTS TAB ═══ */}
        <TabsContent value="agents" className="space-y-6 mt-6">
          {agents.length === 0 ? (
            <Card><CardContent className="py-16 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-1">Aucun agent WhatsApp</h3>
              <p className="text-sm text-muted-foreground mb-4">Creez votre premier agent WhatsApp Business</p>
              <Button onClick={openCreateAgent} className="gap-2 bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4" /> Creer un agent</Button>
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map(agent => {
                const c = cfg(agent.businessType);
                const Icon = c.icon;
                return (
                  <Card key={agent.id} className={!agent.isActive ? "opacity-60" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${c.bg} ${c.bgDark}`}><Icon className={`w-5 h-5 ${c.color}`} /></div>
                          <div>
                            <CardTitle className="text-base">{agent.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{agent.phoneNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleAgent(agent)}>
                            {agent.isActive ? <Power className="w-4 h-4 text-green-600" /> : <PowerOff className="w-4 h-4 text-red-500" />}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">{c.label}</Badge>
                        <Badge variant="outline" className="text-[10px]"><Phone className="w-3 h-3 mr-1" />{agent._count?.services || 0} services</Badge>
                        <Badge variant="outline" className="text-[10px]"><CalendarDays className="w-3 h-3 mr-1" />{agent._count?.bookings || 0} res.</Badge>
                        {agent.paymentMethod && <Badge variant="outline" className="text-[10px]"><CreditCard className="w-3 h-3 mr-1" />{agent.paymentMethod}</Badge>}
                      </div>
                      {agent.address && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{agent.address}</p>}
                      <div className="flex gap-2 pt-2 border-t">
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEditAgent(agent)}><Edit className="w-3 h-3" /> Modifier</Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openServiceDialog(agent.id)}><LayoutList className="w-3 h-3" /> Services</Button>
                        {isAdmin && <Button size="sm" variant="outline" className="gap-1 text-red-600" onClick={() => deleteAgent(agent.id)}><Trash2 className="w-3 h-3" /></Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ BOOKINGS TAB ═══ */}
        <TabsContent value="bookings" className="space-y-4 mt-6">
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "pending", "confirmed", "completed", "cancelled"].map(s => (
              <Button key={s} size="sm" variant={bookingFilter === s ? "default" : "outline"}
                onClick={() => setBookingFilter(s)}>
                {s === "all" ? "Toutes" : STATUS_BADGE[s]?.label || s}
              </Button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {bookings.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucune reservation</p>
                </div>
              ) : (
                <Table><TableHeader><TableRow>
                  <TableHead>Client</TableHead><TableHead>Service</TableHead><TableHead>Date</TableHead><TableHead>Statut</TableHead><TableHead>Actions</TableHead>
                </TableRow></TableHeader><TableBody>
                  {bookings.map(b => {
                    const sb = STATUS_BADGE[b.status] || STATUS_BADGE.pending;
                    return (
                      <TableRow key={b.id}>
                        <TableCell><div><p className="font-medium text-sm">{b.customerName}</p><p className="text-xs text-muted-foreground">{b.waPhoneId}</p></div></TableCell>
                        <TableCell className="text-sm">{b.serviceName || "-"}</TableCell>
                        <TableCell className="text-sm">{b.bookingDate || "-"}{b.bookingTime ? ` ${b.bookingTime}` : ""}</TableCell>
                        <TableCell><Badge className={`${sb.cls} text-[10px]`}>{sb.label}</Badge></TableCell>
                        <TableCell>
                          {isAdmin && b.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-[10px] text-green-600" onClick={() => updateBookingStatus(b.id, "confirmed")}>Confirmer</Button>
                              <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-600" onClick={() => updateBookingStatus(b.id, "cancelled")}>Annuler</Button>
                            </div>
                          )}
                          {b.status === "confirmed" && isAdmin && (
                            <Button size="sm" variant="outline" className="h-7 text-[10px] text-green-600" onClick={() => updateBookingStatus(b.id, "completed")}>Terminer</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody></Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ SETTINGS TAB ═══ */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Configuration WhatsApp Webhook</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">URL du Webhook</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">{typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "/api/whatsapp/webhook"}</code>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`); toast.success("URL copiee"); }}><Copy className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium mb-1">Verify Token</p>
                <code className="text-xs bg-background px-2 py-1 rounded">chatcommerce-wa-verify-2024</code>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium">Pour configurer :</p>
                <ol className="list-decimal list-inside mt-1 space-y-1 text-xs">
                  <li>Allez sur Meta for Developers &gt; WhatsApp &gt; Configuration</li>
                  <li>Collez l&apos;URL du webhook ci-dessus</li>
                  <li>Utilisez le Verify Token ci-dessus</li>
                  <li>Abonnez aux evenements: messages, message_status</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Templates rapides</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Creez rapidement des agents avec des services preconfigures</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TEMPLATES.slice(0, 8).map(t => {
                  const Icon = t.icon;
                  return (
                    <button key={t.type} onClick={() => { setAgentForm(f => ({ ...f, businessType: t.type, name: `${t.label} WhatsApp` })); setActiveTab("agents"); openCreateAgent(); setAgentForm(f => ({ ...f, businessType: t.type })); }} className={`p-3 rounded-lg border text-left hover:border-primary/50 transition-all ${t.bg} ${t.bgDark}`}>
                      <Icon className={`w-5 h-5 ${t.color} mb-2`} />
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ AGENT DIALOG ═══ */}
      <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAgent ? "Modifier l'agent WhatsApp" : "Nouvel agent WhatsApp"}</DialogTitle>
            <DialogDescription>{editingAgent ? "Modifiez les informations" : "Configurez un nouvel agent WhatsApp Business"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Nom de l'agent *</Label>
                <Input value={agentForm.name} onChange={e => setAgentForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Restaurant Le Paradis" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Type de business *</Label>
                <Select value={agentForm.businessType} onValueChange={v => setAgentForm(f => ({ ...f, businessType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(BUSINESS_TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Numero WhatsApp *</Label>
                <Input value={agentForm.phoneNumber} onChange={e => setAgentForm(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="+2376XXXXXXXX" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Phone ID (Meta)</Label>
                <Input value={agentForm.phoneId} onChange={e => setAgentForm(f => ({ ...f, phoneId: e.target.value }))} placeholder="Ex: 1234567890" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Access Token (Meta)</Label>
              <Textarea value={agentForm.accessToken} onChange={e => setAgentForm(f => ({ ...f, accessToken: e.target.value }))} placeholder="EAAx..." rows={3} className="text-xs" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Adresse</Label>
                <Input value={agentForm.address} onChange={e => setAgentForm(f => ({ ...f, address: e.target.value }))} placeholder="Ex: Douala, Cameroon" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Telephone contact</Label>
                <Input value={agentForm.phone} onChange={e => setAgentForm(f => ({ ...f, phone: e.target.value }))} placeholder="+2376XXXXXXXX" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Devise</Label>
                <Select value={agentForm.currency} onValueChange={v => setAgentForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">FCFA (XAF)</SelectItem>
                    <SelectItem value="EUR">Euro (EUR)</SelectItem>
                    <SelectItem value="USD">Dollar (USD)</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-1.5"><Label className="text-xs">Mode paiement</Label>
                <Select value={agentForm.paymentMethod} onValueChange={v => setAgentForm(f => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="orange_money">Orange Money</SelectItem>
                    <SelectItem value="mtn_money">MTN Mobile Money</SelectItem>
                  </SelectContent>
                </Select></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Message d'accueil</Label>
              <Textarea value={agentForm.welcomeMessage} onChange={e => setAgentForm(f => ({ ...f, welcomeMessage: e.target.value }))} placeholder="Bienvenue ! Tapez /menu pour voir nos services" rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveAgent} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              {editingAgent ? "Enregistrer" : "Creer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ SERVICE DIALOG ═══ */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Services de l'agent</DialogTitle>
            <DialogDescription>Ajoutez et gerez les services proposes via WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing services */}
            {services.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {services.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{i + 1}. {s.name}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(Number(s.price), "XAF")}{s.duration ? ` | ${s.duration}min` : ""}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteService(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
            <Separator />
            {/* Add service form */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1 space-y-1"><Label className="text-[10px]">Nom *</Label>
                <Input value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} placeholder="Service" className="h-9 text-sm" /></div>
              <div className="space-y-1"><Label className="text-[10px]">Prix (FCFA) *</Label>
                <Input type="number" value={serviceForm.price} onChange={e => setServiceForm(f => ({ ...f, price: e.target.value }))} placeholder="0" className="h-9 text-sm" /></div>
              <div className="space-y-1"><Label className="text-[10px]">Duree (min)</Label>
                <Input type="number" value={serviceForm.duration} onChange={e => setServiceForm(f => ({ ...f, duration: e.target.value }))} placeholder="30" className="h-9 text-sm" /></div>
            </div>
            <Button onClick={addService} className="w-full bg-green-600 hover:bg-green-700 gap-1" size="sm"><Plus className="w-3.5 h-3.5" /> Ajouter le service</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
