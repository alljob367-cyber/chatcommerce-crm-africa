import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Single contact by ID ──────────────────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(request);
    if (!payload) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;

    const contact = await db.contact.findFirst({
      where: { id, companyId: payload.companyId },
    });

    if (!contact) {
      return NextResponse.json({ error: "Contact non trouve" }, { status: 404 });
    }

    return NextResponse.json({ contact });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PATCH: Update a contact ─────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(request);
    if (!payload) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Verify contact belongs to company
    const existing = await db.contact.findFirst({
      where: { id, companyId: payload.companyId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Contact non trouve" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = sanitize(body.name);
    if (body.email !== undefined) updateData.email = body.email ? sanitize(body.email) : null;
    if (body.phone !== undefined) updateData.phone = sanitize(body.phone);
    if (body.tags !== undefined) updateData.tags = sanitize(body.tags);
    if (body.notes !== undefined) updateData.notes = body.notes ? sanitize(body.notes) : null;
    if (body.city !== undefined) updateData.city = body.city ? sanitize(body.city) : null;
    if (body.country !== undefined) updateData.country = body.country ? sanitize(body.country) : null;
    if (body.isLead !== undefined) updateData.isLead = Boolean(body.isLead);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnee a mettre a jour" }, { status: 400 });
    }

    const contact = await db.contact.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ contact });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── DELETE: Delete a contact ────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await authenticate(request);
    if (!payload) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { id } = await params;

    // Verify contact belongs to company
    const existing = await db.contact.findFirst({
      where: { id, companyId: payload.companyId },
      include: {
        _count: {
          select: {
            orders: true,
            conversations: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Contact non trouve" }, { status: 404 });
    }

    // Only delete if no orders or conversations are linked
    if (existing._count.orders > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer: ce contact a des commandes associees" },
        { status: 409 }
      );
    }

    if (existing._count.conversations > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer: ce contact a des conversations associees" },
        { status: 409 }
      );
    }

    await db.contact.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Contact supprime avec succes" });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
