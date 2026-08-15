import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, safePagination, handleError } from "@/lib/security";
import { checkPlanLimit, PLAN_LIMITS } from "@/lib/plan-limits";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

    const where: Record<string, unknown> = { companyId: session.companyId, isActive: true };
    if (search) where.name = { contains: search };
    if (categoryId) where.categoryId = categoryId;

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({ products, total });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Admin-only: create products
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) return NextResponse.json({ error: "Acces refuse. Admin requis." }, { status: 403 });

    const body = await request.json();
    const { name, description, price, categoryId, sku, stock, compareAtPrice, image, images } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: "Nom et prix requis" }, { status: 400 });
    }

    // Check plan limit for products
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    const productCount = await db.product.count({ where: { companyId: session.companyId, isActive: true } });
    const limitError = await checkPlanLimit(company?.plan || "starter", "maxProducts", productCount);
    if (limitError) return NextResponse.json({ error: limitError }, { status: 403 });

    const sanitizedName = sanitize(name);
    const sanitizedDesc = description ? sanitize(description) : null;

    const product = await db.product.create({
      data: {
        companyId: session.companyId,
        name: sanitizedName,
        description: sanitizedDesc,
        price: parseFloat(price),
        compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
        categoryId: categoryId || null,
        sku: sku || `SKU-${Date.now().toString(36).toUpperCase()}`,
        stock: parseInt(stock) || 0,
        image,
        images: images ? JSON.stringify(images) : null,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Admin-only: edit products
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) return NextResponse.json({ error: "Acces refuse. Admin requis." }, { status: 403 });

    const body = await request.json();
    const { id, name, description, price, categoryId, sku, stock, isActive, compareAtPrice, image, images } = body;

    // Validate price
    if (price !== undefined && (isNaN(parseFloat(price)) || parseFloat(price) < 0)) {
      return NextResponse.json({ error: "Prix invalide" }, { status: 400 });
    }

    const existing = await db.product.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const product = await db.product.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: sanitize(name) }),
        ...(description !== undefined && { description: sanitize(description) }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(compareAtPrice !== undefined && { compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(sku !== undefined && { sku }),
        ...(stock !== undefined && { stock: parseInt(stock) }),
        ...(isActive !== undefined && { isActive }),
        ...(image !== undefined && { image }),
        ...(images !== undefined && { images: images ? JSON.stringify(images) : null }),
      },
    });

    return NextResponse.json({ product });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Admin-only: delete products
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) return NextResponse.json({ error: "Acces refuse. Admin requis." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

    const existing = await db.product.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    await db.product.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}