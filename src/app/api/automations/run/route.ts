// ============================================================
// AUTOMATION RUN ENDPOINT — Client-triggered automation execution
// ============================================================
// Called by the frontend AutomationTrigger component when a user
// is active. This is the Hobby-plan alternative to Vercel Cron.
// Requires a valid JWT token (user must be logged in).
// Only executes automations for the user's own company.
// ============================================================

import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { executeAutomationsForCompany, type ExecutionReport } from "@/lib/automation-engine";
import { handleError } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: "Session invalide" }, { status: 401 });
    }

    // Execute automations only for this company
    const report: ExecutionReport = await executeAutomationsForCompany(session.companyId);

    return NextResponse.json({
      success: report.success,
      executed: report.executed,
      durationMs: report.durationMs,
      triggeredBy: "client-trigger",
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
