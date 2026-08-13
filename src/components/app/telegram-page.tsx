"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
import { Separator } from "@/components/ui/separator";
import type { LucideIcon } from "lucide-react";
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
  LayoutList,
  Calendar,
  Save,
  Pill,
  Car,
  Shirt,
  GraduationCap,
  Globe,
  Plane,
  Wrench,
  Dumbbell,
} from "lucide-react";
import { toast } from "sonner";
import BookingCalendar from "@/components/app/booking-calendar";
import { formatCurrency } from "@/lib/currencies";

// ─── Types ───────────────────────────────────────────────────────

interface TelegramAgent {
  id: string;
  name: string;
  token: string | boolean | null;
  botUsername: string | null;
  businessType: string;
  isActive: boolean;
  welcomeMessage: string | null;
  address: string | null;
  phone: string | null;
  openHours: string | null;
  currency: string;
  paymentMethod: string | null;
  aiConfig?: string | null;
  aiEnabled?: boolean;
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

// ─── Business Type Config (icons, labels, colors) ─────────────
const BUSINESS_TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon; bg: string; bgDark: string; color: string; servicesLabel: string }> = {
  restaurant:      { label: "Restaurant",       icon: UtensilsCrossed,  bg: "bg-orange-100",  bgDark: "dark:bg-orange-900/30",  color: "text-orange-600",  servicesLabel: "plats de votre menu" },
  salon_coiffure:  { label: "Salon Coiffure",   icon: Scissors,        bg: "bg-purple-100",  bgDark: "dark:bg-purple-900/30",  color: "text-purple-600",  servicesLabel: "prestations de votre salon" },
  pharmacie:        { label: "Pharmacie",        icon: Pill,            bg: "bg-green-100",   bgDark: "dark:bg-green-900/30",   color: "text-green-600",   servicesLabel: "services de votre pharmacie" },
  taxi_transport:   { label: "Taxi Transport",   icon: Car,             bg: "bg-blue-100",    bgDark: "dark:bg-blue-900/30",    color: "text-blue-600",    servicesLabel: "types de courses" },
  pressing_laverie: { label: "Pressing",         icon: Shirt,           bg: "bg-cyan-100",    bgDark: "dark:bg-cyan-900/30",    color: "text-cyan-600",    servicesLabel: "services de laverie" },
  ecole_formation:  { label: "Ecole / Formation", icon: GraduationCap, bg: "bg-amber-100",   bgDark: "dark:bg-amber-900/30",   color: "text-amber-600",   servicesLabel: "formations" },
  supermarche:     { label: "Supermarche",     icon: ShoppingBag,     bg: "bg-lime-100",    bgDark: "dark:bg-lime-900/30",    color: "text-lime-600",    servicesLabel: "produits" },
  clinique:         { label: "Clinique",         icon: Bot,             bg: "bg-red-100",     bgDark: "dark:bg-red-900/30",     color: "text-red-600",     servicesLabel: "services medical" },
  agence_voyage:    { label: "Agence Voyage",    icon: Plane,           bg: "bg-violet-100",  bgDark: "dark:bg-violet-900/30",  color: "text-violet-600",  servicesLabel: "services voyage" },
  boulangerie:      { label: "Boulangerie",      icon: Sparkles,        bg: "bg-yellow-100",  bgDark: "dark:bg-yellow-900/30",  color: "text-yellow-600",  servicesLabel: "produits de boulangerie" },
  garage_auto:      { label: "Garage Auto",      icon: Wrench,          bg: "bg-zinc-100",    bgDark: "dark:bg-zinc-800/50",    color: "text-zinc-600",    servicesLabel: "services auto" },
  salle_sport:      { label: "Salle de Sport",   icon: Dumbbell,        bg: "bg-emerald-100", bgDark: "dark:bg-emerald-900/30", color: "text-emerald-600", servicesLabel: "abonnements" },
};

function getBusinessConfig(type: string) {
  return BUSINESS_TYPE_CONFIG[type] || BUSINESS_TYPE_CONFIG.restaurant;
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
  const { token, user } = useAppStore();
  // company_admin = propriétaire de l'entreprise (peut créer/gérer agents)
  // super_admin / hardcoded = admin système (voit tout)
  const isCompanyAdmin = user?.role === "company_admin";
  const isSystemAdmin = user?.role === "super_admin" || user?.id === "admin-hardcoded-001";
  const canManageAgents = isCompanyAdmin || isSystemAdmin; // Peut créer, modifier, supprimer agents
  const isAdmin = isSystemAdmin; // Pour les sections système (config IA avancée)

  // Data states
  const [agents, setAgents] = useState<TelegramAgent[]>([]);
  const [bookings, setBookings] = useState<TelegramBooking[]>([]);
  const [stats, setStats] = useState<TelegramStats | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [bookingViewMode, setBookingViewMode] = useState<"table" | "calendar">("table");
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [settingUpType, setSettingUpType] = useState<string | null>(null);

  // Global Bot Token state
  const [globalToken, setGlobalToken] = useState("");
  const [globalBotUsername, setGlobalBotUsername] = useState<string | null>(null);
  const [globalTokenSaving, setGlobalTokenSaving] = useState(false);
  const [globalTokenActivatingAll, setGlobalTokenActivatingAll] = useState(false);
  const [webhookRegistering, setWebhookRegistering] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  // Agent form dialog (create/edit)
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
    paymentMethod: "none",
    aiEnabled: false,
    aiProvider: "openrouter" as "openai" | "anthropic" | "openrouter" | "custom",
    aiApiKey: "",
    aiModel: "",
    aiBaseUrl: "",
    aiSystemPrompt: "",
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

  // Agent config dialog (full config panel when clicking an agent card)
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<TelegramAgent | null>(null);
  const [configTab, setConfigTab] = useState("infos");
  const [configSaving, setConfigSaving] = useState(false);
  const [configForm, setConfigForm] = useState({
    name: "",
    token: "",
    botUsername: "",
    businessType: "restaurant",
    welcomeMessage: "",
    address: "",
    phone: "",
    openHours: "",
    currency: "XAF",
    paymentMethod: "none",
    aiEnabled: false,
    aiProvider: "openrouter" as "openai" | "anthropic" | "openrouter" | "custom",
    aiApiKey: "",
    aiModel: "",
    aiBaseUrl: "",
    aiSystemPrompt: "",
  });

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ─── Plan limits for Telegram agents ───────────────────────
  const userPlan = user?.company?.plan || "starter";
  const PLAN_MAX_AGENTS: Record<string, number> = { starter: 2, pro: 5, business: 12, enterprise: 999999 };
  const maxTelegramAgents = PLAN_MAX_AGENTS[userPlan] || 2;
  const hasReachedLimit = agents.length >= maxTelegramAgents;

  // ─── Fetch Global Token ─────────────────────────────────────
  const fetchGlobalToken = useCallback(async () => {
    try {
      const res = await fetch("/api/company/global-token", { headers });
      if (!res.ok) return;
      const data = await res.json();
      setGlobalBotUsername(data.botUsername || null);
    } catch { /* ignore */ }
  }, [headers]);

  const saveGlobalToken = async (activateAll: boolean = false) => {
    if (!globalToken.trim()) {
      toast.error("Token requis");
      return;
    }
    if (activateAll) {
      setGlobalTokenActivatingAll(true);
    } else {
      setGlobalTokenSaving(true);
    }
    try {
      const res = await fetch("/api/company/global-token", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ token: globalToken.trim(), activateAll }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Token global configure !");
      setGlobalBotUsername(data.botUsername);
      setGlobalToken(""); // Clear input after save
      await Promise.all([fetchAgents(), fetchStats()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la configuration");
    } finally {
      setGlobalTokenSaving(false);
      setGlobalTokenActivatingAll(false);
    }
  };

  const removeGlobalToken = async () => {
    if (!confirm("Supprimer le token global et desactiver tous les agents ?")) return;
    try {
      const res = await fetch("/api/company/global-token", { method: "DELETE", headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Token global supprime");
      setGlobalBotUsername(null);
      setWebhookStatus(null);
      await Promise.all([fetchAgents(), fetchStats()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const registerWebhook = async () => {
    setWebhookRegistering(true);
    setWebhookStatus(null);
    try {
      const res = await fetch("/api/telegram/webhook-setup", {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Webhook enregistre !");
      setWebhookStatus("active");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
      setWebhookStatus("error: " + msg);
    } finally {
      setWebhookRegistering(false);
    }
  };

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
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchBookings(), fetchStats(), fetchGlobalToken()]);
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [fetchAgents, fetchBookings, fetchStats, fetchGlobalToken]);

  // ─── One-Click Setup ───────────────────────────────────────────

  const handleOneClickSetup = async (agentType?: string) => {
    setSettingUp(true);
    setSettingUpType(agentType || null);
    try {
      const res = await fetch("/api/telegram/setup", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(agentType ? { agentType } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Agent créé avec succès !");
      await Promise.all([fetchAgents(), fetchStats()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création");
    } finally {
      setSettingUp(false);
      setSettingUpType(null);
    }
  };

  // ─── Activate Agent ────────────────────────────────────────────

  const openActivateDialog = (agent: TelegramAgent) => {
    setActivateAgent(agent);
    setActivateToken(!isPlaceholder(agent.token) ? String(agent.token) : "");
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
      paymentMethod: "none",
      aiEnabled: false,
      aiProvider: "openai",
      aiApiKey: "",
      aiModel: "",
      aiBaseUrl: "",
      aiSystemPrompt: "",
    });
    setAgentDialogOpen(true);
  };

  const openEditAgent = (agent: TelegramAgent) => {
    setEditingAgent(agent);
    // Parse AI config from the dedicated aiConfig field (admin only)
    let aiOverrides: Record<string, unknown> = {};
    if (isAdmin && agent.aiConfig) {
      try {
        aiOverrides = JSON.parse(agent.aiConfig);
      } catch { /* ignore */ }
    }
    setAgentForm({
      name: agent.name,
      token: typeof agent.token === "string" ? agent.token : "",
      botUsername: agent.botUsername || "",
      businessType: agent.businessType,
      welcomeMessage: agent.welcomeMessage || "",
      address: agent.address || "",
      phone: agent.phone || "",
      currency: agent.currency,
      paymentMethod: agent.paymentMethod || "none",
      aiEnabled: (aiOverrides.enabled as boolean) ?? false,
      aiProvider: (aiOverrides.provider as "openai" | "anthropic" | "openrouter" | "custom") ?? "openrouter",
      aiApiKey: (aiOverrides.apiKey as string) || "",
      aiModel: (aiOverrides.model as string) || "",
      aiBaseUrl: (aiOverrides.baseUrl as string) || "",
      aiSystemPrompt: (aiOverrides.systemPrompt as string) || "",
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
      // SECURITY: Non-managers can only send token — strip all other fields
      const payload = canManageAgents
        ? agentForm
        : { agentId: editingAgent?.id, token: agentForm.token };

      if (editingAgent) {
        const res = await fetch(`/api/telegram/agents/${editingAgent.id}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur serveur");
        toast.success(data.message || "Agent mis à jour");
      } else {
        const res = await fetch("/api/telegram/agents", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur serveur");
        toast.success(data.message || "Agent créé");
      }
      setAgentDialogOpen(false);
      await fetchAgents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      toast.success("Agent supprimé");
      await fetchAgents();
      await fetchBookings(bookingStatusFilter);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la suppression");
    }
  };

  const toggleAgentActive = async (agent: TelegramAgent) => {
    try {
      const res = await fetch(`/api/telegram/agents/${agent.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      await fetchAgents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors du changement de statut");
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

  // ─── Agent Config Panel (click on card) ────────────────────────

  const openAgentConfig = async (agent: TelegramAgent) => {
    setSelectedAgent(agent);
    // Parse AI config
    let aiOverrides: Record<string, unknown> = {};
    if (isAdmin && agent.aiConfig) {
      try { aiOverrides = JSON.parse(agent.aiConfig); } catch { /* ignore */ }
    }
    setConfigForm({
      name: agent.name,
      token: typeof agent.token === "string" ? agent.token : "",
      botUsername: agent.botUsername || "",
      businessType: agent.businessType,
      welcomeMessage: agent.welcomeMessage || "",
      address: agent.address || "",
      phone: agent.phone || "",
      openHours: agent.openHours || "",
      currency: agent.currency,
      paymentMethod: agent.paymentMethod || "none",
      aiEnabled: (aiOverrides.enabled as boolean) ?? false,
      aiProvider: (aiOverrides.provider as "openai" | "anthropic" | "openrouter" | "custom") ?? "openrouter",
      aiApiKey: (aiOverrides.apiKey as string) || "",
      aiModel: (aiOverrides.model as string) || "",
      aiBaseUrl: (aiOverrides.baseUrl as string) || "",
      aiSystemPrompt: (aiOverrides.systemPrompt as string) || "",
    });
    setConfigTab("infos");
    setConfigDialogOpen(true);
    // Also load services for the Services tab
    setServicesAgent(agent);
    setServicesLoading(true);
    try {
      const res = await fetch(`/api/telegram/agents/${agent.id}/services`, { headers });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setServices(data.services || []);
    } catch { /* ignore */ } finally {
      setServicesLoading(false);
    }
  };

  const saveAgentConfig = async () => {
    if (!selectedAgent) return;
    setConfigSaving(true);
    try {
      const payload = canManageAgents
        ? {
            name: configForm.name,
            botUsername: configForm.botUsername,
            businessType: configForm.businessType,
            welcomeMessage: configForm.welcomeMessage,
            address: configForm.address,
            phone: configForm.phone,
            openHours: configForm.openHours,
            currency: configForm.currency,
            paymentMethod: configForm.paymentMethod,
            aiConfig: JSON.stringify({
              enabled: configForm.aiEnabled,
              provider: configForm.aiProvider,
              apiKey: configForm.aiApiKey,
              model: configForm.aiModel,
              baseUrl: configForm.aiBaseUrl,
              systemPrompt: configForm.aiSystemPrompt,
            }),
          }
        : { token: configForm.token };
      const res = await fetch(`/api/telegram/agents/${selectedAgent.id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur");
      toast.success("Configuration sauvegardée");
      await fetchAgents();
      // Refresh selected agent data
      const agentRes = await fetch("/api/telegram/agents", { headers });
      if (agentRes.ok) {
        const data2 = await agentRes.json();
        const updated = (data2.agents || []).find((a: TelegramAgent) => a.id === selectedAgent.id);
        if (updated) setSelectedAgent(updated);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
    } finally {
      setConfigSaving(false);
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
  const isPlaceholder = (t: string | boolean | null | undefined) => !t || typeof t === "boolean" || t.startsWith("PLACEHOLDER_");

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ─── Global Bot Token ─── */}
      {canManageAgents && (
        <Card className="border-[#0088cc]/30 bg-gradient-to-r from-[#0088cc]/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-12 h-12 rounded-xl bg-[#0088cc]/10 flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-[#0088cc]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Token Bot Global</h3>
                  <p className="text-xs text-muted-foreground">Un seul token pour tous les agents</p>
                </div>
              </div>
              <div className="flex-1 space-y-3 w-full">
                {globalBotUsername ? (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 flex-1">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-green-800 dark:text-green-300">Bot actif : {globalBotUsername}</p>
                        <p className="text-[10px] text-green-600 dark:text-green-400">Tous les agents partagent ce token</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={registerWebhook} disabled={webhookRegistering} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                        {webhookRegistering ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        {webhookStatus === "active" ? "Webhook Actif" : "Lancer le Bot"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={removeGlobalToken} className="gap-2 text-red-600 border-red-200 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Collez votre token Telegram (de @BotFather) ici..."
                        value={globalToken}
                        onChange={(e) => setGlobalToken(e.target.value)}
                        type="password"
                        className="flex-1"
                      />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => saveGlobalToken(false)}
                        disabled={globalTokenSaving || !globalToken.trim()}
                        variant="outline"
                        className="gap-2"
                      >
                        {globalTokenSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Sauvegarder
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveGlobalToken(true)}
                        disabled={globalTokenActivatingAll || !globalToken.trim()}
                        className="gap-2 bg-[#0088cc] hover:bg-[#006699]"
                      >
                        {globalTokenActivatingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        Sauvegarder + Activer Tous les Agents
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Avec un seul token, tous vos agents Telegram utiliseront le meme bot.
                      Le token sera automatiquement applique a tous les agents existants.
                    </p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
          {canManageAgents ? (
            <>
              <Button onClick={() => handleOneClickSetup()} disabled={settingUp || hasReachedLimit} variant="outline" className="gap-2">
                {settingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {settingUp ? "Création..." : "Créer l'Agent"}
              </Button>
              <Button onClick={openCreateAgent} disabled={hasReachedLimit} className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
                <Plus className="w-4 h-4" />
                Agent Personnalisé
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">Contactez votre administrateur pour creer de nouveaux agents</p>
          )}
        </div>
      </div>

      {/* ─── Plan Limit Banner ─── */}
      {canManageAgents && (
        <div className={`flex items-center justify-between p-3 rounded-lg text-sm ${hasReachedLimit ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50" : "bg-muted/50"}`}>
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <span className="font-medium">
              {hasReachedLimit
                ? `Limite atteinte : ${agents.length}/${maxTelegramAgents === 999999 ? "Illimite" : maxTelegramAgents} agents Telegram`
                : `Agents : ${agents.length}/${maxTelegramAgents === 999999 ? "Illimite" : maxTelegramAgents}`
              }
            </span>
          </div>
          {!isSystemAdmin && (
            <span className="text-xs text-muted-foreground">
              Plan <span className="font-semibold uppercase">{userPlan}</span>
            </span>
          )}
          {hasReachedLimit && !isSystemAdmin && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Passez a un plan superieur pour creer plus d&apos;agents
            </p>
          )}
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!hasAgents && canManageAgents && (
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
                { icon: UtensilsCrossed, label: "Restaurant", type: "restaurant", desc: "12 plats camerounais", bg: "bg-orange-100 dark:bg-orange-900/30", color: "text-orange-600" },
                { icon: Scissors, label: "Salon Coiffure", type: "salon_coiffure", desc: "14 prestations", bg: "bg-purple-100 dark:bg-purple-900/30", color: "text-purple-600" },
                { icon: Bot, label: "Pharmacie", type: "pharmacie", desc: "10 services sante", bg: "bg-green-100 dark:bg-green-900/30", color: "text-green-600" },
                { icon: MapPin, label: "Taxi Transport", type: "taxi_transport", desc: "9 types de courses", bg: "bg-blue-100 dark:bg-blue-900/30", color: "text-blue-600" },
                { icon: ShoppingBag, label: "Pressing", type: "pressing_laverie", desc: "11 services laverie", bg: "bg-cyan-100 dark:bg-cyan-900/30", color: "text-cyan-600" },
                { icon: Users, label: "Ecole / Formation", type: "ecole_formation", desc: "11 formations", bg: "bg-amber-100 dark:bg-amber-900/30", color: "text-amber-600" },
                { icon: ShoppingBag, label: "Supermarche", type: "supermarche", desc: "12 produits courses", bg: "bg-lime-100 dark:bg-lime-900/30", color: "text-lime-600" },
                { icon: Bot, label: "Clinique", type: "clinique", desc: "10 services medical", bg: "bg-red-100 dark:bg-red-900/30", color: "text-red-600" },
                { icon: MessageCircle, label: "Agence Voyage", type: "agence_voyage", desc: "10 services voyage", bg: "bg-violet-100 dark:bg-violet-900/30", color: "text-violet-600" },
                { icon: Sparkles, label: "Boulangerie", type: "boulangerie", desc: "11 produits boulange", bg: "bg-yellow-100 dark:bg-yellow-900/30", color: "text-yellow-600" },
                { icon: Zap, label: "Garage Auto", type: "garage_auto", desc: "10 services auto", bg: "bg-zinc-100 dark:bg-zinc-800/50", color: "text-zinc-600" },
                { icon: Users, label: "Salle de Sport", type: "salle_sport", desc: "10 abonnements", bg: "bg-emerald-100 dark:bg-emerald-900/30", color: "text-emerald-600" },
              ].map((a) => (
                <Card key={a.type} className={`border hover:shadow-md transition-shadow cursor-pointer ${settingUpType === a.type ? "ring-2 ring-[#0088cc]" : ""}`} onClick={() => handleOneClickSetup(a.type)}>
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    {settingUpType === a.type ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#0088cc]" />
                    ) : (
                      <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center`}>
                        <a.icon className={`w-5 h-5 ${a.color}`} />
                      </div>
                    )}
                    <h3 className="font-semibold text-xs">{a.label}</h3>
                    <p className="text-[10px] text-muted-foreground text-center">{a.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button size="lg" onClick={() => handleOneClickSetup()} disabled={settingUp} className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
              {settingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {settingUp ? "Création..." : "Créer Tous les Agents"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Empty State (non-admin) ─── */}
      {!hasAgents && !canManageAgents && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Aucun agent Telegram</h2>
              <p className="text-sm text-muted-foreground">Votre administrateur doit d'abord creer les agents depuis le panneau de configuration.</p>
            </div>
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dashboard" className="gap-2">
                <Eye className="w-4 h-4" />
                Vue d&apos;ensemble
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
                  <Card key={agent.id} className="overflow-hidden hover:shadow-md transition-all cursor-pointer hover:border-[#0088cc]/50" onClick={() => canManageAgents ? openAgentConfig(agent) : openActivateDialog(agent)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {(() => { const bc = getBusinessConfig(agent.businessType); const Icon = bc.icon; return (
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bc.bg} ${bc.bgDark}`}>
                              <Icon className={`w-5 h-5 ${bc.color}`} />
                            </div>
                          ); })()}
                          <div>
                            <CardTitle className="text-base">{agent.name}</CardTitle>
                            <CardDescription className="text-xs">
                              {getBusinessConfig(agent.businessType).label}
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

                      {/* Configurer Button */}
                      <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
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
                            {canManageAgents && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => openEditAgent(agent)} className="gap-2">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => toggleAgentActive(agent)} className="gap-2">
                                  {agent.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      {/* Click hint */}
                      <p className="text-[10px] text-center text-muted-foreground">
                        {canManageAgents ? "Cliquez pour configurer l&apos;agent" : "Cliquez pour configurer le token"}
                      </p>
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
                                    {(() => { const bc = getBusinessConfig(b.agent?.businessType || "restaurant"); const Icon = bc.icon; return <Icon className="w-3 h-3 mr-1" />; })()}
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

            {/* ─── Bookings Tab ─── */}
            <TabsContent value="bookings" className="space-y-4 mt-4">
              {/* Filter Bar & View Toggle */}
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
                          {bookings.filter((b) => b.status === status).length}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex border rounded-lg p-0.5">
                    <Button
                      size="sm"
                      variant={bookingViewMode === "table" ? "default" : "ghost"}
                      onClick={() => setBookingViewMode("table")}
                      className="gap-1.5 text-xs h-7 px-2.5"
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      Tableau
                    </Button>
                    <Button
                      size="sm"
                      variant={bookingViewMode === "calendar" ? "default" : "ghost"}
                      onClick={() => setBookingViewMode("calendar")}
                      className="gap-1.5 text-xs h-7 px-2.5"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      Calendrier
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { fetchBookings(bookingStatusFilter); fetchStats(); }} className="gap-2 h-7">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Calendar View */}
              {bookingViewMode === "calendar" ? (
                <BookingCalendar
                  bookings={bookings}
                  agents={agents.map((a) => ({ id: a.id, name: a.name, businessType: a.businessType }))}
                  onStatusChange={updateBookingStatus}
                  onBookingCreated={() => { fetchBookings(bookingStatusFilter); fetchStats(); }}
                />
              ) : (
                /* Table View */
                bookings.length === 0 ? (
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
                                    {b.agent?.businessType === "restaurant" ? (
                                      <UtensilsCrossed className="w-3 h-3 text-orange-500" />
                                    ) : (
                                      <Scissors className="w-3 h-3 text-purple-500" />
                                    )}
                                    <span className="text-sm">{b.serviceName || "—"}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{b.agent?.name || "-"}</TableCell>
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
                )
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
                  {Object.entries(BUSINESS_TYPE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2"><Icon className="w-4 h-4" /> {cfg.label}</span>
                      </SelectItem>
                    );
                  })}
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
                    <SelectItem value="none">Aucun</SelectItem>
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

            <Separator />

            {/* ─── AI Configuration (ADMIN ONLY) ─── */}
            {isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <Label className="text-sm font-semibold">Configuration IA</Label>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">IA Active</p>
                  <p className="text-xs text-muted-foreground">Activer les réponses automatiques par IA</p>
                </div>
                <Switch
                  checked={agentForm.aiEnabled}
                  onCheckedChange={(v) => setAgentForm({ ...agentForm, aiEnabled: v })}
                />
              </div>
              {agentForm.aiEnabled && (
                <div className="space-y-3 pl-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Fournisseur IA</Label>
                      <Select value={agentForm.aiProvider} onValueChange={(v) => setAgentForm({ ...agentForm, aiProvider: v as "openai" | "anthropic" | "openrouter" | "custom" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openrouter">OpenRouter (Multi-modal)</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="custom">Personnalisé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Modele</Label>
                      <Input
                        placeholder={agentForm.aiProvider === "openrouter" ? "google/gemini-2.0-flash-001" : agentForm.aiProvider === "anthropic" ? "claude-3-haiku" : "gpt-4o-mini"}
                        value={agentForm.aiModel}
                        onChange={(e) => setAgentForm({ ...agentForm, aiModel: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Clé API</Label>
                    <Input
                      type="password"
                      placeholder={agentForm.aiProvider === "openrouter" ? "sk-or-..." : "sk-..."}
                      value={agentForm.aiApiKey}
                      onChange={(e) => setAgentForm({ ...agentForm, aiApiKey: e.target.value })}
                    />
                  </div>
                  {agentForm.aiProvider === "openrouter" && (
                    <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        <strong>OpenRouter</strong> supporte +100 modeles multi-modaux (Gemini, GPT-4o, Claude, Llama Vision, etc.). Obtenez votre clé sur <span className="underline">openrouter.ai/keys</span>
                      </p>
                    </div>
                  )}
                  {agentForm.aiProvider === "custom" && (
                    <div className="space-y-2">
                      <Label>URL de base (Base URL)</Label>
                      <Input
                        placeholder="https://api.example.com/v1"
                        value={agentForm.aiBaseUrl}
                        onChange={(e) => setAgentForm({ ...agentForm, aiBaseUrl: e.target.value })}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Prompt Système (optionnel)</Label>
                    <Textarea
                      placeholder="Instructions pour l'IA... Laissez vide pour le prompt par défaut."
                      rows={3}
                      value={agentForm.aiSystemPrompt}
                      onChange={(e) => setAgentForm({ ...agentForm, aiSystemPrompt: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
            )}
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
              {activateAgent && !isPlaceholder(activateAgent.token) ? "Token du Bot" : "Activer le Bot Telegram"}
            </DialogTitle>
            <DialogDescription>
              {activateAgent && !isPlaceholder(activateAgent.token)
                ? "Modifiez ou mettez à jour le token de votre bot"
                : "Connectez votre bot en entrant le token fourni par @BotFather"}
            </DialogDescription>
          </DialogHeader>
          {activateAgent && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 flex items-center gap-3">
                {(() => { const bc = getBusinessConfig(activateAgent.businessType); const Icon = bc.icon; return (
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bc.bg} ${bc.bgDark}`}>
                    <Icon className={`w-5 h-5 ${bc.color}`} />
                  </div>
                ); })()}
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
              Gérez les {getBusinessConfig(servicesAgent?.businessType || "restaurant").servicesLabel}
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
                    {formatCurrency(svc.price, servicesAgent?.currency || "XAF")}
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

      {/* ─── Agent Config Dialog (click on card) ─── */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {selectedAgent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {(() => { const bc = getBusinessConfig(selectedAgent.businessType); const Icon = bc.icon; return (
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bc.bg} ${bc.bgDark}`}>
                      <Icon className={`w-5 h-5 ${bc.color}`} />
                    </div>
                  ); })()}
                  <div>
                    <span>Configuration — </span>
                    <span className="font-bold">{selectedAgent.name}</span>
                    <p className="text-xs text-muted-foreground font-normal">
                      {getBusinessConfig(selectedAgent.businessType).label}
                      {selectedAgent.botUsername ? ` · @${selectedAgent.botUsername}` : ""}
                      {" · "}{selectedAgent._count.services} services · {selectedAgent._count.bookings} réservations
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Config Tabs */}
              <Tabs value={configTab} onValueChange={setConfigTab} className="flex-1 min-h-0">
                <TabsList className={`grid w-full ${isAdmin ? "grid-cols-4" : canManageAgents ? "grid-cols-3" : "grid-cols-2"}`}>
                  <TabsTrigger value="infos" className="gap-1.5 text-xs">
                    <Settings2 className="w-3.5 h-3.5" />
                    Infos
                  </TabsTrigger>
                  <TabsTrigger value="services" className="gap-1.5 text-xs">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Services
                  </TabsTrigger>
                  {isAdmin && (
                    <TabsTrigger value="ai" className="gap-1.5 text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      IA
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="payment" className="gap-1.5 text-xs">
                    <CreditCard className="w-3.5 h-3.5" />
                    Paiement
                  </TabsTrigger>
                </TabsList>

                {/* ── Infos Tab ── */}
                <TabsContent value="infos" className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nom de l&apos;agent</Label>
                      <Input
                        value={configForm.name}
                        onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                        disabled={!canManageAgents}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Type d&apos;activite</Label>
                      <Select value={configForm.businessType} onValueChange={(v) => setConfigForm({ ...configForm, businessType: v })} disabled={!canManageAgents}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(BUSINESS_TYPE_CONFIG).map(([key, cfg]) => (
                            <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Token Telegram</Label>
                      <Input
                        type="password"
                        value={configForm.token}
                        onChange={(e) => setConfigForm({ ...configForm, token: e.target.value })}
                        placeholder={isPlaceholder(configForm.token) ? "Collez le token de @BotFather ici" : "Token configuré"}
                      />
                      <p className="text-xs text-muted-foreground">Obtenez votre token via @BotFather sur Telegram</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Username du Bot</Label>
                      <Input
                        value={configForm.botUsername}
                        onChange={(e) => setConfigForm({ ...configForm, botUsername: e.target.value })}
                        placeholder="@mon_bot"
                        disabled={!canManageAgents}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Adresse</Label>
                      <Input
                        value={configForm.address}
                        onChange={(e) => setConfigForm({ ...configForm, address: e.target.value })}
                        placeholder="Douala, Quartier Bonapriso"
                        disabled={!canManageAgents}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telephone</Label>
                      <Input
                        value={configForm.phone}
                        onChange={(e) => setConfigForm({ ...configForm, phone: e.target.value })}
                        placeholder="+237 6XX XXX XXX"
                        disabled={!canManageAgents}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Horaires d&apos;ouverture</Label>
                      <Input
                        value={configForm.openHours}
                        onChange={(e) => setConfigForm({ ...configForm, openHours: e.target.value })}
                        placeholder="Lun-Sam: 8h-22h · Dim: 10h-18h"
                        disabled={!canManageAgents}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Message de bienvenue</Label>
                      <Textarea
                        value={configForm.welcomeMessage}
                        onChange={(e) => setConfigForm({ ...configForm, welcomeMessage: e.target.value })}
                        placeholder="Message affiché quand un client lance le bot..."
                        rows={3}
                        disabled={!canManageAgents}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* ── Services Tab ── */}
                <TabsContent value="services" className="flex-1 overflow-y-auto space-y-3 mt-4 pr-1">
                  {servicesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : services.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">Aucun service configure</p>
                      <p className="text-xs text-muted-foreground mt-1">Ajoutez des {getBusinessConfig(selectedAgent.businessType).servicesLabel} ci-dessous</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {services.map((svc, i) => (
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
                              {!svc.isActive && (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactif</Badge>
                              )}
                            </div>
                            {svc.description && (
                              <p className="text-xs text-muted-foreground truncate">{svc.description}</p>
                            )}
                          </div>
                          <p className="font-semibold text-sm whitespace-nowrap">
                            {formatCurrency(svc.price, configForm.currency || "XAF")}
                          </p>
                          {canManageAgents && (
                            <Button size="sm" variant="ghost" onClick={() => deleteService(svc.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Service */}
                  {canManageAgents && (
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
                  )}
                </TabsContent>

                {/* ── AI Tab (admin only) ── */}
                {isAdmin && (
                  <TabsContent value="ai" className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">Assistant IA active</p>
                        <p className="text-xs text-muted-foreground">Activer les reponses automatiques par IA pour ce bot</p>
                      </div>
                      <Switch
                        checked={configForm.aiEnabled}
                        onCheckedChange={(v) => setConfigForm({ ...configForm, aiEnabled: v })}
                      />
                    </div>

                    {configForm.aiEnabled && (
                      <div className="space-y-4 pl-0">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Fournisseur IA</Label>
                            <Select value={configForm.aiProvider} onValueChange={(v) => setConfigForm({ ...configForm, aiProvider: v as "openai" | "anthropic" | "openrouter" | "custom" })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="openrouter">OpenRouter (Multi-modal)</SelectItem>
                                <SelectItem value="openai">OpenAI</SelectItem>
                                <SelectItem value="anthropic">Anthropic</SelectItem>
                                <SelectItem value="custom">Personnalise</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Modele</Label>
                            <Input
                              placeholder={configForm.aiProvider === "openrouter" ? "google/gemini-2.0-flash-001" : configForm.aiProvider === "anthropic" ? "claude-3-haiku" : "gpt-4o-mini"}
                              value={configForm.aiModel}
                              onChange={(e) => setConfigForm({ ...configForm, aiModel: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cle API</Label>
                          <Input
                            type="password"
                            placeholder="sk-or-..."
                            value={configForm.aiApiKey}
                            onChange={(e) => setConfigForm({ ...configForm, aiApiKey: e.target.value })}
                          />
                        </div>
                        {configForm.aiProvider === "openrouter" && (
                          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              <strong>OpenRouter</strong> supporte +100 modeles multi-modaux (Gemini, GPT-4o, Claude, Llama Vision, etc.). Cle sur <span className="underline">openrouter.ai/keys</span>
                            </p>
                          </div>
                        )}
                        {configForm.aiProvider === "custom" && (
                          <div className="space-y-2">
                            <Label>URL de base (Base URL)</Label>
                            <Input
                              placeholder="https://api.example.com/v1"
                              value={configForm.aiBaseUrl}
                              onChange={(e) => setConfigForm({ ...configForm, aiBaseUrl: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Prompt Systeme (optionnel)</Label>
                          <Textarea
                            placeholder="Instructions pour l'IA... Laissez vide pour le prompt par defaut."
                            rows={4}
                            value={configForm.aiSystemPrompt}
                            onChange={(e) => setConfigForm({ ...configForm, aiSystemPrompt: e.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    {!configForm.aiEnabled && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">L'assistant IA est desactive</p>
                        <p className="text-xs">Activez-le pour que le bot reponde automatiquement avec l'IA</p>
                      </div>
                    )}
                  </TabsContent>
                )}

                {/* ── Payment Tab ── */}
                <TabsContent value="payment" className="flex-1 overflow-y-auto space-y-4 mt-4 pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Devise</Label>
                      <Select value={configForm.currency} onValueChange={(v) => setConfigForm({ ...configForm, currency: v })} disabled={!canManageAgents}>
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
                      <Label>Mode de paiement</Label>
                      <Select value={configForm.paymentMethod} onValueChange={(v) => setConfigForm({ ...configForm, paymentMethod: v })} disabled={!canManageAgents}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="orange_money">Orange Money</SelectItem>
                          <SelectItem value="mtn_money">MTN Mobile Money</SelectItem>
                          <SelectItem value="cash">Especes</SelectItem>
                          <SelectItem value="none">Aucun</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Payment Info */}
                  {(configForm.paymentMethod === "orange_money" || configForm.paymentMethod === "mtn_money") && (
                    <div className={`p-4 rounded-lg border ${configForm.paymentMethod === "orange_money" ? "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50" : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50"}`}>
                      <div className="flex items-center gap-3 mb-2">
                        <CreditCard className={`w-5 h-5 ${configForm.paymentMethod === "orange_money" ? "text-orange-600" : "text-yellow-600"}`} />
                        <p className="font-medium text-sm">
                          {configForm.paymentMethod === "orange_money" ? "Orange Money" : "MTN Mobile Money"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Les clients pourront payer directement via {configForm.paymentMethod === "orange_money" ? "Orange Money" : "MTN Mobile Money"} lorsqu&apos;ils passent commande sur le bot.
                        Assurez-vous que votre numero de paiement est configure dans les parametres du bot Telegram.
                      </p>
                    </div>
                  )}

                  {/* Summary */}
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm font-medium">Resume de la configuration</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Agent :</span>
                        <span className="font-medium">{configForm.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Type :</span>
                        <span className="font-medium">{getBusinessConfig(configForm.businessType).label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Devise :</span>
                        <span className="font-medium">{configForm.currency}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Paiement :</span>
                        <span className="font-medium">
                          {configForm.paymentMethod === "orange_money" ? "Orange Money" : configForm.paymentMethod === "mtn_money" ? "MTN MoMo" : configForm.paymentMethod === "cash" ? "Especes" : "Aucun"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Services :</span>
                        <span className="font-medium">{selectedAgent._count.services}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IA :</span>
                        <span className="font-medium">{configForm.aiEnabled ? "Active" : "Desactivee"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Token :</span>
                        <span className="font-medium">{isPlaceholder(configForm.token) ? "Non configure" : "Configure"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Statut :</span>
                        <Badge variant="outline" className={selectedAgent.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : ""}>
                          {selectedAgent.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="border-t pt-4 flex-shrink-0">
                <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Fermer</Button>
                <Button onClick={saveAgentConfig} disabled={configSaving} className="gap-2 bg-[#0088cc] hover:bg-[#006699]">
                  {configSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Settings2 className="w-4 h-4" />}
                  Sauvegarder
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
