"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/store/app";
import { Search, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/app/notification-bell";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

const emptySubscribe = () => () => {};
function getMounted() {
  return true;
}
function getServerMounted() {
  return false;
}

export default function Header({ title, subtitle, children }: HeaderProps) {
  const { user } = useAppStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, getMounted, getServerMounted);

  const isDark = mounted ? (resolvedTheme || theme) === "dark" : false;

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            className="w-64 pl-9 h-9 bg-muted border-0 text-sm"
          />
        </div>
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(isDark ? "light" : "dark")}
        >
          <Sun className={cn("w-4 h-4 transition-all", isDark ? "rotate-90 scale-0" : "rotate-0 scale-100")} />
          <Moon className={cn("absolute w-4 h-4 transition-all", isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0")} />
          <span className="sr-only">Changer le theme</span>
        </Button>

        {/* Notifications Bell (SSE-powered) */}
        <NotificationBell />

        {user?.company && (
          <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {user.company.name}
          </span>
        )}
      </div>
    </header>
  );
}
