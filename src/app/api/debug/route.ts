import { NextResponse } from "next/server";

// Debug endpoint - helps diagnose login issues
export async function GET() {
  const info: Record<string, string> = {};
  
  info["NODE_ENV"] = process.env.NODE_ENV || "not set";
  info["JWT_SECRET"] = process.env.JWT_SECRET ? `SET (${process.env.JWT_SECRET.length} chars)` : "NOT SET - THIS IS THE BUG!";
  info["DATABASE_URL"] = process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + "..." : "NOT SET";
  
  try {
    const { db, ensureBootstrapped } = await import("@/lib/db");
    await ensureBootstrapped();
    const userCount = await db.user.count();
    const companyCount = await db.company.count();
    info["DB_STATUS"] = "OK";
    info["USER_COUNT"] = String(userCount);
    info["COMPANY_COUNT"] = String(companyCount);
    
    const users = await db.user.findMany({ select: { email: true, role: true, companyId: true } });
    info["USERS"] = JSON.stringify(users);
  } catch (e: unknown) {
    info["DB_ERROR"] = e instanceof Error ? e.message : String(e);
  }
  
  try {
    const bcrypt = await import("bcryptjs");
    info["BCRYPTJS"] = "OK";
    const testHash = bcrypt.hashSync("test", 4);
    info["BCRYPTJS_HASH"] = testHash.substring(0, 20) + "...";
  } catch (e: unknown) {
    info["BCRYPTJS"] = "FAILED: " + (e instanceof Error ? e.message : String(e));
  }
  
  return NextResponse.json(info);
}
