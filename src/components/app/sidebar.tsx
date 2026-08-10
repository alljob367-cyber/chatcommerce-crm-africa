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
  CreditCard,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ArrowLeftRight,
  BarChart3,
  FileText,
  Bike,
  Truck,
  Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navItems: { page: Page; label: string; icon: React.ElementType; badge?: string; adminOnly?: boolean; proOnly?: boolean }[] = [
  { page: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { page: "inbox", label: "Inbox WhatsApp", icon: MessageSquare },
  { page: "contacts", label: "Contacts", icon: Users },
  { page: "leads", label: "Leads", icon: Target },
  { page: "products", label: "Produits", icon: Package },
  { page: "sync", label: "Synchronisation", icon: ArrowLeftRight },
  { page: "orders", label: "Commandes", icon: ShoppingCart },
  { page: "automations", label: "Automatisations", icon: Zap },
  { page: "ai", label: "Assistant IA", icon: Bot },
  { page: "telegram", label: "Agents Telegram", icon: Bot },
  { page: "drivers", label: "Livreurs", icon: Bike },
  { page: "deliveries", label: "Livraisons", icon: Truck },
  { page: "payments", label: "Paiement Mobile Money", icon: CreditCard },
  { page: "campaigns", label: "Campagnes Telegram Ads", icon: Megaphone, proOnly: true },
  { page: "settings", label: "Parametres", icon: Settings },
  { page: "admin-payments", label: "Gestion Paiements", icon: Shield, adminOnly: true },
  { page: "reports", label: "Rapports", icon: BarChart3 },
  { page: "api-docs", label: "Documentation API", icon: FileText },
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
    starter: "bg-muted text-muted-foreground",
    pro: "bg-[#25D366]/10 text-[#25D366]",
    business: "bg-blue-500/10 text-blue-500 dark:text-blue-400",
    enterprise: "bg-purple-500/10 text-purple-500 dark:text-purple-400",
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-background border-r border-border flex flex-col z-40 transition-all duration-300",
        sidebarOpen ? "w-64" : "w-[72px]"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl shrink-0 overflow-hidden">
            <img src="/logo.png" alt="ChatCommerce CRM" className="w-full h-full object-cover" />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in">
              <h2 className="font-bold text-foreground text-sm leading-tight">ChatCommerce</h2>
              <p className="text-[10px] text-muted-foreground font-medium">CRM Africa</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto custom-scroll">
        {navItems
          .filter((item) => {
            if (item.adminOnly && user?.role !== "super_admin" && user?.role !== "company_admin") return false;
            if (item.proOnly && user?.company?.plan !== "pro" && user?.company?.plan !== "business" && user?.company?.plan !== "enterprise") return false;
            return true;
          })
          .map(({ page, label, icon: Icon, badge }) => {
          const isActive = currentPage === page;
          return (
            <Tooltip key={page} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setPage(page)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    isActive
                      ? "sidebar-active text-foreground dark:text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 shrink-0 transition-colors",
                      isActive ? "text-[#25D366]" : "text-muted-foreground group-hover:text-foreground"
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
      <div className="border-t border-border p-3 shrink-0">
        {sidebarOpen ? (
          <div className="animate-fade-in">
            <div className="flex items-center gap-3 mb-3 px-1">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-foreground text-background text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={logout}>
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
          <Button variant="ghost" size="icon" className="w-full text-muted-foreground hover:text-red-500" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 text-muted-foreground hover:text-foreground"
          onClick={toggleSidebar}
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {sidebarOpen && <span className="ml-2 text-xs">Réduire</span>}
        </Button>
      </div>
    </aside>
  );
}