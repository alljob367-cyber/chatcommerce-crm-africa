import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

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
    const conversationId = searchParams.get("conversationId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!conversationId) {
      return NextResponse.json({ error: "conversationId requis" }, { status: 400 });
    }

    const conv = await db.conversation.findFirst({
      where: { id: conversationId, companyId: session.companyId },
    });
    if (!conv) return NextResponse.json({ error: "Conversation non trouvée" }, { status: 404 });

    await db.message.updateMany({
      where: { conversationId, isRead: false, direction: "inbound" },
      data: { isRead: true },
    });

    await db.conversation.update({
      where: { id: conversationId },
      data: { unreadCount: 0 },
    });

    const [messages, total] = await Promise.all([
      db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.message.count({ where: { conversationId } }),
    ]);

    return NextResponse.json({ messages, total });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}