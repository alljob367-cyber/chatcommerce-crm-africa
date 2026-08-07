import { create } from "zustand";

export type Page =
  | "dashboard"
  | "contacts"
  | "inbox"
  | "products"
  | "orders"
  | "leads"
  | "automations"
  | "settings"
  | "ai"
  | "payments"
  | "admin-payments"
  | "telegram";

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
}

export const useAppStore = create<AppState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("cc_token") : null,
  user: typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("cc_user") || "null")
    : null,
  isAuthenticated: typeof window !== "undefined" ? !!localStorage.getItem("cc_token") : false,
  currentPage: "dashboard",
  sidebarOpen: true,
  dashboardData: null,

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