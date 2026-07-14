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

function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8 text-center">
      <p className="text-lg font-semibold text-foreground">Une erreur est survenue</p>
      <p className="text-sm text-muted-foreground max-w-md">{error.message}</p>
      <button onClick={reset} className="text-sm text-[#25D366] font-medium hover:underline">
        Réessayer
      </button>
    </div>
  );
}

function PageRenderer({ page }: { page: string }) {
  const [key, setKey] = useState(0);
  switch (page) {
    case "dashboard": return <DashboardPage key={key} />;
    case "contacts": return <ContactsPage key={key} />;
    case "inbox": return <InboxPage key={key} />;
    case "products": return <ProductsPage key={key} />;
    case "orders": return <OrdersPage key={key} />;
    case "leads": return <LeadsPage key={key} />;
    case "automations": return <AutomationsPage key={key} />;
    case "ai": return <AIPage key={key} />;
    case "settings": return <SettingsPage key={key} />;
    case "payments": return <PaymentsPage key={key} />;
    case "admin-payments": return <AdminPaymentsPage key={key} />;
    default: return <DashboardPage key={key} />;
  }
}

export default function Home() {
  const { isAuthenticated, token, currentPage, sidebarOpen, setAuth, logout } = useAppStore();

  useEffect(() => {
    if (!token || !isAuthenticated) return;
    fetch("/api/auth", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Invalid");
        return r.json();
      })
      .then((data) => {
        if (data.user) {
          setAuth(token, {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            role: data.user.role,
            avatar: data.user.avatar,
            company: data.user.company,
          });
        }
      })
      .catch(() => {
        logout();
      });
  }, [token, isAuthenticated, setAuth, logout]);

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  const isFullHeight = currentPage === "inbox";

  return (
    <div className="min-h-screen bg-muted/30">
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