"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  Plus,
  MessageSquare,
  Clock,
  RotateCcw,
  Calendar,
  Trash2,
  Edit2,
  Power,
} from "lucide-react";

interface Automation {
  id: string;
  name: string;
  type: string;
  trigger: string;
  messageTemplate: string;
  isActive: boolean;
  delayMinutes: number;
  createdAt: string;
}

export default function AutomationsPage() {
  const { token } = useAppStore();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", type: "welcome", messageTemplate: "", delayMinutes: "0" });

  const fetchAutomations = useCallback(() => {
    if (!token) return;
    fetch("/api/automations", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setAutomations(d.automations || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  const handleAdd = async () => {
    if (!token || !form.name || !form.messageTemplate) return;
    await fetch("/api/automations", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, delayMinutes: parseInt(form.delayMinutes) || 0 }),
    });
    setShowAdd(false);
    setForm({ name: "", type: "welcome", messageTemplate: "", delayMinutes: "0" });
    fetchAutomations();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    if (!token) return;
    await fetch("/api/automations", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchAutomations();
  };

  const deleteAutomation = async (id: string) => {
    if (!token) return;
    await fetch(`/api/automations?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchAutomations();
  };

  const typeIcons: Record<string, React.ElementType> = {
    welcome: MessageSquare,
    abandoned_order: Clock,
    reactivation: RotateCcw,
    scheduled: Calendar,
  };
  const typeLabels: Record<string, string> = {
    welcome: "Message de bienvenue",
    abandoned_order: "Commande abandonnée",
    reactivation: "Réactivation",
    scheduled: "Message programmé",
  };
  const typeColors: Record<string, string> = {
    welcome: "bg-green-50 text-green-600 border-green-100",
    abandoned_order: "bg-orange-50 text-orange-600 border-orange-100",
    reactivation: "bg-blue-50 text-blue-600 border-blue-100",
    scheduled: "bg-purple-50 text-purple-600 border-purple-100",
  };

  return (
    <>
      <Header title="Automatisations" subtitle="Configurez vos workflows automatiques">
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-1" />Nouvelle automation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer une automation</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nom</Label><Input placeholder="Ex: Message de bienvenue" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Message (utilisez {`{contact_name}`}, {`{company_name}`})</Label>
                <Textarea placeholder="Bonjour {contact_name}, bienvenue chez {company_name} !" value={form.messageTemplate} onChange={(e) => setForm({ ...form, messageTemplate: e.target.value })} rows={4} />
              </div>
              <div><Label>Délai (minutes)</Label><Input type="number" value={form.delayMinutes} onChange={(e) => setForm({ ...form, delayMinutes: e.target.value })} /></div>
              <Button className="w-full bg-primary" onClick={handleAdd}>Créer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </Header>

      <div className="p-6 animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm"><CardContent className="p-6 h-40 animate-pulse bg-muted rounded-xl" /></Card>
              ))
            : automations.map((auto) => {
                const Icon = typeIcons[auto.type] || Zap;
                return (
                  <Card key={auto.id} className={`border ${typeColors[auto.type] || "border-border"} ${!auto.isActive ? "opacity-60" : ""}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeColors[auto.type]?.split(" ")[0]}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{auto.name}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">{typeLabels[auto.type]}</Badge>
                          </div>
                        </div>
                        <Switch checked={auto.isActive} onCheckedChange={() => toggleActive(auto.id, auto.isActive)} />
                      </div>
                      <div className="bg-white/80 rounded-lg p-3 mb-4 border border-border">
                        <p className="text-sm text-foreground leading-relaxed line-clamp-2">{auto.messageTemplate}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {auto.delayMinutes > 0 ? `Délai: ${auto.delayMinutes} min` : "Immédiat"}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Edit2 className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => deleteAutomation(auto.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </div>
    </>
  );
}