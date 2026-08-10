"use client";

// ============================================================
// TELEGRAM ADS CAMPAIGNS PAGE
// ============================================================
// Complete campaign management: create, launch, pause, stats
// Supports: Telegram, WhatsApp (future), SMS (future)
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Ban,
  Trash2,
  Send,
  Users,
  Eye,
  MousePointerClick,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───
interface TelegramAgent {
  id: string;
  name: string;
  botUsername?: string;
}

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  message: string;
  imageUrl?: string;
  buttonUrl?: string;
  buttonText?: string;
  segmentType: string;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  clickedCount: number;
  failedCount: number;
  budget: number;
  budgetSpent: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  telegramAgent?: TelegramAgent | null;
}

interface CampaignStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  clicked: number;
  budgetSpent: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Brouillon", color: "bg-gray-500/10 text-gray-500 border-gray-500/20", icon: FileText },
  scheduled: { label: "Planifiée", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Clock },
  running: { label: "En cours", color: "bg-green-500/10 text-green-500 border-green-500/20", icon: Play },
  paused: { label: "En pause", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: Pause },
  completed: { label: "Terminée", color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: CheckCircle2 },
  failed: { label: "Échouée", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle },
  cancelled: { label: "Annulée", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", icon: Ban },
};

const SEGMENT_OPTIONS = [
  { value: "all", label: "Tous les contacts", desc: "Envoie à tous vos contacts" },
  { value: "contacts", label: "Contacts uniquement", desc: "Uniquement les contacts enregistrés" },
  { value: "leads", label: "Leads", desc: "Prospects et leads non convertis" },
  { value: "customers", label: "Clients", desc: "Contacts avec au moins 1 commande" },
  { value: "vip", label: "VIP", desc: "Clients fidèles (5+ commandes)" },
  { value: "inactive", label: "Inactifs", desc: "Pas d'interaction depuis 30 jours" },
];

function FileText({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default function CampaignsPage() {
  const { token, user } = useAppStore();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);

  // Create form
  const [form, setForm] = useState({
    name: "",
    message: "",
    segmentType: "all",
    telegramAgentId: "none",
    scheduledDate: "",
    scheduledTime: "",
    buttonUrl: "",
    buttonText: "",
    budget: "",
  });
  const [creating, setCreating] = useState(false);

  // ─── Fetch campaigns ───
  const fetchCampaigns = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);

      const res = await fetch(`/api/campaigns?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
        setStats(data.stats || null);
      }
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // ─── Auth headers ───
  const authHeaders = () => ({ Authorization: `Bearer ${token}` });

  // ─── Create campaign ───
  const handleCreate = async () => {
    if (!form.name.trim() || !form.message.trim()) {
      toast.error("Nom et message requis");
      return;
    }

    setCreating(true);
    try {
      const scheduledAt =
        form.scheduledDate && form.scheduledTime
          ? `${form.scheduledDate}T${form.scheduledTime}:00`
          : undefined;

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          telegramAgentId: form.telegramAgentId === "none" ? null : form.telegramAgentId,
          scheduledAt,
          budget: form.budget ? parseFloat(form.budget) : 0,
        }),
      });

      if (res.ok) {
        toast.success("Campagne créée avec succès !");
        setShowCreate(false);
        setForm({
          name: "",
          message: "",
          segmentType: "all",
          telegramAgentId: "none",
          scheduledDate: "",
          scheduledTime: "",
          buttonUrl: "",
          buttonText: "",
          budget: "",
        });
        fetchCampaigns();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setCreating(false);
    }
  };

  // ─── Launch / Pause / Cancel ───
  const handleAction = async (campaignId: string, action: string, campaignName: string) => {
    try {
      const res = await fetch("/api/campaigns/launch", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, action }),
      });

      if (res.ok) {
        const labels: Record<string, string> = {
          launch: "lancée",
          pause: "mise en pause",
          resume: "relancée",
          cancel: "annulée",
        };
        toast.success(`Campagne "${campaignName}" ${labels[action] || action}`);
        fetchCampaigns();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    }
  };

  // ─── Delete ───
  const handleDelete = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Supprimer la campagne "${campaignName}" ?`)) return;

    try {
      const res = await fetch(`/api/campaigns?id=${campaignId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (res.ok) {
        toast.success("Campagne supprimée");
        fetchCampaigns();
      } else {
        const data = await res.json();
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    }
  };

  // ─── Render helpers ───
  const statusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {cfg.label}
      </Badge>
    );
  };

  const deliveryRate = (c: Campaign) =>
    c.sentCount > 0 ? Math.round((c.deliveredCount / c.sentCount) * 100) : 0;

  const openRate = (c: Campaign) =>
    c.deliveredCount > 0 ? Math.round((c.readCount / c.deliveredCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <Header title="Campagnes Telegram Ads" subtitle="Créez et gérez vos campagnes de marketing via Telegram" />

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-[#25D366]/5 to-transparent border-[#25D366]/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#25D366]/10">
                <Megaphone className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">Campagnes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.sent ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">Messages envoyés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <MessageSquare className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.replied ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">Réponses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MousePointerClick className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.clicked ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">Clics</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Actions Bar ─── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="scheduled">Planifiée</SelectItem>
              <SelectItem value="running">En cours</SelectItem>
              <SelectItem value="paused">En pause</SelectItem>
              <SelectItem value="completed">Terminée</SelectItem>
              <SelectItem value="failed">Échouée</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="text-[11px]">
            {campaigns.length} campagne{campaigns.length > 1 ? "s" : ""}
          </Badge>
        </div>

        <Button onClick={() => setShowCreate(true)} className="bg-[#25D366] hover:bg-[#1fa855] text-white">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle campagne
        </Button>
      </div>

      {/* ─── Campaign List ─── */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Megaphone className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Aucune campagne</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Créez votre première campagne Telegram Ads pour atteindre vos clients.
            </p>
            <Button onClick={() => setShowCreate(true)} className="bg-[#25D366] hover:bg-[#1fa855] text-white">
              <Plus className="w-4 h-4 mr-2" />
              Créer une campagne
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="group hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold truncate">{campaign.name}</CardTitle>
                    <CardDescription className="text-[11px] mt-1">
                      {new Date(campaign.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                      {campaign.telegramAgent && (
                        <span className="ml-2 text-[#25D366]">via {campaign.telegramAgent.name}</span>
                      )}
                    </CardDescription>
                  </div>
                  {statusBadge(campaign.status)}
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Message preview */}
                <p className="text-xs text-muted-foreground line-clamp-2 bg-muted/50 p-2 rounded-md">
                  {campaign.message}
                </p>

                {/* Progress bar */}
                {campaign.sentCount > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Progression</span>
                      <span>{Math.min(100, Math.round((campaign.deliveredCount / campaign.recipientCount) * 100))}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#25D366] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (campaign.deliveredCount / campaign.recipientCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-xs font-semibold">{campaign.recipientCount}</p>
                    <p className="text-[9px] text-muted-foreground">Cibles</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{campaign.sentCount}</p>
                    <p className="text-[9px] text-muted-foreground">Envoyés</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{openRate(campaign)}%</p>
                    <p className="text-[9px] text-muted-foreground">Ouverture</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{campaign.repliedCount}</p>
                    <p className="text-[9px] text-muted-foreground">Réponses</p>
                  </div>
                </div>

                {/* Segment badge */}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">
                    <Target className="w-2.5 h-2.5 mr-1" />
                    {SEGMENT_OPTIONS.find((s) => s.value === campaign.segmentType)?.label || campaign.segmentType}
                  </Badge>
                  {campaign.budget > 0 && (
                    <Badge variant="outline" className="text-[9px]">
                      <DollarSign className="w-2.5 h-2.5 mr-1" />
                      {campaign.budgetSpent.toFixed(0)} / {campaign.budget.toFixed(0)} XAF
                    </Badge>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] flex-1"
                    onClick={() => { setSelectedCampaign(campaign); setShowDetail(true); }}
                  >
                    <BarChart3 className="w-3 h-3 mr-1" />
                    Stats
                  </Button>

                  {campaign.status === "draft" && (
                    <Button
                      size="sm"
                      className="h-7 text-[11px] flex-1 bg-[#25D366] hover:bg-[#1fa855] text-white"
                      onClick={() => handleAction(campaign.id, "launch", campaign.name)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Lancer
                    </Button>
                  )}

                  {campaign.status === "scheduled" && (
                    <Button
                      size="sm"
                      className="h-7 text-[11px] flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                      onClick={() => handleAction(campaign.id, "launch", campaign.name)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Lancer maintenant
                    </Button>
                  )}

                  {campaign.status === "running" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] flex-1 border-amber-500 text-amber-500"
                      onClick={() => handleAction(campaign.id, "pause", campaign.name)}
                    >
                      <Pause className="w-3 h-3 mr-1" />
                      Pause
                    </Button>
                  )}

                  {campaign.status === "paused" && (
                    <Button
                      size="sm"
                      className="h-7 text-[11px] flex-1 bg-[#25D366] hover:bg-[#1fa855] text-white"
                      onClick={() => handleAction(campaign.id, "resume", campaign.name)}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Reprendre
                    </Button>
                  )}

                  {["draft", "scheduled", "failed", "cancelled"].includes(campaign.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      onClick={() => handleDelete(campaign.id, campaign.name)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}

                  {["running", "paused", "scheduled"].includes(campaign.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
                      onClick={() => handleAction(campaign.id, "cancel", campaign.name)}
                    >
                      <Ban className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── CREATE DIALOG ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-[#25D366]" />
              Nouvelle Campagne
            </DialogTitle>
            <DialogDescription>
              Créez une campagne Telegram pour toucher vos clients cibles.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs">Nom de la campagne *</Label>
              <Input
                placeholder="Ex: Promo Fête de Noël"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Message *</Label>
              <Textarea
                placeholder="Votre message publicitaire... Utilisez {name} pour personnaliser."
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Variables: {"{name}"} = nom du contact, {"{phone}"} = numéro
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Segment cible</Label>
                <Select value={form.segmentType} onValueChange={(v) => setForm({ ...form, segmentType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Bot Telegram</Label>
                <Select value={form.telegramAgentId} onValueChange={(v) => setForm({ ...form, telegramAgentId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun (simulation)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Texte du bouton</Label>
                <Input
                  placeholder="Commander"
                  value={form.buttonText}
                  onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">URL du bouton</Label>
                <Input
                  placeholder="https://..."
                  value={form.buttonUrl}
                  onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Date d'envoi (optionnel)</Label>
                <Input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Heure d'envoi</Label>
                <Input
                  type="time"
                  value={form.scheduledTime}
                  onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Budget (optionnel)</Label>
              <Input
                type="number"
                placeholder="0"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !form.name.trim() || !form.message.trim()}
              className="bg-[#25D366] hover:bg-[#1fa855] text-white"
            >
              {creating ? "Création..." : "Créer la campagne"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DETAIL / STATS DIALOG ─── */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.name}</DialogTitle>
            <DialogDescription>Statistiques détaillées de la campagne</DialogDescription>
          </DialogHeader>

          {selectedCampaign && (
            <div className="space-y-4">
              {statusBadge(selectedCampaign.status)}

              <div className="grid grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Send className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold">{selectedCampaign.sentCount}</p>
                    <p className="text-[10px] text-muted-foreground">Envoyés</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Eye className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-lg font-bold">{selectedCampaign.readCount}</p>
                    <p className="text-[10px] text-muted-foreground">Lus</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <MessageSquare className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-lg font-bold">{selectedCampaign.repliedCount}</p>
                    <p className="text-[10px] text-muted-foreground">Réponses</p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Taux de livraison</span>
                  <span className="font-medium">{deliveryRate(selectedCampaign)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${deliveryRate(selectedCampaign)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Taux d'ouverture</span>
                  <span className="font-medium">{openRate(selectedCampaign)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#25D366] rounded-full"
                    style={{ width: `${openRate(selectedCampaign)}%` }}
                  />
                </div>
              </div>

              {selectedCampaign.budget > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Budget</span>
                    <span>{selectedCampaign.budgetSpent.toFixed(0)} / {selectedCampaign.budget.toFixed(0)} XAF</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${Math.min(100, (selectedCampaign.budgetSpent / selectedCampaign.budget) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-2 border-t">
                <div>Cible: {selectedCampaign.recipientCount} contacts</div>
                <div>Échoués: {selectedCampaign.failedCount}</div>
                <div>Clics: {selectedCampaign.clickedCount}</div>
                <div>Type: {selectedCampaign.type}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
