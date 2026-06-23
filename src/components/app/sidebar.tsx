"use client";

import { useAppStore, type Page } from "@/store/app";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Package,
  ShoppingCart,
  Target,
  Zap,
  Settings,
  Bot,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems: { page: Page; label: string; icon: React.ElementType; badge?: string }[] = [
  { page: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { page: "inbox", label: "Inbox WhatsApp", icon: MessageSquare, badge: "3" },
  { page: "contacts", label: "Contacts", icon: Users },
  { page: "leads", label: "Leads", icon: Target },
  { page: "products", label: "Produits", icon: Package },
  { page: "orders", label: "Commandes", icon: ShoppingCart, badge: "2" },
  { page: "automations", label: "Automatisations", icon: Zap },
  { page: "ai", label: "Assistant IA", icon: Bot },
  { page: "settings", label: "Paramètres", icon: Settings },
];

export default function Sidebar() {
  const { currentPage, setPage, sidebarOpen, toggleSidebar, user, logout } = useAppStore();
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "CC";

  const planColors: Record<string, string> = {
    starter: "bg-gray-100 text-gray-700",
    business: "bg-blue-50 text-blue-700",
    enterprise: "bg-purple-50 text-purple-700",
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-white border-r border-gray-100 flex flex-col z-40 transition-all duration-300",
        sidebarOpen ? "w-64" : "w-[72px]"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in">
              <h2 className="font-bold text-[#0F172A] text-sm leading-tight">ChatCommerce</h2>
              <p className="text-[10px] text-gray-400 font-medium">CRM Africa</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto custom-scroll">
        {navItems.map(({ page, label, icon: Icon, badge }) => {
          const isActive = currentPage === page;
          return (
            <Tooltip key={page} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPage(page)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    isActive
                      ? "sidebar-active text-[#0F172A]"
                      : "text-gray-500 hover:text-[#0F172A] hover:bg-gray-50"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 shrink-0 transition-colors",
                      isActive ? "text-[#25D366]" : "text-gray-400 group-hover:text-gray-600"
                    )}
                  />
                  {sidebarOpen && (
                    <span className="animate-fade-in truncate">{label}</span>
                  )}
                  {badge && sidebarOpen && (
                    <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  )}
                  {!sidebarOpen && badge && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                      {badge}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              {!sidebarOpen && (
                <TooltipContent side="right" className="text-xs">
                  {label}
                </TooltipContent>
              )}
            </Tooltip>
          );
        })}
      </nav>

      {/* User / Collapse */}
      <div className="border-t border-gray-50 p-3 shrink-0">
        {sidebarOpen ? (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-3 px-1">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-[#0F172A] text-white text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A] truncate">{user?.name}</p>
                <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={logout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
            {user?.company && (
              <Badge variant="outline" className={cn("text-[10px] font-medium", planColors[user.company.plan] || planColors.starter)}>
                Plan {user.company.plan}
              </Badge>
            )}
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="w-full text-gray-400 hover:text-red-500" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-gray-400 hover:text-[#0F172A]"
          onClick={toggleSidebar}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {sidebarOpen && <span className="ml-2 text-xs">Réduire</span>}
        </Button>
      </div>
    </aside>
  );
}