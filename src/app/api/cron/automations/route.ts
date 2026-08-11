// ============================================================
// POINT D'ENTRÉE CRON — Exécution des automatisations
// ============================================================
// Cette route est appelée chaque minute par Vercel Cron.
// Elle est protégée par un secret CRON_SECRET pour éviter
// les appels non autorisés depuis l'extérieur.
// ============================================================

import { NextResponse } from "next/server";
import { executeAutomations, type ExecutionReport } from "@/lib/automation-engine";
import crypto from "crypto";

/**
 * Vérifie l'authentification du cron.
 * En production Vercel, un header Authorization avec le CRON_SECRET est requis.
 * En développement, on autorise l'exécution sans secret pour faciliter les tests.
 */
function isAuthorized(request: Request): boolean {
  // En développement, toujours autoriser
  if (process.env.NODE_ENV === "development") return true;

  // Vérifier le secret du cron
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET n'est pas configuré");
    return false;
  }

  // Vercel ajoute automatiquement le header Authorization avec le CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const expectedAuth = `Bearer ${cronSecret}`;
  // Timing-safe comparison to prevent timing attacks
  try {
    const expected = Buffer.from(expectedAuth, "utf-8");
    const actual = Buffer.from(authHeader, "utf-8");
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  // Vérifier l'autorisation
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Non autorisé. Secret de cron invalide." },
      { status: 401 }
    );
  }

  try {
    const report: ExecutionReport = await executeAutomations();

    // Retourner un rapport détaillé
    return NextResponse.json({
      success: report.success,
      executed: report.executed,
      durationMs: report.durationMs,
      companiesProcessed: report.details.length,
      details: report.details.map((d) => ({
        companyId: d.companyId,
        companyName: d.companyName,
        resultsCount: d.results.length,
        successes: d.results.filter((r) => r.success).length,
        failures: d.results.filter((r) => !r.success).length,
        results: d.results.map((r) => ({
          automationId: r.automationId,
          automationName: r.automationName,
          type: r.type,
          conversationId: r.conversationId,
          contactName: r.contactName,
          success: r.success,
          error: r.error || undefined,
        })),
      })),
      errors: report.errors,
    });
  } catch (error) {
    console.error("[Cron Automatisations] Erreur critique:", error);
    return NextResponse.json(
      {
        success: false,
        executed: 0,
        error: "Erreur critique lors de l'exécution des automatisations",
      },
      { status: 500 }
    );
  }
}

// Autoriser également POST pour Vercel Cron
export async function POST(request: Request) {
  return GET(request);
}
