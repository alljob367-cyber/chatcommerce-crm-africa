import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, safePagination, handleError } from "@/lib/security";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const tag = searchParams.get("tag") || "";
    const source = searchParams.get("source") || "";
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

    const where: Record<string, unknown> = { companyId: session.companyId };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (tag) where.tags = { contains: tag };
    if (source) where.source = source;

    const [contacts, total] = await Promise.all([
      db.contact.findMany({
        where,
        orderBy: { lastMessageAt: "desc" },
        skip,
        take: limit,
      }),
      db.contact.count({ where }),
    ]);

    return NextResponse.json({ contacts, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Admin-only: create contacts
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) return NextResponse.json({ error: "Acces refuse. Admin requis." }, { status: 403 });

    // Check plan limit for contacts
    const { checkPlanLimit } = await import("@/lib/plan-limits");
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    if (company) {
      const contactCount = await db.contact.count({ where: { companyId: session.companyId } });
      const limitError = await checkPlanLimit(company.plan, "maxContacts", contactCount);
      if (limitError) {
        return NextResponse.json({ error: limitError }, { status: 403 });
      }
    }

    const body = await request.json();
    const { name, phone, email, tags, notes, city, country, source } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Nom et téléphone requis" }, { status: 400 });
    }

    const VALID_SOURCES = ["whatsapp", "manual", "import", "website"];
    if (source && !VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "Source invalide" }, { status: 400 });
    }

    // Check if contact already exists by phone
    const existing = await db.contact.findFirst({
      where: { companyId: session.companyId, phone },
    });
    if (existing) {
      return NextResponse.json({ error: "Ce contact existe déjà" }, { status: 409 });
    }

    const sanitizedName = sanitize(name);
    const sanitizedNotes = notes ? sanitize(notes) : null;

    const contact = await db.contact.create({
      data: {
        companyId: session.companyId,
        name: sanitizedName,
        phone,
        email,
        tags: tags || "",
        notes: sanitizedNotes,
        city,
        country,
        source: source || "manual",
      },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}