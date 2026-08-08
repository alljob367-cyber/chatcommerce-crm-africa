import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const agents = await db.telegramAgent.findMany({
      where: { companyId: session.companyId },
      include: {
        _count: {
          select: { services: true, bookings: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ agents });
  } catch (error: unknown) {
    console.error("[API /telegram/agents]", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { name, token: botToken, botUsername, businessType, welcomeMessage, address, phone, openHours, currency, paymentMethod } = body;

    if (!name || !botToken || !businessType) {
      return NextResponse.json({ error: "Nom, token et type de business requis" }, { status: 400 });
    }

    if (!["restaurant", "salon_coiffure"].includes(businessType)) {
      return NextResponse.json({ error: "Type de business invalide" }, { status: 400 });
    }

    const agent = await db.telegramAgent.create({
      data: {
        companyId: session.companyId,
        name: sanitize(name),
        token: botToken,
        botUsername: botUsername ? sanitize(botUsername) : null,
        businessType,
        welcomeMessage: welcomeMessage ? sanitize(welcomeMessage) : null,
        address: address ? sanitize(address) : null,
        phone: phone ? sanitize(phone) : null,
        openHours: openHours || null,
        currency: currency || "XAF",
        paymentMethod: paymentMethod || null,
      },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}