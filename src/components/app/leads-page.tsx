"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Target,
  UserPlus,
  Phone,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Lead {
  id: string;
  status: string;
  value: number;
  notes?: string;
  createdAt: string;
  contact?: { name: string; phone: string; avatar?: string };
  assignedTo?: { name: string; avatar?: string };
}

export default function LeadsPage() {
  const { token } = useAppStore();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchLeads = useCallback(() => {
    if (!token) return;
    const params = statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
    fetch(`/api/leads${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setLeads(d.leads || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleStatus = async (leadId: string, status: string) => {
    if (!token) return;
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, status }),
    });
    fetchLeads();
  };

  const formatXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

  const statusCfg: Record<string, { label: string; color: string }> = {
    new: { label: "Nouveau", color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
    contacted: { label: "Contacté", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400" },
    qualified: { label: "Qualifié", color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
    converted: { label: "Converti", color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
    lost: { label: "Perdu", color: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
  };

  const totalValue = leads.reduce((s, l) => s + l.value, 0);

  return (
    <>
      <Header title="Leads" subtitle="Pipeline de ventes" />

      <div className="p-6 animate-fade-in">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total leads", value: leads.length, icon: Target, color: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400" },
            { label: "Valeur du pipeline", value: formatXAF(totalValue), icon: DollarSign, color: "bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400" },
            { label: "Qualifiés", value: leads.filter((l) => l.status === "qualified").length, icon: ArrowUpRight, color: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400" },
            { label: "Convertis", value: leads.filter((l) => l.status === "converted").length, icon: UserPlus, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
          ].map((kpi) => (
            <Card key={kpi.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {["all", "new", "contacted", "qualified", "converted", "lost"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              className={`text-xs ${statusFilter === s ? "bg-primary" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Tous" : statusCfg[s]?.label}
            </Button>
          ))}
        </div>

        {/* Leads List */}
        <div className="space-y-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
              ))
            : leads.map((lead) => (
                <Card key={lead.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-purple-50 text-purple-600 text-xs font-semibold">
                            {lead.contact?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground">{lead.contact?.name || "Inconnu"}</p>
                            <Badge className={`text-[10px] ${statusCfg[lead.status]?.color}`}>
                              {statusCfg[lead.status]?.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {lead.contact?.phone && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />{lead.contact.phone}
                              </span>
                            )}
                            {lead.assignedTo && (
                              <span className="text-[11px] text-muted-foreground">
                                Assigné: {lead.assignedTo.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">{formatXAF(lead.value)}</p>
                          <p className="text-[10px] text-muted-foreground">Valeur estimée</p>
                        </div>
                        {lead.status !== "converted" && lead.status !== "lost" && (
                          <Select onValueChange={(v) => handleStatus(lead.id, v)}>
                            <SelectTrigger className="h-8 w-32 text-xs">
                              <SelectValue placeholder="Avancer..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusCfg).filter(([k]) => k !== "all").map(([key, val]) => (
                                <SelectItem key={key} value={key}>{val.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </>
  );
}