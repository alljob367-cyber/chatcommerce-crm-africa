"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShoppingCart,
  Eye,
  Package,
  CheckCircle,
  Truck,
  XCircle,
  MoreVertical,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currency: string;
  paymentMethod?: string;
  createdAt: string;
  contact: { name: string; phone: string };
  items: OrderItem[];
  createdBy?: { name: string };
}

export default function OrdersPage() {
  const { token } = useAppStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(() => {
    if (!token) return;
    const params = statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
    fetch(`/api/orders${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatus = async (orderId: string, status: string) => {
    if (!token) return;
    await fetch("/api/orders", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: orderId, status }),
    });
    fetchOrders();
  };

  const formatXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

  const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pending: { label: "En attente", color: "bg-yellow-100 text-yellow-700", icon: Clock },
    confirmed: { label: "Confirmée", color: "bg-blue-100 text-blue-700", icon: CheckCircle },
    preparing: { label: "En préparation", color: "bg-orange-100 text-orange-700", icon: Package },
    ready: { label: "Prête", color: "bg-purple-100 text-purple-700", icon: Package },
    delivered: { label: "Livrée", color: "bg-green-100 text-green-700", icon: Truck },
    cancelled: { label: "Annulée", color: "bg-red-100 text-red-700", icon: XCircle },
  };

  return (
    <>
      <Header title="Commandes" subtitle={`${orders.length} commandes totales`}>
        <div className="hidden sm:flex items-center gap-1">
          {["all", "pending", "confirmed", "preparing", "delivered", "cancelled"].map((s) => {
            const cfg = statusConfig[s] || { label: "Tous", color: "" };
            return (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "ghost"}
                size="sm"
                className={`text-xs h-8 ${statusFilter === s ? "bg-primary" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "Toutes" : cfg.label}
              </Button>
            );
          })}
        </div>
      </Header>

      <div className="p-6 animate-fade-in">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune commande trouvée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const cfg = statusConfig[order.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              const paymentColors: Record<string, string> = {
                paid: "bg-green-100 text-green-700",
                pending: "bg-yellow-100 text-yellow-700",
                failed: "bg-red-100 text-red-700",
              };
              const paymentLabels: Record<string, string> = {
                paid: "Payé",
                pending: "En attente",
                failed: "Échoué",
              };
              const methodLabels: Record<string, string> = {
                orange_money: "Orange Money",
                mtn_momo: "MTN MoMo",
                cash: "Espèces",
              };

              return (
                <Card key={order.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-foreground">{order.orderNumber}</p>
                            <Badge className={`text-[10px] ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />{cfg.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.contact.name} · {order.contact.phone}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString("fr", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {order.paymentMethod && (
                              <span className="text-[10px] text-muted-foreground">{methodLabels[order.paymentMethod] || order.paymentMethod}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">{formatXAF(order.total)} <span className="text-xs text-muted-foreground font-normal">FCFA</span></p>
                          <Badge className={`text-[9px] ${paymentColors[order.paymentStatus] || ""}`}>
                            {paymentLabels[order.paymentStatus] || order.paymentStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedOrder(order)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {order.status !== "delivered" && order.status !== "cancelled" && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {Object.entries(statusConfig).filter(([k]) => k !== "all" && k !== order.status).map(([key, val]) => (
                                  <DropdownMenuItem key={key} onClick={() => handleStatus(order.id, key)}>{val.label}</DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Order Detail Dialog */}
        <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails de la commande</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">N°</span><p className="font-medium">{selectedOrder.orderNumber}</p></div>
                  <div><span className="text-muted-foreground">Client</span><p className="font-medium">{selectedOrder.contact.name}</p></div>
                  <div><span className="text-muted-foreground">Date</span><p className="font-medium">{new Date(selectedOrder.createdAt).toLocaleDateString("fr")}</p></div>
                  <div><span className="text-muted-foreground">Statut</span><Badge className={statusConfig[selectedOrder.status]?.color}>{statusConfig[selectedOrder.status]?.label}</Badge></div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Articles</p>
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className="text-foreground">{item.productName} x{item.quantity}</span>
                      <span className="font-medium">{formatXAF(item.total)} FCFA</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg text-[#25D366]">{formatXAF(selectedOrder.total)} FCFA</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}