"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Smartphone,
  Building2,
  Receipt,
  Loader2,
  Search,
  Eye,
  Shield,
  Filter,
  Phone,
} from "lucide-react";
import { toast } from "sonner";

interface AdminPayment {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  plan: string;
  status: string;
  transactionRef: string;
  senderPhone: string;
  senderName?: string;
  rejectionReason?: string;
  expiresAt: string;
  confirmedAt?: string;
  createdAt: string;
  company: { name: string; plan: string; country?: string };
  confirmedBy?: { name: string; email: string };
}

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  business: "Business",
  enterprise: "Enterprise",
};

export default function AdminPaymentsPage() {
  const { user, token } = useAppStore();
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<AdminPayment | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<"confirm" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // Payment settings (Mobile Money numbers)
  const [paymentSettings, setPaymentSettings] = useState({
    orange_money: "",
    mtn_money: "",
  });
  const [paymentSettingsLoading, setPaymentSettingsLoading] = useState(true);
  const [paymentSettingsSaving, setPaymentSettingsSaving] = useState(false);
  const [paymentSettingsSaved, setPaymentSettingsSaved] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", page.toString());
      params.set("limit", "50");

      const res = await fetch(`/api/payments/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.payments) {
        setPayments(data.payments);
        setTotal(data.pagination?.total || 0);
      }
    } catch {}
    finally {
      setLoading(false);
    }
  }, [token, statusFilter, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleAction = async () => {
    if (!selectedPayment || !confirmDialog || !token) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId: selectedPayment.id,
          action: confirmDialog,
          rejectionReason: confirmDialog === "reject" ? rejectionReason : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfirmDialog(null);
        setSelectedPayment(null);
        setRejectionReason("");
        fetchPayments();
      }
    } catch {}
    finally {
      setActionLoading(false);
    }
  };

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
      pending: { label: "En attente", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400", icon: Clock },
      confirmed: { label: "Confirme", cls: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400", icon: CheckCircle2 },
      rejected: { label: "Rejete", cls: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400", icon: XCircle },
      expired: { label: "Expire", cls: "bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400", icon: AlertTriangle },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
        <s.icon className="w-3 h-3" />
        {s.label}
      </span>
    );
  };

  // ─── Fetch payment settings (Mobile Money numbers) ───
  const fetchPaymentSettings = useCallback(async () => {
    if (!token) return;
    setPaymentSettingsLoading(true);
    try {
      const res = await fetch("/api/company", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.company?.paymentSettings) {
          setPaymentSettings({
            orange_money: data.company.paymentSettings.orange_money || "",
            mtn_money: data.company.paymentSettings.mtn_money || "",
          });
        }
      }
    } catch { /* ignore */ }
    finally { setPaymentSettingsLoading(false); }
  }, [token]);

  const savePaymentSettings = async () => {
    if (!token) return;
    setPaymentSettingsSaving(true);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentSettings }),
      });
      if (res.ok) {
        toast.success("Numeros de paiement mis a jour");
        setPaymentSettingsSaved(true);
        setTimeout(() => setPaymentSettingsSaved(false), 3000);
      } else {
        toast.error("Erreur lors de la mise a jour");
      }
    } catch { toast.error("Erreur"); }
    finally { setPaymentSettingsSaving(false); }
  };

  useEffect(() => { fetchPaymentSettings(); }, [fetchPaymentSettings]);

  const pendingCount = payments.filter((p) => p.status === "pending").length;

  // Filtrer par recherche
  const filtered = payments.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.reference.toLowerCase().includes(q) ||
      p.transactionRef.toLowerCase().includes(q) ||
      p.senderPhone.includes(q) ||
      (p.senderName || "").toLowerCase().includes(q) ||
      p.company.name.toLowerCase().includes(q)
    );
  });

  const stats = [
    { label: "En attente", value: payments.filter((p) => p.status === "pending").length, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-500/10" },
    { label: "Confirms", value: payments.filter((p) => p.status === "confirmed").length, color: "text-green-600", bg: "bg-green-50 dark:bg-green-500/10" },
    { label: "Rejetes", value: payments.filter((p) => p.status === "rejected").length, color: "text-red-600", bg: "bg-red-50 dark:bg-red-500/10" },
    { label: "Total FCFA", value: formatPrice(payments.filter((p) => p.status === "confirmed").reduce((s, p) => s + p.amount, 0)), color: "text-foreground", bg: "bg-muted" },
  ];

  return (
    <>
      <Header title="Gestion des Paiements" subtitle="Validation des paiements Mobile Money" />

      <div className="p-6 animate-fade-in space-y-6">
        {/* ─── SECTION: Numeros de reception Mobile Money ─── */}
        <Card className="border-2 border-[#25D366]/20">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#25D366]" />
              Numeros de Reception Mobile Money
              {paymentSettingsSaved && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Enregistre
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              Configurez les numeros sur lesquels les commercants envoient leurs paiements d'abonnement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {paymentSettingsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Orange Money */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                      <Smartphone className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                    Orange Money
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Ex: 237 6XX XXX XXX"
                      value={paymentSettings.orange_money}
                      onChange={(e) => setPaymentSettings((s) => ({ ...s, orange_money: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                {/* MTN Mobile Money */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-yellow-100 dark:bg-yellow-500/20 flex items-center justify-center">
                      <Smartphone className="w-3.5 h-3.5 text-yellow-600" />
                    </div>
                    MTN Mobile Money
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Ex: 237 6XX XXX XXX"
                      value={paymentSettings.mtn_money}
                      onChange={(e) => setPaymentSettings((s) => ({ ...s, mtn_money: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
                {/* Save button */}
                <div className="md:col-span-2 flex justify-end">
                  <Button
                    onClick={savePaymentSettings}
                    disabled={paymentSettingsSaving}
                    className="bg-[#25D366] hover:bg-[#25D366]/90 text-white gap-2"
                  >
                    {paymentSettingsSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    Enregistrer les numeros
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className={`p-4 rounded-xl ${s.bg}`}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par reference, transaction, phone, nom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="confirmed">Confirms</SelectItem>
              <SelectItem value="rejected">Rejetes</SelectItem>
              <SelectItem value="expired">Expires</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Liste des paiements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Paiements
              <Badge variant="outline" className="ml-auto">{total} resultats</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucun paiement trouve</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Reference</th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Entreprise</th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Plan</th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Methode</th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">Montant</th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-2 text-xs font-medium text-muted-foreground">Date</th>
                      <th className="text-right py-3 px-2 text-xs font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <p className="font-mono text-xs font-medium text-[#25D366]">{p.reference}</p>
                          <p className="text-xs text-muted-foreground font-mono">{p.transactionRef}</p>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-foreground">{p.company.name}</p>
                              <p className="text-xs text-muted-foreground">{p.senderPhone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline">{PLAN_NAMES[p.plan] || p.plan}</Badge>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded flex items-center justify-center ${
                              p.paymentMethod === "orange_money" ? "bg-orange-100 dark:bg-orange-500/20" : "bg-yellow-100 dark:bg-yellow-500/20"
                            }`}>
                              <Smartphone className={`w-3 h-3 ${
                                p.paymentMethod === "orange_money" ? "text-orange-500" : "text-yellow-600"
                              }`} />
                            </div>
                            <span className="text-xs text-foreground">
                              {p.paymentMethod === "orange_money" ? "OM" : "MTN"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-bold text-foreground">{formatPrice(p.amount)}</td>
                        <td className="py-3 px-2">{statusBadge(p.status)}</td>
                        <td className="py-3 px-2 text-xs text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </td>
                        <td className="py-3 px-2 text-right">
                          {p.status === "pending" ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                className="h-7 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-400 dark:hover:bg-green-500/30"
                                onClick={() => { setSelectedPayment(p); setConfirmDialog("confirm"); }}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Valider
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                onClick={() => { setSelectedPayment(p); setConfirmDialog("reject"); }}
                              >
                                <XCircle className="w-3 h-3 mr-1" /> Rejeter
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={() => setSelectedPayment(p)}
                            >
                              <Eye className="w-3 h-3 mr-1" /> Details
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de confirmation / rejet */}
        <Dialog open={!!confirmDialog} onOpenChange={() => { setConfirmDialog(null); setRejectionReason(""); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmDialog === "confirm" ? "Confirmer le paiement" : "Rejeter le paiement"}
              </DialogTitle>
              <DialogDescription>
                {confirmDialog === "confirm"
                  ? "Veuillez verifier que le paiement a bien ete recu avant de confirmer."
                  : "Indiquez la raison du rejet."}
              </DialogDescription>
            </DialogHeader>

            {selectedPayment && (
              <div className="space-y-3 p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-medium text-foreground">{selectedPayment.reference}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entreprise</span>
                  <span className="text-foreground">{selectedPayment.company.name}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan demande</span>
                  <Badge variant="outline">{PLAN_NAMES[selectedPayment.plan]}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold text-foreground">{formatPrice(selectedPayment.amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Methode</span>
                  <span className="text-foreground">
                    {selectedPayment.paymentMethod === "orange_money" ? "Orange Money" : "MTN Mobile Money"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">N° Transaction</span>
                  <span className="font-mono text-foreground">{selectedPayment.transactionRef}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expediteur</span>
                  <span className="text-foreground">{selectedPayment.senderName || selectedPayment.senderPhone}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-mono text-foreground">{selectedPayment.senderPhone}</span>
                </div>
              </div>
            )}

            {confirmDialog === "reject" && (
              <div>
                <Label htmlFor="rejection">Raison du rejet *</Label>
                <Textarea
                  id="rejection"
                  placeholder="Ex: Montant incorrect, transaction non trouvee..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                />
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setConfirmDialog(null); setRejectionReason(""); }}>
                Annuler
              </Button>
              {confirmDialog === "confirm" && (
                <Button
                  className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                  onClick={handleAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Confirmer et activer le plan
                </Button>
              )}
              {confirmDialog === "reject" && (
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleAction}
                  disabled={actionLoading || !rejectionReason.trim()}
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Rejeter le paiement
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de détails (lecture seule) */}
        <Dialog open={!!selectedPayment && !confirmDialog} onOpenChange={() => setSelectedPayment(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Details du paiement
              </DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-3 p-3 bg-muted rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-medium text-[#25D366]">{selectedPayment.reference}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  {statusBadge(selectedPayment.status)}
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Entreprise</span>
                  <span className="text-foreground">{selectedPayment.company.name}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge variant="outline">{PLAN_NAMES[selectedPayment.plan]}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold text-foreground">{formatPrice(selectedPayment.amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Methode</span>
                  <span className="text-foreground">
                    {selectedPayment.paymentMethod === "orange_money" ? "Orange Money" : "MTN Mobile Money"}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">N° Transaction</span>
                  <span className="font-mono text-foreground">{selectedPayment.transactionRef}</span>
                </div>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expediteur</span>
                  <span className="text-foreground">{selectedPayment.senderName || "N/A"} ({selectedPayment.senderPhone})</span>
                </div>
                {selectedPayment.confirmedBy && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valide par</span>
                      <span className="text-foreground">{selectedPayment.confirmedBy.name}</span>
                    </div>
                  </>
                )}
                {selectedPayment.confirmedAt && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date de validation</span>
                      <span className="text-foreground">
                        {new Date(selectedPayment.confirmedAt).toLocaleDateString("fr-FR", {
                          day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>
                  </>
                )}
                {selectedPayment.rejectionReason && (
                  <>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Raison du rejet</span>
                      <span className="text-red-500">{selectedPayment.rejectionReason}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}