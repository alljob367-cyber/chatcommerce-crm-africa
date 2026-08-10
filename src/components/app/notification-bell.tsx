"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, X, Check, CheckCheck, MessageSquare, CalendarCheck, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/app";
import { useNotificationStore, type NotificationItem } from "@/lib/notification-store";
import { cn } from "@/lib/utils";

// ─── Web Audio API beep for new notifications ───
function playBeep() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 880;
    oscillator.type = "sine";
    gain.gain.value = 0.12;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Web Audio not available
  }
}

// ─── Relative time helper (French) ───
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;

  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `Il y a ${m} min`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return `Il y a ${h}h`;
  }
  const d = Math.floor(diff / 86_400_000);
  if (d === 1) return "Hier";
  return `Il y a ${d}j`;
}

// ─── Icon helper by notification type ───
function NotifIcon({ type }: { type: NotificationItem["type"] }) {
  switch (type) {
    case "booking":
      return <CalendarCheck className="w-4 h-4 text-emerald-500" />;
    case "message":
      return <MessageSquare className="w-4 h-4 text-sky-500" />;
    case "status_change":
      return <AlertCircle className="w-4 h-4 text-amber-500" />;
    case "warning":
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case "success":
      return <Check className="w-4 h-4 text-emerald-500" />;
    default:
      return <Info className="w-4 h-4 text-muted-foreground" />;
  }
}

// ─── Store original document title to restore ───
let originalTitle = "";
function flashTitle(count: number) {
  if (count <= 0) {
    document.title = originalTitle;
    return;
  }
  if (!originalTitle) originalTitle = document.title;
  document.title = `(${count}) ${originalTitle}`;
}

export default function NotificationBell() {
  const { token } = useAppStore();
  const {
    notifications,
    unreadCount,
    isConnected,
    addNotification,
    addNotifications,
    markAllRead,
    setNotifications,
    setConnected,
    setUnreadCount,
  } = useNotificationStore();

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  // Display notifications (max 20)
  const displayed = notifications.slice(0, 20);

  // ── Flash title on unread change ──
  useEffect(() => {
    flashTitle(unreadCount);
    return () => flashTitle(0);
  }, [unreadCount]);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Initial fetch of stored notifications ──
  const fetchInitialNotifs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        const items: NotificationItem[] = (data.notifications ?? []).map(
          (n: { id: string; title: string; message: string; type: string; isRead: boolean; createdAt: string }) => ({
            id: n.id,
            title: n.title,
            body: n.message,
            type: (n.type as NotificationItem["type"]) || "info",
            timestamp: n.createdAt,
            read: n.isRead,
          })
        );
        setNotifications(items);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silent
    }
  }, [token, setNotifications, setUnreadCount]);

  useEffect(() => {
    fetchInitialNotifs();
  }, [fetchInitialNotifs]);

  // ── Polling for Notifications (Vercel-compatible) ──
  const lastPollTime = useRef<number>(Date.now());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) return;

    async function pollNotifications() {
      try {
        const since = lastPollTime.current;
        const response = await fetch(`/api/notifications/poll?since=${since}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          lastPollTime.current = data.timestamp || Date.now();
          setConnected(true);

          const newNotifs: NotificationItem[] = (data.notifications || []).map((n: Record<string, string>) => ({
            id: n.id || `poll-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            title: n.title ?? "Notification",
            body: n.body ?? "",
            type: (n.type as NotificationItem["type"]) ?? "info",
            timestamp: n.timestamp ?? new Date().toISOString(),
            read: false,
          }));

          if (newNotifs.length > 0) {
            for (const notif of newNotifs) {
              addNotification(notif);
            }
            playBeep();
            if (document.hidden) {
              flashTitle(useNotificationStore.getState().unreadCount);
            }
          }
        } else {
          setConnected(false);
        }
      } catch {
        setConnected(false);
      }
    }

    // Poll immediately, then every 8 seconds
    pollNotifications();
    pollTimerRef.current = setInterval(pollNotifications, 8_000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [token, addNotification, setConnected]);

  // ── Mark all as read (API + store) ──
  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Even if API fails, update local state
    }
    markAllRead();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "relative text-muted-foreground hover:text-foreground transition-colors",
          !isConnected && "opacity-60"
        )}
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-in zoom-in duration-200">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {/* Connection indicator dot */}
        <span
          className={cn(
            "absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-background",
            isConnected ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
        />
      </Button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
              {isConnected && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="En temps réel" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-[#25D366] font-medium hover:underline flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  Tout marquer comme lu
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setOpen(false)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {displayed.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>Aucune notification</p>
              </div>
            ) : (
              displayed.map((notif) => (
                <div
                  key={notif.id}
                  className={cn(
                    "px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer",
                    !notif.read && "bg-muted/30"
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      <NotifIcon type={notif.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <div className="w-2 h-2 mt-1.5 bg-[#25D366] rounded-full shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notif.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {timeAgo(notif.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <button
                onClick={() => setOpen(false)}
                className="w-full text-center text-xs font-medium text-[#25D366] hover:underline"
              >
                Voir toutes les notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
