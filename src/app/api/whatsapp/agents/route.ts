import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { db, resolveCompanyId } from "@/lib/db";
import { handleError } from "@/lib/security";

const VALID_BUSINESS_TYPES = [
  "restaurant", "salon_coiffure", "pharmacie", "taxi", "epicerie",
  "pressing", "boulangerie", "hotel", "barbershop", "boutique",
  "auto_ecole", "clinique", "braiseuse_poisson",
];

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });

    const agents = await db.whatsAppAgent.findMany({
      where: { companyId },
      include: {
        _count: {
          select: { bookings: true, services: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Hide accessToken for non-admin users
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    const safe = agents.map(a => ({
      ...a,
      accessToken: isAdmin ? a.accessToken : undefined,
    }));

    return NextResponse.json({ agents: safe });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const companyId = await resolveCompanyId(session);
    if (!companyId) return NextResponse.json({ error: "Entreprise non trouvee" }, { status: 404 });

    if (session.role !== "company_admin" && session.role !== "super_admin") {
      return NextResponse.json({ error: "Acces refuse" }, { status: 403 });
    }

    const body = await request.json();
    const { name, phoneNumber, phoneId, accessToken, businessType, welcomeMessage, address, phone, openHours, currency, paymentMethod, aiConfig } = body;

    if (!name || !phoneNumber || !businessType) {
      return NextResponse.json({ error: "Nom, numero et type de business requis" }, { status: 400 });
    }

    if (!VALID_BUSINESS_TYPES.includes(businessType)) {
      return NextResponse.json({ error: "Type de business invalide" }, { status: 400 });
    }

    // Check plan limit
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (company) {
      const currentCount = await db.whatsAppAgent.count({ where: { companyId } });
      const limits: Record<string, number> = { starter: 2, business: 5, enterprise: 20 };
      const maxAgents = limits[company.plan] || 3;
      if (currentCount >= maxAgents) {
        return NextResponse.json({ error: `Limite atteinte (${maxAgents} agents pour le plan ${company.plan})` }, { status: 400 });
      }
    }

    const agent = await db.whatsAppAgent.create({
      data: {
        companyId, name, phoneNumber, phoneId, accessToken, businessType,
        welcomeMessage, address, phone, openHours,
        currency: currency || "XAF", paymentMethod, aiConfig: aiConfig ? JSON.stringify(aiConfig) : null,
      },
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    const e = handleError(error); return NextResponse.json({ error: e.error }, { status: e.status });
  }
}
