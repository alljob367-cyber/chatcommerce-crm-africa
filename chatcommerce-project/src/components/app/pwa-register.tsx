"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

// Type for the beforeinstallprompt event
declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const DISMISS_KEY = "cc_pwa_dismissed";

function subscribeToStandalone() {
  const mql = window.matchMedia("(display-mode: standalone)");
  const handler = () => mql.dispatchEvent(new Event("change"));
  window.addEventListener("appinstalled", handler);
  return () => window.removeEventListener("appinstalled", handler);
}

function getStandaloneSnapshot() {
  return typeof window !== "undefined"
    ? window.matchMedia("(display-mode: standalone)").matches
    : false;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const isInstalled = useSyncExternalStore(subscribeToStandalone, getStandaloneSnapshot, () => false);

  // ── Register service worker ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function registerSW() {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Check for updates periodically
        intervalId = setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Every hour
      } catch {
        // Registration failed
      }
    }

    registerSW();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // ── Listen for beforeinstallprompt ──
  useEffect(() => {
    if (typeof window === "undefined") return;

    function handleBeforeInstall(e: BeforeInstallPromptEvent) {
      e.preventDefault();
      setDeferredPrompt(e);

      // Don't show if user dismissed recently (within 7 days)
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const dismissedTime = new Date(dismissedAt).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissedTime < sevenDays) return;
      }

      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 3000);
    }

    function handleAppInstalled() {
      setShowBanner(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // ── Install handler ──
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
    } catch {
      // User cancelled or error
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  // ── Dismiss handler ──
  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem(DISMISS_KEY, new Date().toISOString());
  }, []);

  // Don't render anything if not applicable
  if (!showBanner || isInstalled) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-xl shadow-2xl p-4 flex items-center gap-4">
        {/* Icon */}
        <div className="shrink-0 w-12 h-12 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-[#25D366]" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Installer ChatCommerce
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Installer sur votre téléphone pour un accès rapide
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="bg-[#25D366] hover:bg-[#20c05c] text-white text-xs h-8 px-3 gap-1.5"
            onClick={handleInstall}
          >
            <Download className="w-3.5 h-3.5" />
            Installer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
