import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { safePagination, handleError } from "@/lib/security";

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: List notifications for current user/company ───
export async function GET(request: Request) {
  try {
    const payload = await authenticate(request);
    if (!payload) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      OR: [
        { userId: payload.userId },    // Notifications for this specific user
        { userId: null },              // Company-wide notifications
      ],
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: {
          companyId: payload.companyId,
          isRead: false,
          OR: [
            { userId: payload.userId },
            { userId: null },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PATCH: Mark notification(s) as read ───────────────
export async function PATCH(request: Request) {
  try {
    const payload = await authenticate(request);
    if (!payload) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const body = await request.json();
    const { ids, all } = body;

    const baseWhere: Record<string, unknown> = {
      companyId: payload.companyId,
      isRead: false,
      OR: [
        { userId: payload.userId },
        { userId: null },
      ],
    };

    if (all === true) {
      // Mark ALL unread notifications as read
      const result = await db.notification.updateMany({
        where: baseWhere,
        data: { isRead: true },
      });

      return NextResponse.json({
        message: `${result.count} notification(s) marquee(s) comme lue(s)`,
        updated: result.count,
      });
    }

    // Mark specific notifications by IDs
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Fournissez ids (tableau) ou all: true" },
        { status: 400 }
      );
    }

    const result = await db.notification.updateMany({
      where: {
        id: { in: ids },
        companyId: payload.companyId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return NextResponse.json({
      message: `${result.count} notification(s) marquee(s) comme lue(s)`,
      updated: result.count,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
