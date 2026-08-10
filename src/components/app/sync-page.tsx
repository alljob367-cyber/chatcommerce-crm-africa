"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Package,
  Bot,
  Loader2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  sku?: string | null;
  stock: number;
  isActive: boolean;
  category?: { id: string; name: string } | null;
}

interface BusinessService {
  id: string;
  agentId: string;
  name: string;
  description?: string | null;
  price: number;
  duration?: number | null;
  image?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface TelegramAgent {
  id: string;
  name: string;
  botUsername?: string | null;
  businessType: string;
  isActive: boolean;
  _count?: { services: number; bookings: number };
}

interface SyncResult {
  synced: number;
  created: number;
  updated: number;
  skipped?: number;
  message?: string;
}

type SyncStatus = "idle" | "new" | "update" | "synced";

// ── Helper ───────────────────────────────────

const formatXAF = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

// ── Component ────────────────────────────────

export default function SyncPage() {
  const { token } = useAppStore();

  // Data
  const [agents, setAgents] = useState<TelegramAgent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<BusinessService[]>([]);

  // Selections
  const [leftAgentId, setLeftAgentId] = useState<string>("");
  const [rightAgentId, setRightAgentId] = useState<string>("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(
    new Set()
  );

  // UI State
  const [loading, setLoading] = useState(true);
  const [syncingLeft, setSyncingLeft] = useState(false);
  const [syncingRight, setSyncingRight] = useState(false);
  const [leftResult, setLeftResult] = useState<SyncResult | null>(null);
  const [rightResult, setRightResult] = useState<SyncResult | null>(null);
  const [productStatuses, setProductStatuses] = useState<
    Record<string, SyncStatus>
  >({});
  const [serviceStatuses, setServiceStatuses] = useState<
    Record<string, SyncStatus>
  >({});

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // ── Fetch agents and products on mount ─────
  const fetchBaseData = useCallback(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch("/api/telegram/agents", { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
        r.json()
      ),
      fetch("/api/products", { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
        r.json()
      ),
    ])
      .then(([agentsData, productsData]) => {
        setAgents(agentsData.agents || []);
        setProducts(productsData.products || []);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Erreur lors du chargement des données");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  // ── Fetch services when right agent changes ─
  const fetchServices = useCallback(
    (agentId: string) => {
      if (!token || !agentId) {
        setServices([]);
        return;
      }
      fetch(`/api/telegram/agents/${agentId}/services`, {
        headers: { Authorization: `Bearer ${token}` } ,
      })
        .then((r) => r.json())
        .then((data) => {
          setServices(data.services || []);
        })
        .catch(() => {
          toast.error("Erreur lors du chargement des services");
          setServices([]);
        });
    },
    [token]
  );

  // When left agent changes, compute product sync statuses
  useEffect(() => {
    if (!leftAgentId) {
      setProductStatuses({});
      return;
    }
    fetch(`/api/telegram/agents/${leftAgentId}/services`, {
      headers: { Authorization: `Bearer ${token}` } ,
    })
      .then((r) => r.json())
      .then((data) => {
        const agentServices: BusinessService[] = data.services || [];
        const serviceMap = new Map(
          agentServices.map((s) => [s.name.toLowerCase(), s])
        );

        const statuses: Record<string, SyncStatus> = {};
        for (const p of products) {
          const match = serviceMap.get(p.name.toLowerCase());
          if (!match) {
            statuses[p.id] = "new";
          } else if (
            match.price !== p.price ||
            match.description !== p.description
          ) {
            statuses[p.id] = "update";
          } else {
            statuses[p.id] = "synced";
          }
        }
        setProductStatuses(statuses);
      })
      .catch(() => {
        setProductStatuses({});
      });
  }, [leftAgentId, products, token]);

  // When right agent changes, fetch services + compute service sync statuses
  useEffect(() => {
    fetchServices(rightAgentId);
  }, [rightAgentId, fetchServices]);

  useEffect(() => {
    if (!rightAgentId || services.length === 0 || products.length === 0) {
      setServiceStatuses({});
      return;
    }
    const productMap = new Map(
      products.map((p) => [p.name.toLowerCase(), p])
    );

    const statuses: Record<string, SyncStatus> = {};
    for (const s of services) {
      const match = productMap.get(s.name.toLowerCase());
      if (!match) {
        statuses[s.id] = "new";
      } else if (
        match.price !== s.price ||
        match.description !== s.description
      ) {
        statuses[s.id] = "update";
      } else {
        statuses[s.id] = "synced";
      }
    }
    setServiceStatuses(statuses);
  }, [rightAgentId, services, products]);

  // ── Select / Deselect helpers ───────────────

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllProducts = () => {
    if (selectedProductIds.size === products.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(products.map((p) => p.id)));
    }
  };

  const selectAllServices = () => {
    if (selectedServiceIds.size === services.length) {
      setSelectedServiceIds(new Set());
    } else {
      setSelectedServiceIds(new Set(services.map((s) => s.id)));
    }
  };

  // ── Sync actions ────────────────────────────

  const handleSyncProductsToServices = async () => {
    if (!leftAgentId) {
      toast.error("Veuillez sélectionner un agent Telegram");
      return;
    }
    const ids =
      selectedProductIds.size > 0
        ? Array.from(selectedProductIds)
        : [];

    setSyncingLeft(true);
    setLeftResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "products_to_services",
          agentId: leftAgentId,
          productIds: ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de synchronisation");
      setLeftResult(data);
      toast.success(
        `Synchronisation réussie : ${data.created} créés, ${data.updated} mis à jour`
      );
      // Refresh product statuses
      const agentId = leftAgentId;
      setLeftAgentId("");
      setTimeout(() => setLeftAgentId(agentId), 50);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSyncingLeft(false);
    }
  };

  const handleSyncServicesToProducts = async () => {
    if (!rightAgentId) {
      toast.error("Veuillez sélectionner un agent Telegram");
      return;
    }
    const ids =
      selectedServiceIds.size > 0
        ? Array.from(selectedServiceIds)
        : [];

    setSyncingRight(true);
    setRightResult(null);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "services_to_products",
          agentId: rightAgentId,
          serviceIds: ids,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de synchronisation");
      setRightResult(data);
      toast.success(
        `Import réussi : ${data.created} créés, ${data.updated} mis à jour`
      );
      // Refresh products
      fetchBaseData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSyncingRight(false);
    }
  };

  // ── Status badge helpers ───────────────────

  const statusBadge = (status: SyncStatus) => {
    switch (status) {
      case "new":
        return (
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
            <Plus className="w-2.5 h-2.5 mr-1" />
            nouveau
          </Badge>
        );
      case "update":
        return (
          <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            <RefreshCw className="w-2.5 h-2.5 mr-1" />
            mise à jour
          </Badge>
        );
      case "synced":
        return (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
            <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
            déjà synchronisé
          </Badge>
        );
      default:
        return null;
    }
  };

  // ── Loading skeleton ───────────────────────

  if (loading) {
    return (
      <>
        <Header title="Synchronisation" subtitle="Produits ↔ Agents Telegram" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-16 w-full" />
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Synchronisation" subtitle="Produits ↔ Agents Telegram" />
      <div className="p-6 animate-fade-in space-y-6">
        {/* Info banner */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <ArrowLeftRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Synchronisez votre catalogue de produits avec les menus de vos agents Telegram
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Envoyez vos produits vers un agent ou importez les services d'un agent dans votre catalogue.
                La correspondance se fait par nom de produit.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── LEFT: Products → Telegram ── */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Produits → Agent Telegram
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Envoyer les produits vers le menu d'un agent
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agent selector */}
              <Select
                value={leftAgentId}
                onValueChange={(v) => {
                  setLeftAgentId(v);
                  setLeftResult(null);
                  setSelectedProductIds(new Set());
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un agent Telegram" />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      Aucun agent configuré
                    </div>
                  ) : (
                    agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{a.name}</span>
                          {a._count && (
                            <span className="text-[10px] text-muted-foreground">
                              ({a._count.services} services)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Select all */}
              {products.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selectedProductIds.size > 0
                      ? `${selectedProductIds.size} produit(s) sélectionné(s)`
                      : `${products.length} produit(s) disponible(s)`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={selectAllProducts}
                  >
                    {selectedProductIds.size === products.length
                      ? "Tout désélectionner"
                      : "Tout sélectionner"}
                  </Button>
                </div>
              )}

              {/* Product list */}
              <ScrollArea className="max-h-96">
                <div className="space-y-2 pr-3">
                  {products.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aucun produit dans le catalogue
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Créez des produits depuis la page Produits
                      </p>
                    </div>
                  ) : (
                    products.map((p) => (
                      <div
                        key={p.id}
                        className={
                          "flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                        }
                        onClick={() => toggleProduct(p.id)}
                      >
                        <Checkbox
                          checked={selectedProductIds.has(p.id)}
                          onCheckedChange={() => toggleProduct(p.id)}
                          className="shrink-0"
                        />
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {p.image ? (
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {p.name}
                          </p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            {formatXAF(p.price)}
                          </p>
                        </div>
                        {leftAgentId && statusBadge(productStatuses[p.id])}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Sync button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleSyncProductsToServices}
                disabled={
                  syncingLeft ||
                  !leftAgentId ||
                  products.length === 0
                }
              >
                {syncingLeft ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Synchronisation...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Synchroniser vers l'agent
                  </>
                )}
              </Button>

              {/* Result summary */}
              {leftResult && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {leftResult.created} créés, {leftResult.updated} mis à jour
                    {leftResult.skipped !== undefined &&
                      `, ${leftResult.skipped} ignorés`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── RIGHT: Telegram → Products ── */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                  <ArrowLeft className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    Agent Telegram → Produits
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Importer les services d'un agent dans le catalogue
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Agent selector */}
              <Select
                value={rightAgentId}
                onValueChange={(v) => {
                  setRightAgentId(v);
                  setRightResult(null);
                  setSelectedServiceIds(new Set());
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner un agent Telegram" />
                </SelectTrigger>
                <SelectContent>
                  {agents.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      Aucun agent configuré
                    </div>
                  ) : (
                    agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{a.name}</span>
                          {a._count && (
                            <span className="text-[10px] text-muted-foreground">
                              ({a._count.services} services)
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Select all */}
              {services.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {selectedServiceIds.size > 0
                      ? `${selectedServiceIds.size} service(s) sélectionné(s)`
                      : `${services.length} service(s) disponible(s)`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={selectAllServices}
                  >
                    {selectedServiceIds.size === services.length
                      ? "Tout désélectionner"
                      : "Tout sélectionner"}
                  </Button>
                </div>
              )}

              {/* Service list */}
              <ScrollArea className="max-h-96">
                <div className="space-y-2 pr-3">
                  {rightAgentId && services.length === 0 ? (
                    <div className="text-center py-8">
                      <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aucun service pour cet agent
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Ajoutez des services depuis la page Agents Telegram
                      </p>
                    </div>
                  ) : !rightAgentId ? (
                    <div className="text-center py-8">
                      <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Sélectionnez un agent pour voir ses services
                      </p>
                    </div>
                  ) : (
                    services.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => toggleService(s.id)}
                      >
                        <Checkbox
                          checked={selectedServiceIds.has(s.id)}
                          onCheckedChange={() => toggleService(s.id)}
                          className="shrink-0"
                        />
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                          {s.image ? (
                            <img
                              src={s.image}
                              alt={s.name}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          ) : (
                            <Bot className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {s.name}
                          </p>
                          <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold">
                            {formatXAF(s.price)}
                            {s.duration && (
                              <span className="text-muted-foreground font-normal ml-1.5">
                                · {s.duration} min
                              </span>
                            )}
                          </p>
                        </div>
                        {statusBadge(serviceStatuses[s.id])}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Import button */}
              <Button
                className="w-full bg-primary hover:bg-primary/90"
                onClick={handleSyncServicesToProducts}
                disabled={
                  syncingRight ||
                  !rightAgentId ||
                  services.length === 0
                }
              >
                {syncingRight ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Import en cours...
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Importer dans le catalogue
                  </>
                )}
              </Button>

              {/* Result summary */}
              {rightResult && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-teal-500/10 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="text-teal-700 dark:text-teal-300">
                    {rightResult.created} créés, {rightResult.updated} mis à
                    jour
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
