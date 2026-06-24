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
    const status = searchParams.get("status") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: Record<string, unknown> = { companyId: session.companyId };
    if (status && status !== "all") where.status = status;

    const [conversations, total] = await Promise.all([
      db.conversation.findMany({
        where,
        include: {
          contact: { select: { id: true, name: true, phone: true, avatar: true, tags: true } },
          assignedTo: { select: { id: true, name: true, avatar: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.conversation.count({ where }),
    ]);

    return NextResponse.json({ conversations, total });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { contactId, message, type } = body;

    // Create or find conversation
    let conversation = await db.conversation.findFirst({
      where: { companyId: session.companyId, contactId },
    });

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          companyId: session.companyId,
          contactId,
          status: "open",
          assignedToId: session.userId,
        },
      });
    }

    // Create message
    const msg = await db.message.create({
      data: {
        conversationId: conversation.id,
        body: message || "",
        direction: "outbound",
        type: type || "text",
        senderType: "agent",
        senderId: session.userId,
      },
    });

    // Update conversation
    await db.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: message,
        lastMessageAt: new Date(),
        status: "open",
      },
    });

    return NextResponse.json({ message: msg, conversation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, status, assignedToId } = body;

    const conversation = await db.conversation.update({
      where: { id, companyId: session.companyId },
      data: { status, assignedToId },
    });

    return NextResponse.json({ conversation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}