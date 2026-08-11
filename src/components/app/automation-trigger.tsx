"use client";

// ============================================================
// AUTOMATION TRIGGER — Client-side automation engine trigger
// ============================================================
// Since Vercel Hobby plan doesn't support frequent cron jobs,
// this component triggers the automation engine when a user
// is actively using the dashboard. It runs silently every 5
// minutes while the app is open, ensuring automations execute
// even without a server-side cron.
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/app";

const TRIGGER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const INITIAL_DELAY_MS = 10 * 1000; // 10 seconds after page load

export default function AutomationTrigger() {
  const token = useAppStore((s) => s.token);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTriggering = useRef(false);

  const triggerAutomations = useCallback(async () => {
    // Prevent concurrent triggers
    if (isTriggering.current || !token) return;
    isTriggering.current = true;

    try {
      const res = await fetch("/api/automations/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.executed > 0) {
          console.log(
            `[AutomationTrigger] ${data.executed} automatisation(s) exécutée(s) en ${data.durationMs}ms`
          );
        }
      }
    } catch {
      // Silent fail — automations will retry next interval
    } finally {
      isTriggering.current = false;
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    // Initial trigger after short delay (let the page load first)
    const initialTimer = setTimeout(() => {
      triggerAutomations();

      // Then repeat every 5 minutes
      timerRef.current = setInterval(triggerAutomations, TRIGGER_INTERVAL_MS);
    }, INITIAL_DELAY_MS);

    return () => {
      clearTimeout(initialTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token, triggerAutomations]);

  // This component renders nothing — it's a silent background worker
  return null;
}
