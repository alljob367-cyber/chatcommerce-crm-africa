"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Truck,
  Plus,
  Search,
  Clock,
  Loader2,
  XCircle,
  CheckCircle,
  MapPin,
  UserCheck,
  Navigation,
  Package,
  AlertCircle,
  PackageCheck,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencies";

// ─── Types ───────────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  status: string;
  rating: number | null;
}

interface Delivery {
  id: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  deliveryAddress: string;
  status: string;
  fee: number;
  currency: string;
  driverId: string | null;
  driver: { name: string } | null;
  createdAt: string;
  updatedAt: string;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
}

interface DeliveryStats {
  pending: number;
  searching: number;
  assigned: number;
  picked_up: number;
  on_the_way: number;
  delivered: number;
  cancelled: number;
}

// ─── Status Config ───────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: {
    label: "En attente",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-500/15 dark:text-gray-400",
    icon: Clock,
  },
  searching: {
    label: "En recherche",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    icon: Search,
  },
  assigned: {
    label: "Assignée",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400",
    icon: UserCheck,
  },
  picked_up: {
    label: "Récupérée",
    color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
    icon: Package,
  },
  on_the_way: {
    label: "En route",
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
    icon: Navigation,
  },
  delivered: {
    label: "Livrée",
    color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    icon: PackageCheck,
  },
  cancelled: {
    label: "Annulée",
    color: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
    icon: XCircle,
  },
};

// ─── Status transitions ──────────────────────────────────────────

const statusTransitions: Record<string, Array<{ label: string; nextStatus: string }>> = {
  pending: [
    { label: "Rechercher chauffeur", nextStatus: "searching" },
    { label: "Annuler", nextStatus: "cancelled" },
  ],
  searching: [{ label: "Annuler", nextStatus: "cancelled" }],
  assigned: [{ label: "Annuler", nextStatus: "cancelled" }],
  picked_up: [{ label: "En route", nextStatus: "on_the_way" }],
  on_the_way: [{ label: "Livrée", nextStatus: "delivered" }],
};

// ─── Component ───────────────────────────────────────────────────

export default function DeliveriesPage() {
  const { token } = useAppStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formCustomer, setFormCustomer] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPickup, setFormPickup] = useState("");
  const [formDelivery, setFormDelivery] = useState("");
  const [formFee, setFormFee] = useState("");
  const [formCurrency, setFormCurrency] = useState("XAF");

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDelivery, setAssignDelivery] = useState<Delivery | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchDeliveries = useCallback(() => {
    if (!token) return;
    setLoading(true);
    const params = statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
    fetch(`/api/deliveries${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDeliveries(d.deliveries || d || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  const fetchStats = useCallback(() => {
    if (!token) return;
    fetch("/api/deliveries/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    fetchDeliveries();
    fetchStats();
  }, [fetchDeliveries, fetchStats]);

  // ── Filters ──
  const filtered = deliveries.filter((d) => {
    const matchSearch =
      !search ||
      d.customerName.toLowerCase().includes(search.toLowerCase()) ||
      d.customerPhone.includes(search) ||
      d.pickupAddress.toLowerCase().includes(search.toLowerCase()) ||
      d.deliveryAddress.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // ── Status transition handler ──
  const handleTransition = async (delivery: Delivery, nextStatus: string) => {
    if (!token) return;
    try {
      if (nextStatus === "searching") {
        // Search for available drivers and open assign dialog
        const driversRes = await fetch("/api/drivers?status=available", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const driversData = await driversRes.json();
        const driverList = driversData.drivers || driversData || [];
        setAvailableDrivers(driverList);
        setAssignDelivery(delivery);
        setAssignOpen(true);
        return;
      }

      await fetch(`/api/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      toast.success(`Statut mis à jour : ${statusConfig[nextStatus]?.label}`);
      fetchDeliveries();
      fetchStats();
    } catch {
      toast.error("Erreur lors de la mise à jour du statut");
    }
  };

  // ── Assign driver ──
  const handleAssignDriver = async (driverId: string) => {
    if (!token || !assignDelivery) return;
    setAssigning(true);
    try {
      await fetch(`/api/deliveries/${assignDelivery.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "assigned", driverId }),
      });
      toast.success("Livreur assigné avec succès");
      setAssignOpen(false);
      setAssignDelivery(null);
      fetchDeliveries();
      fetchStats();
    } catch {
      toast.error("Erreur lors de l'affectation du livreur");
    } finally {
      setAssigning(false);
    }
  };

  // ── Create delivery ──
  const handleCreate = async () => {
    if (!token || !formCustomer.trim() || !formPickup.trim() || !formDelivery.trim()) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setCreating(true);
    try {
      const body = {
        customerName: formCustomer.trim(),
        customerPhone: formPhone.trim() || null,
        pickupAddress: formPickup.trim(),
        deliveryAddress: formDelivery.trim(),
        fee: formFee ? parseFloat(formFee) : 0,
        currency: formCurrency,
      };
      await fetch("/api/deliveries", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      toast.success("Livraison créée avec succès");
      setCreateOpen(false);
      setFormCustomer("");
      setFormPhone("");
      setFormPickup("");
      setFormDelivery("");
      setFormFee("");
      fetchDeliveries();
      fetchStats();
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setCreating(false);
    }
  };

  // ── Duration helper ──
  const getDuration = (delivery: Delivery) => {
    if (delivery.deliveredAt && delivery.createdAt) {
      const ms = new Date(delivery.deliveredAt).getTime() - new Date(delivery.createdAt).getTime();
      const mins = Math.round(ms / 60000);
      if (mins < 60) return `${mins} min`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}min`;
    }
    if (delivery.pickedUpAt) {
      const ms = Date.now() - new Date(delivery.pickedUpAt).getTime();
      const mins = Math.round(ms / 60000);
      if (mins < 60) return `${mins} min`;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h ${m}min`;
    }
    const ms = Date.now() - new Date(delivery.createdAt).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}min`;
  };

  // ── Stat cards ──
  const statCards = [
    { key: "pending" as const, icon: Clock, color: "bg-gray-100 dark:bg-gray-500/15", iconColor: "text-gray-600 dark:text-gray-400" },
    { key: "searching" as const, icon: Search, color: "bg-blue-100 dark:bg-blue-500/15", iconColor: "text-blue-600 dark:text-blue-400" },
    { key: "assigned" as const, icon: UserCheck, color: "bg-purple-100 dark:bg-purple-500/15", iconColor: "text-purple-600 dark:text-purple-400" },
    { key: "picked_up" as const, icon: Package, color: "bg-orange-100 dark:bg-orange-500/15", iconColor: "text-orange-600 dark:text-orange-400" },
    { key: "on_the_way" as const, icon: Navigation, color: "bg-cyan-100 dark:bg-cyan-500/15", iconColor: "text-cyan-600 dark:text-cyan-400" },
    { key: "delivered" as const, icon: PackageCheck, color: "bg-green-100 dark:bg-green-500/15", iconColor: "text-green-600 dark:text-green-400" },
  ];

  return (
    <>
      <Header title="Livraisons" subtitle={`${deliveries.length} livraisons totales`}>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Nouvelle livraison
        </Button>
      </Header>

      <div className="p-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
          {statCards.map((sc) => {
            const cfg = statusConfig[sc.key];
            const Icon = sc.icon;
            return (
              <Card key={sc.key} className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg ${sc.color} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-4 h-4 ${sc.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{stats?.[sc.key] || 0}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{cfg.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {/* Cancelled stat */}
          <Card className="border-0 shadow-sm col-span-3 md:col-span-1">
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stats?.cancelled || 0}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Annulées</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par client, adresse..."
              className="pl-9 bg-muted border-0"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {[
              "all",
              "pending",
              "searching",
              "assigned",
              "picked_up",
              "on_the_way",
              "delivered",
              "cancelled",
            ].map((s) => {
              const cfg = statusConfig[s];
              return (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "ghost"}
                  size="sm"
                  className={`text-xs h-8 ${statusFilter === s ? "bg-primary" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "Toutes" : cfg?.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune livraison trouvée</p>
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Pickup</TableHead>
                      <TableHead>Livraison</TableHead>
                      <TableHead>Livreur</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Frais</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((delivery, idx) => {
                      const cfg = statusConfig[delivery.status] || statusConfig.pending;
                      const StatusIcon = cfg.icon;
                      const transitions = statusTransitions[delivery.status] || [];

                      return (
                        <TableRow key={delivery.id}>
                          <TableCell className="text-muted-foreground text-xs">
                            {delivery.orderNumber || `${idx + 1}`}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm text-foreground">{delivery.customerName}</p>
                              {delivery.customerPhone && (
                                <p className="text-[11px] text-muted-foreground">{delivery.customerPhone}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-1.5 max-w-[180px]">
                              <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                              <span className="text-xs text-muted-foreground line-clamp-2">
                                {delivery.pickupAddress}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-1.5 max-w-[180px]">
                              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              <span className="text-xs text-muted-foreground line-clamp-2">
                                {delivery.deliveryAddress}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {delivery.driver?.name || (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] whitespace-nowrap ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">
                              {delivery.fee > 0
                                ? formatCurrency(delivery.fee, delivery.currency || "XAF")
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {getDuration(delivery)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {transitions.length > 0 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {transitions.map((t) => (
                                    <DropdownMenuItem
                                      key={t.nextStatus}
                                      onClick={() => handleTransition(delivery, t.nextStatus)}
                                      className={t.nextStatus === "cancelled" ? "text-red-600 dark:text-red-400" : ""}
                                    >
                                      {t.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Delivery Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nouvelle livraison</DialogTitle>
              <DialogDescription>Créez une nouvelle demande de livraison.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="dl-customer">Nom du client *</Label>
                <Input
                  id="dl-customer"
                  placeholder="Nom complet"
                  value={formCustomer}
                  onChange={(e) => setFormCustomer(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dl-phone">Téléphone du client</Label>
                <Input
                  id="dl-phone"
                  placeholder="+237 6XX XXX XXX"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dl-pickup">Adresse de pickup *</Label>
                <Input
                  id="dl-pickup"
                  placeholder="Adresse de récupération"
                  value={formPickup}
                  onChange={(e) => setFormPickup(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dl-delivery">Adresse de livraison *</Label>
                <Input
                  id="dl-delivery"
                  placeholder="Adresse de destination"
                  value={formDelivery}
                  onChange={(e) => setFormDelivery(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dl-fee">Frais de livraison</Label>
                  <Input
                    id="dl-fee"
                    type="number"
                    placeholder="0"
                    value={formFee}
                    onChange={(e) => setFormFee(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dl-currency">Devise</Label>
                  <Select value={formCurrency} onValueChange={setFormCurrency}>
                    <SelectTrigger id="dl-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XAF">FCFA (XAF)</SelectItem>
                      <SelectItem value="XOF">FCFA (XOF)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Driver Dialog */}
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Assigner un livreur</DialogTitle>
              <DialogDescription>
                Sélectionnez un livreur disponible pour cette livraison.
              </DialogDescription>
            </DialogHeader>
            {availableDrivers.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun livreur disponible</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scroll py-2">
                {availableDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleAssignDriver(driver.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                        <UserCheck className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{driver.name}</p>
                        <p className="text-[11px] text-muted-foreground">{driver.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {driver.vehicleType}
                      </Badge>
                      {driver.rating && (
                        <span className="text-xs text-yellow-600 font-medium">
                          ★ {driver.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>
                Annuler
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
