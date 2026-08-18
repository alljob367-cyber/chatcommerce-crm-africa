import { create } from "zustand";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: "booking" | "message" | "status_change" | "info" | "success" | "warning";
  timestamp: string;
  read: boolean;
}

interface NotificationState {
  notifications: NotificationItem[];
  unreadCount: number;
  isConnected: boolean;
  lastEventId: string | null;

  // Actions
  addNotification: (notification: NotificationItem) => void;
  addNotifications: (notifications: NotificationItem[]) => void;
  setNotifications: (notifications: NotificationItem[]) => void;
  markAllRead: () => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  setConnected: (connected: boolean) => void;
  setLastEventId: (id: string) => void;
  setUnreadCount: (count: number) => void;
}

const MAX_NOTIFICATIONS = 50;
const STORAGE_KEY = "cc_notifications";
const UNREAD_KEY = "cc_unread_count";

function loadFromStorage(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as NotificationItem[];
  } catch {
    return [];
  }
}

function loadUnreadCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(UNREAD_KEY);
    if (!raw) return 0;
    return parseInt(raw, 10) || 0;
  } catch {
    return 0;
  }
}

function saveToStorage(notifications: NotificationItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // Storage full — ignore
  }
}

function saveUnreadCount(count: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UNREAD_KEY, String(count));
  } catch {
    // Storage full — ignore
  }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: loadFromStorage(),
  unreadCount: loadUnreadCount(),
  isConnected: false,
  lastEventId: null,

  addNotification: (notification) => {
    const { notifications, unreadCount } = get();
    const exists = notifications.some((n) => n.id === notification.id);
    if (exists) return;

    const updated = [notification, ...notifications].slice(0, MAX_NOTIFICATIONS);
    const newUnread = notification.read ? unreadCount : unreadCount + 1;
    saveToStorage(updated);
    saveUnreadCount(newUnread);
    set({ notifications: updated, unreadCount: newUnread });
  },

  addNotifications: (newNotifs) => {
    const { notifications, unreadCount } = get();
    const existingIds = new Set(notifications.map((n) => n.id));
    const unique = newNotifs.filter((n) => !existingIds.has(n.id));
    if (unique.length === 0) return;

    const merged = [...unique, ...notifications].slice(0, MAX_NOTIFICATIONS);
    const addedUnread = unique.filter((n) => !n.read).length;
    const newUnread = unreadCount + addedUnread;
    saveToStorage(merged);
    saveUnreadCount(newUnread);
    set({ notifications: merged, unreadCount: newUnread });
  },

  setNotifications: (notifications) => {
    const newUnread = notifications.filter((n) => !n.read).length;
    saveToStorage(notifications);
    saveUnreadCount(newUnread);
    set({ notifications, unreadCount: newUnread });
  },

  markAllRead: () => {
    const { notifications } = get();
    const updated = notifications.map((n) => ({ ...n, read: true }));
    saveToStorage(updated);
    saveUnreadCount(0);
    set({ notifications: updated, unreadCount: 0 });
  },

  markAsRead: (id) => {
    const { notifications, unreadCount } = get();
    const target = notifications.find((n) => n.id === id);
    if (!target || target.read) return;

    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveToStorage(updated);
    saveUnreadCount(Math.max(0, unreadCount - 1));
    set({ notifications: updated, unreadCount: Math.max(0, unreadCount - 1) });
  },

  clearAll: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(UNREAD_KEY);
    }
    set({ notifications: [], unreadCount: 0 });
  },

  setConnected: (connected) => set({ isConnected: connected }),

  setLastEventId: (id) => set({ lastEventId: id }),

  setUnreadCount: (count) => {
    saveUnreadCount(count);
    set({ unreadCount: count });
  },
}));
