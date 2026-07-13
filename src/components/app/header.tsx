"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAppStore } from "@/store/app";
import { Bell, Search, Sun, Moon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function Header({ title, subtitle, children }: HeaderProps) {
  const { user } = useAppStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          <Sun className={`w-4 h-4 transition-all ${isDark ? "rotate-90 scale-0" : "rotate-0 scale-100"}`} />
          <Moon className={`absolute w-4 h-4 transition-all ${isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0"}`} />
          <span className="sr-only">Changer le thème</span>
        </Button>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </Button>
        {user?.company && (
          <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {user.company.name}
          </span>
        )}
      </div>
    </header>
  );
}