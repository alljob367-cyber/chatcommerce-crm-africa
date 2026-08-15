"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app";
import { formatCurrency } from "@/lib/currencies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Wallet,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Building,
  Calendar,
  CreditCard,
  Phone,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────

interface Payment {
  id: string;
  agentId: string;
  chatId: string;
  customerName: string;
  customerPhone?: string;
  serviceName?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionRef?: string;
  status: string;
  merchantPhone?: string;
  confirmedAt?: string;
  notes?: string;
  createdAt: string;
  agent?: { id: string; name: string; botUsername?: string };
}

interface Stats {
  totalRevenue: number;
  pendingCount: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalPayments: number;
  rejectedCount: number;
  avgAmount: number;
  breakdown: { agentId: string; name: string; revenue: number; count: number }[];
}

// ─── Component ───────────────────────────────────────────────

export default function MerchantPaymentsPage() {
  const { token } = useAppStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0, pendingCount: 0, todayRevenue: 0, weekRevenue: 0,
    monthRevenue: 0, totalPayments: 0, rejectedCount: 0, avgAmount: 0, breakdown: [],
  });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [period, setPeriod] = useState("all");
  const [agentFilter, setAgentFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Dialog
  const [actionDialog, setActionDialog] = useState<{ open: boolean; payment: Payment | null; action: string }>({
    open: false, payment: null, action: "",
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; payment: Payment | null }>({
    open: false, payment: null,
  });
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (statusFilter) params.set("status", statusFilter);
      if (period && period !== "all") params.set("period", period);
      if (search) params.set("search", search);
      if (agentFilter) params.set("agentId", agentFilter);

      const res = await fetch(`/api/payments/merchant?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setTotal(data.total || 0);
        setStats(data.stats || stats);
      }
    } catch {
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, period, search, agentFilter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, period, search, agentFilter]);

  const handleAction = async () => {
    if (!actionDialog.payment || !actionDialog.action) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/payments/merchant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: actionDialog.payment.id, action: actionDialog.action, notes: actionNote }),
      });
      if (res.ok) {
        toast.success(actionDialog.action === "confirm" ? "Paiement confirme" : "Paiement rejete");
        setActionDialog({ open: false, payment: null, action: "" });
        setActionNote("");
        fetchPayments();
      } else {
        toast.error("Erreur lors de l'action");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.payment) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/payments/merchant?id=${deleteDialog.payment.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        toast.success("Paiement supprime");
        setDeleteDialog({ open: false, payment: null });
        fetchPayments();
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const badges: Record<string, { cls: string; label: string }> = {
      confirmed: { cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", label: "Confirme" },
      rejected: { cls: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", label: "Rejete" },
      pending: { cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", label: "En attente" },
      expired: { cls: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", label: "Expire" },
    };
    const b = badges[status] || badges.pending;
    return <Badge className={`${b.cls} text-[11px] font-medium`}>{b.label}</Badge>;
  };

  const payMethodIcon = (method: string) => {
    if (method === "orange_money") return "🟠";
    if (method === "mtn_money") return "🟡";
    return "💵";
  };

  const totalPages = Math.ceil(total / limit);

  const statCard = (icon: React.ReactNode, label: string, value: string, sub?: string, color?: string) => (
    <div className={`p-4 rounded-xl border ${color || "bg-card"} transition-all hover:shadow-sm`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color?.includes("green") ? "bg-green-100 dark:bg-green-900/30" : color?.includes("blue") ? "bg-blue-100 dark:bg-blue-900/30" : color?.includes("yellow") ? "bg-yellow-100 dark:bg-yellow-900/30" : color?.includes("purple") ? "bg-purple-100 dark:bg-purple-900/30" : "bg-muted"}`}>
          {icon}
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#25D366]" />
            Paiements Marchands
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Suivez les paiements de vos clients via les bots Telegram
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowFilters(!showFilters); }}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtres
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCard(
          <Banknote className="w-5 h-5 text-green-600 dark:text-green-400" />,
          "Revenus totaux",
          formatCurrency(stats.totalRevenue, "XAF"),
          `Moyenne: ${formatCurrency(stats.avgAmount, "XAF")}/paiement`,
          "green"
        )}
        {statCard(
          <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
          "Aujourd'hui",
          formatCurrency(stats.todayRevenue, "XAF"),
          `${stats.totalPayments} paiements au total`,
          "blue"
        )}
        {statCard(
          <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
          "En attente",
          String(stats.pendingCount),
          `${stats.rejectedCount} rejetes`,
          "yellow"
        )}
        {statCard(
          <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
          "Ce mois",
          formatCurrency(stats.monthRevenue, "XAF"),
          `Semaine: ${formatCurrency(stats.weekRevenue, "XAF")}`,
          "purple"
        )}
      </div>

      {/* Revenue by Agent */}
      {stats.breakdown.length > 0 && (
        <div className="p-4 rounded-xl border bg-card">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building className="w-4 h-4 text-muted-foreground" />
            Revenus par Agent
          </h3>
          <div className="space-y-2">
            {stats.breakdown.slice(0, 5).map((a) => (
              <div key={a.agentId} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center text-xs font-bold text-[#25D366]">
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground">{a.count} paiements</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(a.revenue, "XAF")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="p-4 rounded-xl border bg-card space-y-3 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="confirmed">Confirme</option>
              <option value="rejected">Rejete</option>
              <option value="expired">Expire</option>
            </select>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="all">Toute la periode</option>
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
            </select>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="h-9 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">Tous les agents</option>
              {stats.breakdown.map((a) => (
                <option key={a.agentId} value={a.agentId}>{a.name}</option>
              ))}
            </select>
          </div>
          {(statusFilter || period !== "all" || search || agentFilter) && (
            <button
              onClick={() => { setStatusFilter(""); setPeriod("all"); setSearch(""); setAgentFilter(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Reinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Payments Table */}
      <div className="rounded-xl border overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {total} paiement{total > 1 ? "s" : ""}
              {statusFilter && ` — ${statusFilter}`}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPayments} className="gap-1 text-xs h-8">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Wallet className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun paiement trouve</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les paiements apparaitront ici quand vos clients commanderont via Telegram
            </p>
          </div>
        ) : (
          <>
            {/* Table rows */}
            <div className="divide-y">
              {payments.map((p) => (
                <div key={p.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Top row: status + service + amount */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(p.status)}
                        <span className="text-sm font-medium truncate">
                          {p.serviceName || "Commande"}
                        </span>
                        <span className="text-sm font-bold ml-auto shrink-0">
                          {formatCurrency(p.amount, p.currency)}
                        </span>
                      </div>

                      {/* Second row: customer + agent + method */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {p.customerName}
                          {p.customerPhone && (
                            <span className="ml-1 font-mono">({p.customerPhone})</span>
                          )}
                        </span>
                        {p.agent && (
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {p.agent.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          {payMethodIcon(p.paymentMethod)}
                          {p.paymentMethod === "orange_money" ? "Orange Money" : p.paymentMethod === "mtn_money" ? "MTN Mobile Money" : p.paymentMethod}
                        </span>
                      </div>

                      {/* Third row: transaction ref + date */}
                      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                        {p.transactionRef && (
                          <span className="font-mono bg-muted px-2 py-0.5 rounded">
                            Tx: {p.transactionRef}
                          </span>
                        )}
                        {p.merchantPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {p.merchantPhone}
                          </span>
                        )}
                        <span>
                          {p.createdAt ? new Date(p.createdAt).toLocaleDateString("fr-FR", {
                            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                          }) : ""}
                        </span>
                        {p.confirmedAt && p.status === "confirmed" && (
                          <span className="text-green-600 dark:text-green-400">
                            Confirme: {new Date(p.confirmedAt).toLocaleDateString("fr-FR", {
                              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      {/* Notes */}
                      {p.notes && (
                        <p className="text-[10px] text-muted-foreground italic bg-muted/50 px-2 py-1 rounded">
                          {p.notes}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    {p.status === "pending" && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] gap-1 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => setActionDialog({ open: true, payment: p, action: "confirm" })}
                        >
                          <CheckCircle className="w-3 h-3" /> Confirmer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px] gap-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => setActionDialog({ open: true, payment: p, action: "reject" })}
                        >
                          <XCircle className="w-3 h-3" /> Rejeter
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 shrink-0"
                      onClick={() => setDeleteDialog({ open: true, payment: p })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  Page {page} sur {totalPages} ({total} paiements)
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Precedent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm/Reject Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ ...actionDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog.action === "confirm" ? (
                <><CheckCircle className="w-5 h-5 text-green-600" /> Confirmer le paiement</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-600" /> Rejeter le paiement</>
              )}
            </DialogTitle>
          </DialogHeader>
          {actionDialog.payment && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{actionDialog.payment.serviceName || "Commande"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{actionDialog.payment.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold">{formatCurrency(actionDialog.payment.amount, actionDialog.payment.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction</span>
                  <span className="font-mono text-xs">{actionDialog.payment.transactionRef || "N/A"}</span>
                </div>
              </div>
              {actionDialog.action === "reject" && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>Le client sera notifie du rejet et pourra reessayer avec /payer.</span>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Note (optionnel)</label>
                <textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Ajoutez une note..."
                  className="w-full h-20 rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setActionDialog({ open: false, payment: null, action: "" })}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={handleAction}
              disabled={actionLoading}
              className={
                actionDialog.action === "confirm"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {actionDialog.action === "confirm" ? "Confirmer" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" /> Supprimer le paiement
            </DialogTitle>
          </DialogHeader>
          {deleteDialog.payment && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Voulez-vous vraiment supprimer ce paiement de <b>{deleteDialog.payment.customerName}</b> ?
              </p>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Cette action est irreversible. Le client ne sera pas notifie.</span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialog({ open: false, payment: null })}>
              Annuler
            </Button>
            <Button size="sm" onClick={handleDelete} disabled={actionLoading} className="bg-red-600 hover:bg-red-700 text-white">
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
