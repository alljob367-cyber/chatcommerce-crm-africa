import { create } from "zustand";

export type Page =
  | "dashboard"
  | "contacts"
  | "inbox"
  | "products"
  | "orders"
  | "leads"
  | "automations"
  | "sync"
  | "settings"
  | "ai"
  | "payments"
  | "admin-payments"
  | "telegram"
  | "drivers"
  | "deliveries"
  | "campaigns"
  | "reports"
  | "api-docs"
  | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  company?: { id: string; name: string; plan: string; country?: string };
}

interface AppState {
  // Auth
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;

  // Navigation
  currentPage: Page;
  sidebarOpen: boolean;

  // Data cache
  dashboardData: Record<string, unknown> | null;

  // Actions
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setPage: (page: Page) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setDashboardData: (data: Record<string, unknown>) => void;
  hydrate: () => void;
}

// Safe localStorage reader (works on server and client)
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cc_token");
}

function getStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cc_user");
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    // Corrupted data — clear it
    localStorage.removeItem("cc_user");
    return null;
  }
}

export const useAppStore = create<AppState>((set) => ({
  // SSR defaults — always false/null on server
  token: null,
  user: null,
  isAuthenticated: false,
  hydrated: false,

  currentPage: "dashboard",
  sidebarOpen: true,
  dashboardData: null,

  // Rehydrate from localStorage after mount (client-only)
  hydrate: () => {
    const token = getStoredToken();
    const user = getStoredUser();
    set({
      token,
      user,
      isAuthenticated: !!token,
      hydrated: true,
    });
  },

  setAuth: (token, user) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cc_token", token);
      localStorage.setItem("cc_user", JSON.stringify(user));
    }
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cc_token");
      localStorage.removeItem("cc_user");
    }
    set({ token: null, user: null, isAuthenticated: false, currentPage: "dashboard", dashboardData: null });
  },

  setPage: (page) => set({ currentPage: page }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setDashboardData: (data) => set({ dashboardData: data }),
}));
