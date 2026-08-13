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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  Phone,
  Car,
  Bike,
  MapPin,
  Star,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MoreVertical,
  Search,
  Users,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string | null;
  telegramId: string | null;
  status: string;
  rating: number | null;
  _count?: { deliveries: number };
}

const VEHICLE_TYPES = [
  { value: "moto", label: "Moto" },
  { value: "voiture", label: "Voiture" },
  { value: "vélo", label: "Vélo" },
  { value: "à pied", label: "À pied" },
];

const vehicleIcon: Record<string, React.ElementType> = {
  moto: Bike,
  voiture: Car,
  vélo: Bike,
  "à pied": MapPin,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  available: {
    label: "Disponible",
    color: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    icon: CheckCircle,
  },
  busy: {
    label: "En course",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
    icon: Clock,
  },
  offline: {
    label: "Hors ligne",
    color: "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-400",
    icon: XCircle,
  },
};

// ─── Component ───────────────────────────────────────────────────

export default function DriversPage() {
  const { token } = useAppStore();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formVehicleType, setFormVehicleType] = useState("");
  const [formVehiclePlate, setFormVehiclePlate] = useState("");
  const [formTelegramId, setFormTelegramId] = useState("");

  const fetchDrivers = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/drivers", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setDrivers(Array.isArray(d.drivers) ? d.drivers : Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // ── Stats ──
  const stats = {
    total: drivers.length,
    available: drivers.filter((d) => d.status === "available").length,
    busy: drivers.filter((d) => d.status === "busy").length,
    offline: drivers.filter((d) => d.status === "offline").length,
  };

  // ── Filters ──
  const filtered = drivers.filter((d) => {
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search) ||
      (d.vehiclePlate || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Dialog helpers ──
  const openAdd = () => {
    setEditingDriver(null);
    setFormName("");
    setFormPhone("");
    setFormVehicleType("");
    setFormVehiclePlate("");
    setFormTelegramId("");
    setDialogOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormName(driver.name);
    setFormPhone(driver.phone);
    setFormVehicleType(driver.vehicleType);
    setFormVehiclePlate(driver.vehiclePlate || "");
    setFormTelegramId(driver.telegramId || "");
    setDialogOpen(true);
  };

  // ── Save (create or update) ──
  const handleSave = async () => {
    if (!token || !formName.trim() || !formPhone.trim() || !formVehicleType) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        phone: formPhone.trim(),
        vehicleType: formVehicleType,
        vehiclePlate: formVehiclePlate.trim() || null,
        telegramId: formTelegramId.trim() || null,
      };

      if (editingDriver) {
        // Update
        await fetch(`/api/drivers/${editingDriver.id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast.success("Livreur mis à jour avec succès");
      } else {
        // Create
        await fetch("/api/drivers", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        toast.success("Livreur ajouté avec succès");
      }
      setDialogOpen(false);
      fetchDrivers();
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeleting(id);
    try {
      await fetch(`/api/drivers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Livreur supprimé");
      fetchDrivers();
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(null);
    }
  };

  // ── Toggle availability ──
  const handleToggle = async (driver: Driver) => {
    if (!token) return;
    const newStatus = driver.status === "available" ? "offline" : "available";
    try {
      await fetch(`/api/drivers/${driver.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success(newStatus === "available" ? "Livreur mis en ligne" : "Livreur mis hors ligne");
      fetchDrivers();
    } catch {
      toast.error("Erreur lors du changement de statut");
    }
  };

  return (
    <>
      <Header title="Livreurs" subtitle={`${drivers.length} livreurs enregistrés`}>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-1" />
          Ajouter un livreur
        </Button>
      </Header>

      <div className="p-6 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total livreurs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/15 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.available}</p>
                  <p className="text-xs text-muted-foreground">Disponibles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-500/15 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.busy}</p>
                  <p className="text-xs text-muted-foreground">En course</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-500/15 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.offline}</p>
                  <p className="text-xs text-muted-foreground">Hors ligne</p>
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
              placeholder="Rechercher par nom, téléphone, plaque..."
              className="pl-9 bg-muted border-0"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1">
            {["all", "available", "busy", "offline"].map((s) => {
              const cfg = statusConfig[s];
              return (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "ghost"}
                  size="sm"
                  className={`text-xs h-8 ${statusFilter === s ? "bg-primary" : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "Tous" : cfg?.label}
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
            <Bike className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun livreur trouvé</p>
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Véhicule</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-center">Livraisons</TableHead>
                      <TableHead className="text-center">Note</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((driver) => {
                      const cfg = statusConfig[driver.status] || statusConfig.offline;
                      const StatusIcon = cfg.icon;
                      const VehicleIcon = vehicleIcon[driver.vehicleType] || Bike;
                      const vLabel = VEHICLE_TYPES.find((v) => v.value === driver.vehicleType)?.label || driver.vehicleType;

                      return (
                        <TableRow key={driver.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-foreground">{driver.name}</p>
                                {driver.telegramId && (
                                  <p className="text-[11px] text-muted-foreground">@{driver.telegramId}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                              {driver.phone}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <VehicleIcon className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm">{vLabel}</p>
                                {driver.vehiclePlate && (
                                  <p className="text-[11px] text-muted-foreground">{driver.vehiclePlate}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm font-medium">{driver._count?.deliveries || 0}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-medium">
                                {driver.rating ? driver.rating.toFixed(1) : "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleToggle(driver)}
                                title={driver.status === "available" ? "Mettre hors ligne" : "Mettre en ligne"}
                              >
                                {driver.status === "available" || driver.status === "busy" ? (
                                  <ToggleRight className="w-4 h-4 text-green-500" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                )}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(driver)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600 dark:text-red-400"
                                    onClick={() => handleDelete(driver.id)}
                                  >
                                    {deleting === driver.id ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4 mr-2" />
                                    )}
                                    Supprimer
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDriver ? "Modifier le livreur" : "Ajouter un livreur"}</DialogTitle>
              <DialogDescription>
                {editingDriver
                  ? "Modifiez les informations du livreur."
                  : "Remplissez les informations du nouveau livreur."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="driver-name">Nom *</Label>
                <Input
                  id="driver-name"
                  placeholder="Nom complet"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-phone">Téléphone *</Label>
                <Input
                  id="driver-phone"
                  placeholder="+237 6XX XXX XXX"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-vehicle">Type de véhicule *</Label>
                <Select value={formVehicleType} onValueChange={setFormVehicleType}>
                  <SelectTrigger id="driver-vehicle">
                    <SelectValue placeholder="Sélectionner un véhicule" />
                  </SelectTrigger>
                  <SelectContent>
                    {VEHICLE_TYPES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-plate">Plaque d'immatriculation</Label>
                <Input
                  id="driver-plate"
                  placeholder="LT-123-AB"
                  value={formVehiclePlate}
                  onChange={(e) => setFormVehiclePlate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-telegram">Identifiant Telegram</Label>
                <Input
                  id="driver-telegram"
                  placeholder="@username"
                  value={formTelegramId}
                  onChange={(e) => setFormTelegramId(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingDriver ? "Mettre à jour" : "Ajouter"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
