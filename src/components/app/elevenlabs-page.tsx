"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/store/app";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AudioLines, Plus, Settings, Trash2, Play, Square,
  MessageCircle, Bot, Globe, RefreshCw, Send, Loader2,
  AlertCircle, CheckCircle2, XCircle, Volume2, Brain, Zap, Store, Scissors, Pill, Car, Flame,
  Phone, MessageSquare, PhoneCall, Link2, Info
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

interface ElevenLabsAgent {
  id: string;
  companyId: string;
  name: string;
  elevenAgentId: string | null;
  businessType: string;
  isActive: boolean;
  agentConfig: string | null;
  webhookSecret: string | null;
  welcomeMessage: string | null;
  address: string | null;
  phone: string | null;
  openHours: string | null;
  currency: string;
  paymentMethod: string | null;
  totalConversations: number;
  totalMessages: number;
  lastActivityAt: string | null;
  createdAt: string;
  elevenLabsStatus?: string;
  elevenLabsName?: string | null;
  services?: Service[];
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number | null;
  isActive: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
}

// ─── Business Type Config ───────────────────────────────────────

const BUSINESS_TYPES: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  restaurant: { label: "Restaurant", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" },
  salon_coiffure: { label: "Salon de Coiffure", icon: Scissors, color: "text-pink-500", bg: "bg-pink-500/10" },
  pharmacie: { label: "Pharmacie", icon: Pill, color: "text-green-500", bg: "bg-green-500/10" },
  taxi: { label: "Taxi / Transport", icon: Car, color: "text-blue-500", bg: "bg-blue-500/10" },
  braiseuse_poisson: { label: "Braiseuse de Poisson", icon: Flame, color: "text-red-500", bg: "bg-red-500/10" },
  default: { label: "Standard", icon: Bot, color: "text-purple-500", bg: "bg-purple-500/10" },
};

// ─── Main Component ────────────────────────────────────────────

export default function ElevenLabsPage() {
  const { token, user } = useAppStore();
  const isAdmin = user?.role === "super_admin" || user?.role === "company_admin";
  const isSystemAdmin = user?.role === "super_admin";
  const canManage = isAdmin || isSystemAdmin;

  const [agents, setAgents] = useState<ElevenLabsAgent[]>([]);
  const [stats, setStats] = useState({ totalAgents: 0, activeAgents: 0, connectedAgents: 0, totalMessages: 0 });
  const [platformReady, setPlatformReady] = useState(true);
  const [voices, setVoices] = useState<{ id: string; name: string; category: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [configDialogAgent, setConfigDialogAgent] = useState<ElevenLabsAgent | null>(null);
  const [chatDialogAgent, setChatDialogAgent] = useState<ElevenLabsAgent | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({ name: "", businessType: "default", voiceId: "" });
  const [creating, setCreating] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatConversationId, setChatConversationId] = useState<string>("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // ─── Fetch agents ─────────────────────────────────────────
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/elevenlabs/agents", { headers: headers() });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur");
      const data = await res.json();
      setAgents(data.agents || []);
      setStats(data.stats || { totalAgents: 0, activeAgents: 0, connectedAgents: 0, totalMessages: 0 });
      setPlatformReady(data.platformReady !== false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  // ─── Fetch voices ──────────────────────────────────────────
  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch("/api/elevenlabs/voices", { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setVoices(data.voices || []);
      }
    } catch { /* silent */ }
  }, [headers]);

  useEffect(() => {
    fetchAgents();
    fetchVoices();
  }, [fetchAgents, fetchVoices]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Create agent ─────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/elevenlabs/agents", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          businessType: createForm.businessType,
          voiceId: createForm.voiceId || undefined,
          createOnElevenLabs: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setCreateDialogOpen(false);
      setCreateForm({ name: "", businessType: "default", voiceId: "" });
      fetchAgents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur");
    } finally {
      setCreating(false);
    }
  };

  // ─── Toggle agent ─────────────────────────────────────────
  const handleToggle = async (agent: ElevenLabsAgent) => {
    try {
      await fetch(`/api/elevenlabs/agents/${agent.id}`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      fetchAgents();
    } catch { /* silent */ }
  };

  // ─── Delete agent ─────────────────────────────────────────
  const handleDelete = async (agent: ElevenLabsAgent) => {
    if (!confirm(`Supprimer l'agent "${agent.name}" ? Cette action est irreversible.`)) return;
    try {
      await fetch(`/api/elevenlabs/agents/${agent.id}`, { method: "DELETE", headers: headers() });
      fetchAgents();
    } catch { /* silent */ }
  };

  // ─── Connect to ElevenLabs ─────────────────────────────────
  const handleConnect = async (agent: ElevenLabsAgent) => {
    try {
      const res = await fetch(`/api/elevenlabs/agents/${agent.id}`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      alert(data.message);
      fetchAgents();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur");
    }
  };

  // ─── Send chat message ────────────────────────────────────
  const handleSendChat = async () => {
    if (!chatInput.trim() || !chatDialogAgent) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/elevenlabs/agents/${chatDialogAgent.id}`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          message: userMsg,
          conversationId: chatConversationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      if (data.conversationId) setChatConversationId(data.conversationId);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response || "(pas de reponse)",
          audioUrl: data.audioUrl,
        },
      ]);
    } catch (e: unknown) {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erreur: ${e instanceof Error ? e.message : "inconnue"}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // ─── Status badge ─────────────────────────────────────────
  const StatusBadge = ({ agent }: { agent: ElevenLabsAgent }) => {
    if (!agent.isActive) return <Badge variant="secondary" className="bg-gray-100 text-gray-500"><XCircle className="w-3 h-3 mr-1"/>Inactif</Badge>;
    if (agent.elevenLabsStatus === "active") return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1"/>Connecte</Badge>;
    if (agent.elevenAgentId) return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><AlertCircle className="w-3 h-3 mr-1"/>Non sync</Badge>;
    return <Badge variant="outline"><Volume2 className="w-3 h-3 mr-1"/>Local</Badge>;
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <AudioLines className="w-5 h-5 text-white" />
            </div>
            Agents Vocaux IA
          </h1>
          <p className="text-muted-foreground mt-1">Agents IA ElevenLabs — Voix + WhatsApp</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => { fetchAgents(); fetchVoices(); }}>
            <RefreshCw className="w-4 h-4 mr-2" />Rafraichir
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Nouvel Agent
            </Button>
          )}
        </div>
      </div>

      {/* ─── Platform Service Banner ────────────────────────── */}
      {!platformReady && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Service IA en cours d'activation</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                Les agents vocaux et WhatsApp seront disponibles sous peu. Aucune configuration de votre part n'est requise.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── WhatsApp Integration Banner ────────────────────── */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">Intégration WhatsApp Agents</h3>
                <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Nouveau</Badge>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Vos agents IA sont désormais disponibles sur WhatsApp. Messages vocaux, appels automatiques et réponses intelligentes — la plateforme gère tout.
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-green-600 dark:text-green-400">
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />Messages &amp; notes vocales</span>
                <span className="flex items-center gap-1"><PhoneCall className="w-3 h-3" />Appels entrants &amp; sortants</span>
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Réponses IA en temps réel</span>
                <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" />Voix naturelle multilingue</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Stats ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Agents</p><p className="text-2xl font-bold mt-1">{stats.totalAgents}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Actifs</p><p className="text-2xl font-bold mt-1 text-green-600">{stats.activeAgents}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Connectes a ElevenLabs</p><p className="text-2xl font-bold mt-1 text-violet-600">{stats.connectedAgents}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Messages Echanges</p><p className="text-2xl font-bold mt-1">{stats.totalMessages}</p></CardContent></Card>
      </div>

      {/* ─── Error ───────────────────────────────────────────── */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* ─── Empty State ─────────────────────────────────────── */}
      {agents.length === 0 && !error && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-6">
            <AudioLines className="w-10 h-10 text-violet-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Aucun agent vocal</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Creez votre premier agent conversationnel ElevenLabs. Il pourra repondre automatiquement a vos clients avec une voix naturelle.
          </p>
          {canManage && (
            <Button onClick={() => setCreateDialogOpen(true)} size="lg">
              <Plus className="w-5 h-5 mr-2" />Creer un Agent Vocal
            </Button>
          )}
          {/* Quick create cards */}
          {canManage && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-10 max-w-2xl mx-auto">
              {Object.entries(BUSINESS_TYPES).filter(([k]) => k !== "default").map(([key, bt]) => {
                const Icon = bt.icon;
                return (
                  <Card
                    key={key}
                    className="cursor-pointer hover:border-violet-300 hover:shadow-md transition-all"
                    onClick={() => { setCreateForm((prev) => ({ ...prev, businessType: key })); setCreateDialogOpen(true); }}
                  >
                    <CardContent className="p-4 text-center">
                      <div className={`w-12 h-12 rounded-xl ${bt.bg} flex items-center justify-center mx-auto mb-3`}>
                        <Icon className={`w-6 h-6 ${bt.color}`} />
                      </div>
                      <p className="text-sm font-medium">{bt.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Agents Grid ─────────────────────────────────────── */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => {
            const bt = BUSINESS_TYPES[agent.businessType] || BUSINESS_TYPES.default;
            const BtIcon = bt.icon;
            const config = agent.agentConfig ? JSON.parse(agent.agentConfig) : null;

            return (
              <Card key={agent.id} className="relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${bt.bg} flex items-center justify-center shrink-0`}>
                        <BtIcon className={`w-5 h-5 ${bt.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{agent.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{bt.label}</CardDescription>
                      </div>
                    </div>
                    <StatusBadge agent={agent} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Agent info */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Voix:</span> <span className="font-medium">{config?.voiceId ? voices.find((v) => v.id === config.voiceId)?.name || "Configuree" : "Non definie"}</span></div>
                    <div><span className="text-muted-foreground">Messages:</span> <span className="font-medium">{agent.totalMessages}</span></div>
                    <div><span className="text-muted-foreground">Langue:</span> <span className="font-medium">{config?.language || "FR"}</span></div>
                    <div><span className="text-muted-foreground">Services:</span> <span className="font-medium">{agent.services?.length || 0}</span></div>
                  </div>

                  {/* Last activity */}
                  {agent.lastActivityAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Derniere activite: {new Date(agent.lastActivityAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}

                  <Separator />

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {agent.elevenAgentId && (
                      <Button size="sm" variant="outline" onClick={() => {
                        setChatDialogAgent(agent);
                        setChatMessages([]);
                        setChatConversationId("");
                      }}>
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5" />Tester
                      </Button>
                    )}
                    {!agent.elevenAgentId && platformReady && (
                      <Button size="sm" variant="outline" onClick={() => handleConnect(agent)}>
                        <Globe className="w-3.5 h-3.5 mr-1.5" />Connecter
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleToggle(agent)}>
                      {agent.isActive ? <Square className="w-3.5 h-3.5 mr-1.5" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
                      {agent.isActive ? "Desactiver" : "Activer"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfigDialogAgent(agent)}>
                      <Settings className="w-3.5 h-3.5 mr-1.5" />Config
                    </Button>
                    {canManage && (
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => handleDelete(agent)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          DIALOG: CREATE AGENT
          ════════════════════════════════════════════════════════ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvel Agent Vocal IA</DialogTitle>
            <DialogDescription>L'agent sera automatiquement connecte et pret pour WhatsApp</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom de l'agent *</Label>
              <Input
                placeholder="Ex: Assistant Restaurant Le Paradis"
                value={createForm.name}
                onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Type de business</Label>
              <Select value={createForm.businessType} onValueChange={(v) => setCreateForm((p) => ({ ...p, businessType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BUSINESS_TYPES).map(([k, bt]) => (
                    <SelectItem key={k} value={k}>{bt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Voix (optionnel)</Label>
              <Select value={createForm.voiceId} onValueChange={(v) => setCreateForm((p) => ({ ...p, voiceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Voix par defaut (Rachel)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Par defaut (Rachel)</SelectItem>
                  {voices.filter((v) => v.category === "cloned" || ("labels" in v && Array.isArray((v as Record<string, unknown>).labels) && ((v as Record<string, unknown>).labels as string[]).some((l: string) => ["francophone", "french", "multilingual"].includes(l)))).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name} ({v.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating || !createForm.name.trim()}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Creer l'Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          DIALOG: CONFIG AGENT
          ════════════════════════════════════════════════════════ */}
      <Dialog open={!!configDialogAgent} onOpenChange={() => setConfigDialogAgent(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {configDialogAgent && (
            <>
              <DialogHeader>
                <DialogTitle>Configuration: {configDialogAgent.name}</DialogTitle>
                <DialogDescription>ElevenLabs Agent ID: {configDialogAgent.elevenAgentId || "Non connecte"}</DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="infos">
                <TabsList className="w-full">
                  <TabsTrigger value="infos" className="flex-1">Informations</TabsTrigger>
                  <TabsTrigger value="services" className="flex-1">Services ({configDialogAgent.services?.length || 0})</TabsTrigger>
                  {isSystemAdmin && <TabsTrigger value="ai" className="flex-1">IA</TabsTrigger>}
                </TabsList>
                <TabsContent value="infos" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Adresse</Label>
                      <Input defaultValue={configDialogAgent.address || ""} placeholder="Adresse de l'entreprise" />
                    </div>
                    <div className="space-y-2">
                      <Label>Telephone</Label>
                      <Input defaultValue={configDialogAgent.phone || ""} placeholder="+237 6XX XXX XXX" />
                    </div>
                    <div className="space-y-2">
                      <Label>Devise</Label>
                      <Input defaultValue={configDialogAgent.currency || "XAF"} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mode de paiement</Label>
                      <Input defaultValue={configDialogAgent.paymentMethod || ""} placeholder="orange_money, mtn_money, cash" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Message d'accueil</Label>
                    <Textarea
                      defaultValue={configDialogAgent.welcomeMessage || ""}
                      rows={3}
                      placeholder="Message d'accueil de l'agent..."
                    />
                  </div>
                </TabsContent>
                <TabsContent value="services" className="mt-4">
                  {configDialogAgent.services && configDialogAgent.services.length > 0 ? (
                    <div className="space-y-2">
                      {configDialogAgent.services.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <p className="font-medium text-sm">{s.name}</p>
                            {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{Number(s.price).toLocaleString("fr-FR")} {configDialogAgent.currency}</p>
                            {s.duration && <p className="text-[11px] text-muted-foreground">{s.duration} min</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucun service configure</p>
                  )}
                </TabsContent>
                {isSystemAdmin && (
                  <TabsContent value="ai" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>ElevenLabs Agent ID</Label>
                      <Input defaultValue={configDialogAgent.elevenAgentId || ""} readOnly className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>Webhook Secret</Label>
                      <Input defaultValue={configDialogAgent.webhookSecret || ""} type="password" readOnly className="bg-muted" />
                    </div>
                    <div className="rounded-lg bg-muted p-4 text-xs space-y-1">
                      <p><strong>Model:</strong> {configDialogAgent.agentConfig ? JSON.parse(configDialogAgent.agentConfig).model : "N/A"}</p>
                      <p><strong>Langue:</strong> {configDialogAgent.agentConfig ? JSON.parse(configDialogAgent.agentConfig).language : "N/A"}</p>
                      <p><strong>Temperature:</strong> {configDialogAgent.agentConfig ? JSON.parse(configDialogAgent.agentConfig).temperature : "N/A"}</p>
                    </div>
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════════════════════════════════════════
          DIALOG: CHAT TEST
          ════════════════════════════════════════════════════════ */}
      <Dialog open={!!chatDialogAgent} onOpenChange={() => setChatDialogAgent(null)}>
        <DialogContent className="sm:max-w-lg">
          {chatDialogAgent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-violet-500" />
                  Test: {chatDialogAgent.name}
                </DialogTitle>
                <DialogDescription>Testez la conversation avec votre agent ElevenLabs</DialogDescription>
              </DialogHeader>
              {/* Chat area */}
              <div className="border rounded-lg h-80 overflow-hidden flex flex-col">
                <ScrollArea className="flex-1 p-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Envoyez un message pour tester votre agent.
                    </div>
                  )}
                  <div className="space-y-3">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-violet-600 text-white" : "bg-muted"}`}>
                          {msg.content}
                          {msg.audioUrl && (
                            <div className="mt-2">
                              <audio src={msg.audioUrl} controls className="h-8 w-full" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                {/* Input */}
                <div className="border-t p-3 flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
                    placeholder="Votre message..."
                    disabled={chatLoading}
                    className="flex-1"
                  />
                  <Button size="icon" onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
