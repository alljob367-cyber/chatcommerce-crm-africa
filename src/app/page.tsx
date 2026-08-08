"use client";

import { useEffect } from "react";
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

export default function Home() {
  const { isAuthenticated, currentPage, sidebarOpen } = useAppStore();

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
