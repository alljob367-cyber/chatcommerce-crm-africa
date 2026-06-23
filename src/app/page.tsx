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

export default function Home() {
  const { isAuthenticated, token, currentPage, sidebarOpen, setAuth, logout } = useAppStore();

  // Verify token on mount
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

  // Not authenticated → show auth
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Render current page
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "contacts":
        return <ContactsPage />;
      case "inbox":
        return <InboxPage />;
      case "products":
        return <ProductsPage />;
      case "orders":
        return <OrdersPage />;
      case "leads":
        return <LeadsPage />;
      case "automations":
        return <AutomationsPage />;
      case "ai":
        return <AIPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  // Inbox page has its own full-height layout
  const isFullHeight = currentPage === "inbox";

  return (
    <div className="min-h-screen bg-gray-50/50">
      <Sidebar />
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 256 : 72 }}
      >
        {isFullHeight ? (
          renderPage()
        ) : (
          <main className="min-h-screen">
            {renderPage()}
          </main>
        )}
      </div>
    </div>
  );
}