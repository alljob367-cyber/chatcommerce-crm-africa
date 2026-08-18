import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

// C2 FIX: Seed endpoint now requires super_admin authentication
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Only super_admin can seed the database
    if (payload.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    // In production, block seeding entirely
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Seeding is disabled in production" },
        { status: 403 }
      );
    }

    const { seedDatabase } = await import("@/lib/seed");
    const company = await seedDatabase();

    return NextResponse.json({
      success: true,
      message: "Base de donnees initialisee avec succes",
      company: { id: company.id, name: company.name },
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}