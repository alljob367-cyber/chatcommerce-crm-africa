import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError, sanitize } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const categories = await db.category.findMany({
      where: { companyId: session.companyId },
      include: { _count: { select: { products: true } } },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { name, description, image, sortOrder } = body;
    if (!name) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

    const category = await db.category.create({
      data: { companyId: session.companyId, name: sanitize(name), description: sanitize(description || ""), image, sortOrder: sortOrder || 0 },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}