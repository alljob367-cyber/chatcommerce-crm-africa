import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/seed-demo";

export async function POST(request: Request) {
  // Simple protection: check for admin header
  const authHeader = request.headers.get("x-admin-key");
  if (authHeader !== "demo-seed-2024") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const result = await seedDemoData();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ error: "Erreur lors du seed" }, { status: 500 });
  }
}
