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
    const status = searchParams.get("status") || "";
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

    const where: Record<string, unknown> = { companyId: session.companyId };
    if (status) where.status = status;

    const [leads, total] = await Promise.all([
      db.lead.findMany({
        where,
        include: {
          contact: { select: { name: true, phone: true, avatar: true } },
          assignedTo: { select: { name: true, avatar: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      db.lead.count({ where }),
    ]);

    return NextResponse.json({ leads, total });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Check plan limit for leads
    const { checkPlanLimit } = await import("@/lib/plan-limits");
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    if (company) {
      const leadCount = await db.lead.count({ where: { companyId: session.companyId } });
      const limitError = await checkPlanLimit(company.plan, "maxLeads", leadCount);
      if (limitError) {
        return NextResponse.json({ error: limitError }, { status: 403 });
      }
    }

    const body = await request.json();
    const { contactId, status, value, notes, assignedToId } = body;

    const VALID_LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"];
    const VALID_SOURCES = ["whatsapp", "manual", "import", "website"];
    if (status && !VALID_LEAD_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    const sanitizedNotes = notes ? sanitize(notes) : null;

    const lead = await db.lead.create({
      data: {
        companyId: session.companyId,
        contactId,
        status: status || "new",
        value: value || 0,
        notes: sanitizedNotes,
        assignedToId,
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await authenticate(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, status, notes, assignedToId } = body;

    const existing = await db.lead.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

    const lead = await db.lead.update({
      where: { id },
      data: { status, notes, assignedToId },
    });

    return NextResponse.json({ lead });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}