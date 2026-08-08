"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app";
import AuthPage from "@/components/app/auth-page";
import Sidebar from "@/components/app/sidebar";
import DashboardPage from "@/components/app/dashboard-page";
import ContactsPage from "@/components/app/contacts-page";
import InboxPage from "@/components/app/inbox-page";
import ProductsPage from "@/components/app/products-page";
import OrdersPage from "@/components/app/orders-page";
import LeadsPage from "@/components/app/leads-page";
import AutomationsPage from "@/components/app/automations-page";
import AIPage from "@/components/app/ai-page";
import SettingsPage from "@/components/app/settings-page";
import PaymentsPage from "@/components/app/payments-page";
import AdminPaymentsPage from "@/components/app/admin-payments-page";
import TelegramPage from "@/components/app/telegram-page";
import { ErrorBoundary } from "@/components/app/error-boundary";

function PageRenderer({ page }: { page: string }) {
  switch (page) {
    case "dashboard": return <DashboardPage />;
    case "contacts": return <ContactsPage />;
    case "inbox": return <InboxPage />;
    case "products": return <ProductsPage />;
    case "orders": return <OrdersPage />;
    case "leads": return <LeadsPage />;
    case "automations": return <AutomationsPage />;
    case "ai": return <AIPage />;
    case "settings": return <SettingsPage />;
    case "payments": return <PaymentsPage />;
    case "admin-payments": return <AdminPaymentsPage />;
    case "telegram": return <TelegramPage />;
    default: return <DashboardPage />;
  }
}

// Loading skeleton shown during hydration
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/20 animate-pulse" />
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeInner />
    </ErrorBoundary>
  );
}

function HomeInner() {
  const { isAuthenticated, hydrated, currentPage, sidebarOpen, hydrate } = useAppStore();
  const [mounted, setMounted] = useState(false);

  // Hydrate store from localStorage + set mounted flag
  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  // During SSR and before hydration: show loading skeleton
  // This ensures server and client render the same thing
  if (!mounted || !hydrated) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const isFullHeight = currentPage === "inbox";

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 256 : 72 }}
      >
        {isFullHeight ? (
          <PageRenderer page={currentPage} />
        ) : (
          <main className="min-h-screen">
            <PageRenderer page={currentPage} />
          </main>
        )}
      </div>
    </div>
  );
}
