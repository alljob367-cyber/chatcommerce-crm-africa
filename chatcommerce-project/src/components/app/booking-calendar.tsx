"use client";

import React, { useState, useMemo, useCallback, createContext, useContext, useRef } from "react";
import { DayButton, getDefaultClassNames } from "react-day-picker";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Plus,
  Phone,
  User,
  Scissors,
  UtensilsCrossed,
  Clock,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/store/app";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────

export interface TelegramBooking {
  id: string;
  agentId: string;
  chatId: string;
  customerName: string;
  customerPhone: string | null;
  serviceId: string | null;
  serviceName: string | null;
  bookingDate: string | null;
  bookingTime: string | null;
  notes: string | null;
  status: string;
  agent: { name: string; businessType: string };
  createdAt: string;
}

export interface TelegramAgent {
  id: string;
  name: string;
  businessType: string;
}

interface BookingCalendarProps {
  bookings: TelegramBooking[];
  agents: TelegramAgent[];
  onStatusChange: (id: string, status: string) => void;
  onBookingCreated: () => void;
}

// ─── Status config ───────────────────────────────────────────────

const statusConfig: Record<string, { label: string; className: string; dotColor: string }> = {
  pending: {
    label: "En attente",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    dotColor: "bg-yellow-500",
  },
  confirmed: {
    label: "Confirmé",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    dotColor: "bg-green-500",
  },
  completed: {
    label: "Terminé",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    dotColor: "bg-blue-500",
  },
  cancelled: {
    label: "Annulé",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    dotColor: "bg-red-500",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Context for passing bookings map to custom DayButton ───────

type BookingsMap = Map<string, TelegramBooking[]>;

const BookingsMapContext = createContext<BookingsMap>(new Map());

// ─── Custom DayButton with booking dots ─────────────────────────

function BookingDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames();
  const bookingsMap = useContext(BookingsMapContext);
  const ref = useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  const dateStr = formatDateKey(day.date);
  const dayBookings = bookingsMap.get(dateStr) || [];

  // Get unique statuses to show as dots (max 4)
  const statusDots = useMemo(() => {
    const seen = new Set<string>();
    const dots: string[] = [];
    for (const b of dayBookings) {
      if (!seen.has(b.status)) {
        seen.add(b.status);
        const color = statusConfig[b.status]?.dotColor || "bg-gray-400";
        dots.push(color);
      }
      if (dots.length >= 4) break;
    }
    return dots;
  }, [dayBookings]);

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 dark:hover:text-accent-foreground flex aspect-square size-auto w-full min-w-(--cell-size) flex-col items-center justify-start pt-0.5 gap-0 leading-none font-normal group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] data-[range-end=true]:rounded-md data-[range-end=true]:rounded-r-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md data-[range-start=true]:rounded-l-md",
        defaultClassNames.day,
        className
      )}
      {...props}
    >
      <span className="text-sm leading-none">
        {day.date.getDate()}
      </span>
      {statusDots.length > 0 && (
        <div className="flex gap-0.5 mt-0.5">
          {statusDots.map((color, i) => (
            <span
              key={i}
              className={cn("w-1.5 h-1.5 rounded-full shrink-0", color)}
            />
          ))}
        </div>
      )}
    </Button>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function BookingCalendar({
  bookings,
  agents,
  onStatusChange,
  onBookingCreated,
}: BookingCalendarProps) {
  const { token } = useAppStore();
  const headers = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token]
  );

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [agentServices, setAgentServices] = useState<
    { id: string; name: string }[]
  >([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Create booking form
  const [createForm, setCreateForm] = useState({
    agentId: "",
    customerName: "",
    customerPhone: "",
    serviceId: "",
    serviceName: "",
    bookingDate: "",
    bookingTime: "",
    notes: "",
  });

  // Group bookings by date
  const bookingsMap = useMemo(() => {
    const map = new Map<string, TelegramBooking[]>();
    for (const b of bookings) {
      if (!b.bookingDate) continue;
      const existing = map.get(b.bookingDate) || [];
      existing.push(b);
      map.set(b.bookingDate, existing);
    }
    return map;
  }, [bookings]);

  // Get bookings for selected date
  const selectedDateStr = selectedDate ? formatDateKey(selectedDate) : null;
  const selectedBookings = useMemo(() => {
    if (!selectedDateStr) return [];
    return bookingsMap.get(selectedDateStr) || [];
  }, [selectedDateStr, bookingsMap]);

  // Sort selected bookings by time
  const sortedSelectedBookings = useMemo(() => {
    return [...selectedBookings].sort((a, b) => {
      if (!a.bookingTime && !b.bookingTime) return 0;
      if (!a.bookingTime) return 1;
      if (!b.bookingTime) return -1;
      return a.bookingTime.localeCompare(b.bookingTime);
    });
  }, [selectedBookings]);

  // ─── Fetch services for selected agent ───────────────────────

  const fetchServices = useCallback(
    async (agentId: string) => {
      setServicesLoading(true);
      try {
        const res = await fetch(
          `/api/telegram/agents/${agentId}/services`,
          { headers }
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        setAgentServices(data.services || []);
      } catch {
        setAgentServices([]);
      } finally {
        setServicesLoading(false);
      }
    },
    [headers]
  );

  const handleAgentChange = useCallback(
    (agentId: string) => {
      setCreateForm((f) => ({ ...f, agentId, serviceId: "", serviceName: "" }));
      setAgentServices([]);
      if (agentId) fetchServices(agentId);
    },
    [fetchServices]
  );

  const handleServiceChange = useCallback(
    (serviceId: string) => {
      const svc = agentServices.find((s) => s.id === serviceId);
      setCreateForm((f) => ({
        ...f,
        serviceId,
        serviceName: svc?.name || "",
      }));
    },
    [agentServices]
  );

  // ─── Create booking ──────────────────────────────────────────

  const handleCreateBooking = useCallback(async () => {
    if (!createForm.agentId || !createForm.customerName || !createForm.bookingDate || !createForm.bookingTime) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/telegram/bookings", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: createForm.agentId,
          customerName: createForm.customerName,
          customerPhone: createForm.customerPhone || null,
          serviceId: createForm.serviceId || null,
          serviceName: createForm.serviceName || null,
          bookingDate: createForm.bookingDate,
          bookingTime: createForm.bookingTime,
          notes: createForm.notes || null,
          chatId: "manual",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Réservation créée avec succès");
      setCreateDialogOpen(false);
      setCreateForm({
        agentId: "",
        customerName: "",
        customerPhone: "",
        serviceId: "",
        serviceName: "",
        bookingDate: "",
        bookingTime: "",
        notes: "",
      });
      setAgentServices([]);
      onBookingCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la création";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  }, [createForm, headers, onBookingCreated]);

  // Pre-fill date from calendar selection
  const handleOpenCreateDialog = useCallback(() => {
    const dateStr = selectedDate ? formatDateKey(selectedDate) : "";
    setCreateForm((f) => ({ ...f, bookingDate: dateStr }));
    setCreateDialogOpen(true);
  }, [selectedDate]);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <BookingsMapContext.Provider value={bookingsMap}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Calendrier des réservations
              </CardTitle>
              <Button
                size="sm"
                onClick={handleOpenCreateDialog}
                className="gap-1.5 h-8 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Créer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="w-full"
              components={{
                DayButton: BookingDayButton,
              }}
            />
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t">
              {Object.entries(statusConfig).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className={cn("w-2.5 h-2.5 rounded-full", cfg.dotColor)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {cfg.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Bookings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedDate ? (
                <span className="capitalize">
                  {selectedDate.toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              ) : (
                "Sélectionnez une date"
              )}
            </CardTitle>
            {selectedDate && (
              <p className="text-xs text-muted-foreground">
                {sortedSelectedBookings.length} réservation
                {sortedSelectedBookings.length !== 1 ? "s" : ""}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {!selectedDate ? (
              <div className="py-12 text-center text-muted-foreground">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  Cliquez sur une date du calendrier pour voir les réservations
                </p>
              </div>
            ) : sortedSelectedBookings.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <CalendarDays className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  Aucune réservation pour cette date
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenCreateDialog}
                  className="mt-3 gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Créer une réservation
                </Button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {sortedSelectedBookings.map((b) => {
                  const cfg = statusConfig[b.status] || statusConfig.pending;
                  return (
                    <div
                      key={b.id}
                      className="border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm">
                              {b.bookingTime || "—:—"}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] px-1.5 py-0", cfg.className)}
                            >
                              {cfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{b.customerName}</span>
                          </div>
                          {b.serviceName && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              {b.agent?.businessType === "restaurant" ? (
                                <UtensilsCrossed className="w-3 h-3 shrink-0" />
                              ) : (
                                <Scissors className="w-3 h-3 shrink-0" />
                              )}
                              <span className="truncate">{b.serviceName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {b.agent?.name || "—"}
                            </span>
                            {b.customerPhone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {b.customerPhone}
                              </span>
                            )}
                          </div>
                          {b.notes && (
                            <p className="text-xs text-muted-foreground mt-1 italic truncate">
                              {b.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {b.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onStatusChange(b.id, "confirmed")}
                                className="h-7 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Confirmer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onStatusChange(b.id, "cancelled")}
                                className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Annuler"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onStatusChange(b.id, "completed")}
                              className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Terminer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Create Booking Dialog ─── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer une réservation</DialogTitle>
            <DialogDescription>
              Ajoutez une nouvelle réservation manuellement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Agent */}
            <div className="space-y-2">
              <Label>Agent *</Label>
              <Select
                value={createForm.agentId}
                onValueChange={handleAgentChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez un agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        {a.businessType === "restaurant" ? (
                          <UtensilsCrossed className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Scissors className="w-4 h-4 text-purple-500" />
                        )}
                        {a.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer Name */}
            <div className="space-y-2">
              <Label>Nom du client *</Label>
              <Input
                placeholder="Ex: Jean Dupont"
                value={createForm.customerName}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, customerName: e.target.value }))
                }
              />
            </div>

            {/* Customer Phone */}
            <div className="space-y-2">
              <Label>Téléphone du client</Label>
              <Input
                placeholder="Ex: +237 6XX XXX XXX"
                value={createForm.customerPhone}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, customerPhone: e.target.value }))
                }
              />
            </div>

            {/* Service */}
            <div className="space-y-2">
              <Label>Service</Label>
              <Select
                value={createForm.serviceId}
                onValueChange={handleServiceChange}
                disabled={!createForm.agentId || servicesLoading}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      servicesLoading
                        ? "Chargement..."
                        : !createForm.agentId
                          ? "Sélectionnez d'abord un agent"
                          : "Sélectionnez un service"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {agentServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={createForm.bookingDate}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, bookingDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Heure *</Label>
                <Input
                  type="time"
                  value={createForm.bookingTime}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, bookingTime: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Notes ou commandes spéciales..."
                value={createForm.notes}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              Annuler
            </Button>
            <Button onClick={handleCreateBooking} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Créer la réservation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BookingsMapContext.Provider>
  );
}
