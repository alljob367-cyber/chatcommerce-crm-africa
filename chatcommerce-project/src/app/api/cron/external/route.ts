// ============================================================
// EXTERNAL CRON ENDPOINT — Alternative to Vercel Cron Jobs
// ============================================================
// This route can be called by external cron services like:
//   - cron-job.org (free, 1-minute intervals)
//   - cronitor.io
//   - EasyCron
//
// USAGE: GET /api/cron/external?secret=YOUR_CRON_SECRET
//
// The secret is passed as a query parameter (not a header)
// because most free cron services only support URL-based auth.
// ============================================================

import { NextResponse } from "next/server";
import { executeAutomations, type ExecutionReport } from "@/lib/automation-engine";
import crypto from "crypto";

/**
 * Verify the cron secret from query parameter.
 * This is looser than Vercel's header-based auth to support
 * free external cron services that can only set URLs.
 */
function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron External] CRON_SECRET n'est pas configuré");
    return false;
  }

  const { searchParams } = new URL(request.url);
  const providedSecret = searchParams.get("secret");

  if (!providedSecret) return false;
  // Timing-safe comparison to prevent timing attacks
  try {
    const expected = Buffer.from(cronSecret, "utf-8");
    const actual = Buffer.from(providedSecret, "utf-8");
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Non autorisé. Secret invalide." },
      { status: 401 }
    );
  }

  try {
    const report: ExecutionReport = await executeAutomations();

    return NextResponse.json({
      success: report.success,
      executed: report.executed,
      durationMs: report.durationMs,
      timestamp: new Date().toISOString(),
      triggeredBy: "external-cron",
    });
  } catch (error) {
    console.error("[Cron External] Erreur critique:", error);
    return NextResponse.json(
      { success: false, error: "Erreur critique" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
