import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  try {
    const company = await seedDatabase();
    return NextResponse.json({
      success: true,
      message: "Base de données initialisée avec succès",
      company: { id: company.id, name: company.name },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}