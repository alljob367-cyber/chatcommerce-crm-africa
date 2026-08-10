import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { NextResponse } from "next/server";

// ─── Polling Endpoint for Notifications (Vercel-compatible) ───
// Replaces SSE stream which is killed by Vercel 10s timeout.
// Client should poll every 5-10 seconds.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const payload = token ? await verifyToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const companyId = payload.companyId;
  const userId = payload.userId || "";

  // Get "since" parameter (last poll timestamp)
  const { searchParams } = new URL(request.url);
  const sinceStr = searchParams.get("since");
  const since = sinceStr ? new Date(parseInt(sinceStr)) : new Date(Date.now() - 30_000);

  try {
    const results: unknown[] = [];

    // 1. New Telegram Bookings
    const newBookings = await db.telegramBooking.findMany({
      where: {
        companyId,
        createdAt: { gt: since },
      },
      include: {
        agent: { select: { name: true, businessType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const booking of newBookings) {
      results.push({
        type: "booking",
        title: "Nouvelle réservation",
        body: `${booking.customerName} - ${booking.serviceName ?? "Service"} (${booking.agent?.name ?? "Bot"})`,
        timestamp: booking.createdAt.toISOString(),
        id: booking.id,
      });
    }

    // 2. Booking status changes
    const updatedBookings = await db.telegramBooking.findMany({
      where: {
        companyId,
        updatedAt: { gt: since },
        createdAt: { lt: since },
      },
      include: {
        agent: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    const statusLabels: Record<string, string> = {
      confirmed: "confirmée",
      completed: "terminée",
      cancelled: "annulée",
    };

    for (const booking of updatedBookings) {
      const label = statusLabels[booking.status] ?? booking.status;
      results.push({
        type: "status_change",
        title: `Réservation ${label}`,
        body: `${booking.customerName} - ${booking.serviceName ?? "Service"} (${booking.agent?.name ?? "Bot"})`,
        timestamp: booking.updatedAt.toISOString(),
        id: booking.id,
      });
    }

    // 3. New conversations with unread messages
    const newConversations = await db.conversation.findMany({
      where: {
        companyId,
        updatedAt: { gt: since },
        unreadCount: { gt: 0 },
      },
      include: {
        contact: { select: { name: true, phone: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });

    for (const conv of newConversations) {
      results.push({
        type: "message",
        title: "Nouveau message",
        body: `${conv.contact.name} (${conv.contact.phone}) - ${conv.unreadCount} message(s) non lu(s)`,
        timestamp: conv.updatedAt.toISOString(),
        id: conv.id,
      });
    }

    // 4. App notifications
    const newNotifications = await db.notification.findMany({
      where: {
        companyId,
        isRead: false,
        createdAt: { gt: since },
        OR: [
          { userId },
          { userId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    for (const notif of newNotifications) {
      results.push({
        type: notif.type === "success" ? "success" : notif.type === "warning" ? "warning" : notif.type === "error" ? "warning" : "info",
        title: notif.title,
        body: notif.message,
        timestamp: notif.createdAt.toISOString(),
        id: notif.id,
      });
    }

    return NextResponse.json({
      notifications: results,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ notifications: [], timestamp: Date.now() });
  }
}
