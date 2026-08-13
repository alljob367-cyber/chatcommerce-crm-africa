import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, safePagination, handleError } from "@/lib/security";
import { checkPlanLimit } from "@/lib/plan-limits";

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
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

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
        skip,
        take: limit,
      }),
      db.conversation.count({ where }),
    ]);

    return NextResponse.json({ conversations, total });
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
    const { contactId, message, type } = body;

    const cleanMessage = sanitize(message || "");

    // Create or find conversation
    // Verify contact belongs to this company
    const contact = await db.contact.findFirst({
      where: { id: contactId, companyId: session.companyId },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact introuvable" }, { status: 404 });
    }

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

    // Check plan limit for messages
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    if (company) {
      const messageCount = await db.message.count({
        where: { conversation: { companyId: session.companyId } },
      });
      const limitError = checkPlanLimit(company.plan, "maxMessages", messageCount);
      if (limitError) {
        return NextResponse.json({ error: limitError }, { status: 403 });
      }
    }

    // Create message
    const msg = await db.message.create({
      data: {
        conversationId: conversation.id,
        body: cleanMessage,
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
        lastMessage: cleanMessage,
        lastMessageAt: new Date(),
        status: "open",
      },
    });

    return NextResponse.json({ message: msg, conversation });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, status, assignedToId } = body;

    const existing = await db.conversation.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!existing) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });

    const conversation = await db.conversation.update({
      where: { id },
      data: { status, assignedToId },
    });

    return NextResponse.json({ conversation });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}