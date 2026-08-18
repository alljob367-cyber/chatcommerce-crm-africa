import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// ─── SSE Real-time Notification Stream ───
// Polls DB every 10s for new events; sends SSE data events.
// Heartbeat every 30s to keep the connection alive.

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // ── Auth check ──
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const payload = token ? await verifyToken(token) : null;
  if (!payload) {
    return new Response("Non autorisé", {
      status: 401,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const companyId = payload.companyId;
  const userId = payload.userId || "";

  // Get "lastEventId" from Last-Event-ID header (SSE reconnection)
  const lastEventId = request.headers.get("last-event-id") ?? null;
  const since = lastEventId
    ? new Date(new Date(lastEventId).getTime())
    : new Date(Date.now() - 10_000); // Default: look back 10s

  const encoder = new TextEncoder();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let controller: ReadableStreamDefaultController | null = null;
  let lastSentId = lastEventId;
  let closed = false;

  function send(id: string, event: string, data: unknown) {
    if (closed || !controller) return;
    const encoded = JSON.stringify(data);
    const lines = [
      `event: ${event}`,
      `id: ${id}`,
      `data: ${encoded}`,
      "",
      "",
    ];
    controller.enqueue(encoder.encode(lines.join("\n")));
    lastSentId = id;
  }

  function sendHeartbeat() {
    if (closed || !controller) return;
    const id = new Date().toISOString();
    send(id, "heartbeat", { type: "heartbeat", timestamp: id });
  }

  async function pollNewEvents() {
    if (closed) return;

    const now = new Date();
    const lookback = new Date(now.getTime() - 15_000); // 15s window to avoid misses
    const sinceDate = since.getTime() > lookback.getTime() ? since : lookback;

    try {
      // 1. New Telegram Bookings
      const newBookings = await db.telegramBooking.findMany({
        where: {
          companyId,
          createdAt: { gt: sinceDate },
        },
        include: {
          agent: { select: { name: true, businessType: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      for (const booking of newBookings) {
        const eventId = `booking-${booking.id}-${booking.createdAt.getTime()}`;
        if (eventId === lastSentId) continue;
        send(eventId, "notification", {
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
          updatedAt: { gt: sinceDate },
          createdAt: { lt: sinceDate }, // Only status changes, not new bookings
        },
        include: {
          agent: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      for (const booking of updatedBookings) {
        const statusLabels: Record<string, string> = {
          confirmed: "confirmée",
          completed: "terminée",
          cancelled: "annulée",
        };
        const label = statusLabels[booking.status] ?? booking.status;
        const eventId = `status-${booking.id}-${booking.updatedAt.getTime()}`;
        if (eventId === lastSentId) continue;
        send(eventId, "notification", {
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
          updatedAt: { gt: sinceDate },
          unreadCount: { gt: 0 },
        },
        include: {
          contact: { select: { name: true, phone: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      });

      for (const conv of newConversations) {
        const eventId = `message-conv-${conv.id}-${conv.updatedAt.getTime()}`;
        if (eventId === lastSentId) continue;
        send(eventId, "notification", {
          type: "message",
          title: `Nouveau message`,
          body: `${conv.contact.name} (${conv.contact.phone}) - ${conv.unreadCount} message(s) non lu(s)`,
          timestamp: conv.updatedAt.toISOString(),
          id: conv.id,
        });
      }

      // 4. New notifications from the Notification table
      const newNotifications = await db.notification.findMany({
        where: {
          companyId,
          isRead: false,
          createdAt: { gt: sinceDate },
          OR: [
            { userId },
            { userId: null },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      for (const notif of newNotifications) {
        const eventId = `notif-${notif.id}`;
        if (eventId === lastSentId) continue;
        send(eventId, "notification", {
          type: notif.type === "success" ? "success" : notif.type === "warning" ? "warning" : notif.type === "error" ? "warning" : "info",
          title: notif.title,
          body: notif.message,
          timestamp: notif.createdAt.toISOString(),
          id: notif.id,
        });
      }

      // Update "since" for next poll
      since.setTime(now.getTime());
    } catch {
      // Polling error — silently continue
    }
  }

  const stream = new ReadableStream({
    start(ctr) {
      controller = ctr;

      // Send initial connected event
      const connectId = new Date().toISOString();
      send(connectId, "connected", {
        type: "connected",
        message: "Flux de notifications connecté",
        timestamp: connectId,
      });

      // Poll every 10 seconds
      pollTimer = setInterval(pollNewEvents, 10_000);

      // Heartbeat every 30 seconds
      heartbeatTimer = setInterval(sendHeartbeat, 30_000);

      // Also poll immediately after a short delay (give client time to register handlers)
      setTimeout(pollNewEvents, 1_500);
    },
    cancel() {
      closed = true;
      if (pollTimer) clearInterval(pollTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      controller = null;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Last-Event-ID, Cache-Control",
      "Access-Control-Expose-Headers": "Last-Event-ID",
    },
  });
}
