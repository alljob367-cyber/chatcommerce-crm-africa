import { NextResponse } from "next/server";
import { db, ensureBootstrapped, resolveCompanyId } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Get WhatsApp configuration ───────────────────────────

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    await ensureBootstrapped();
    const companyId = await resolveCompanyId(session);

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        whatsappNumber: true,
        whatsappPhoneId: true,
        // Never expose the full token
      },
    });

    return NextResponse.json({
      whatsappNumber: company?.whatsappNumber || null,
      whatsappPhoneId: company?.whatsappPhoneId || null,
      hasToken: !!(await db.company.findUnique({
        where: { id: companyId },
        select: { whatsappToken: true },
      }))?.whatsappToken,
      elevenLabsConfigured: !!process.env.ELEVENLABS_API_KEY,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── POST: Save WhatsApp configuration ─────────────────────────

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse. Admin uniquement." }, { status: 403 });
    }

    await ensureBootstrapped();
    const companyId = await resolveCompanyId(session);

    const body = await request.json();
    const { whatsappNumber, whatsappToken, whatsappPhoneId } = body;

    if (!whatsappToken || !whatsappPhoneId) {
      return NextResponse.json({ error: "WhatsApp Token et Phone ID requis" }, { status: 400 });
    }

    await db.company.update({
      where: { id: companyId },
      data: {
        whatsappNumber: whatsappNumber ? sanitize(whatsappNumber) : undefined,
        whatsappToken: sanitize(whatsappToken),
        whatsappPhoneId: sanitize(whatsappPhoneId),
      },
    });

    console.log("[API /whatsapp/config] WhatsApp configure pour company:", companyId);
    return NextResponse.json({ success: true, message: "WhatsApp configure avec succes !" });
  } catch (error: unknown) {
    console.error("[API /whatsapp/config] Error:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
