import { NextResponse } from "next/server";
import { db, ensureBootstrapped } from "@/lib/db";
import { createToken } from "@/lib/auth";
import { handleError, rateLimit, sanitize } from "@/lib/security";
import crypto from "crypto";

let bootstrapped = false;
async function bootstrap() {
  if (!bootstrapped) {
    bootstrapped = true;
    try { await ensureBootstrapped(); } catch (e) { console.error("[PHONE-AUTH] Bootstrap failed:", e); }
  }
}

// ─── POST: Phone Login (Send OTP) ──────────────────────
// POST /api/auth/phone  body: { action: "send-otp" | "verify-otp", phone: string, code?: string }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, phone, code } = body;

    if (action === "send-otp") {
      if (!phone) {
        return NextResponse.json({ error: "Numero de telephone requis" }, { status: 400 });
      }

      // Validate phone format (basic: must start with + and have 8-15 digits)
      const cleanPhone = phone.replace(/\s/g, "");
      if (!/^\+?[0-9]{8,15}$/.test(cleanPhone)) {
        return NextResponse.json({ error: "Format de numero invalide. Ex: +237 6XX XXX XXX" }, { status: 400 });
      }

      // Rate limit: max 5 OTP sends per phone per hour
      const rl = await rateLimit(`phone-otp:${cleanPhone}`, 5, 3600000);
      if (!rl.allowed) {
        return NextResponse.json({ error: "Trop de codes envoyes. Reessayez dans une heure." }, { status: 429 });
      }

      await bootstrap();

      // Find user by phone
      const user = await db.user.findFirst({
        where: { phone: cleanPhone },
        include: { company: true },
      });

      if (!user) {
        return NextResponse.json({ error: "Aucun compte trouve avec ce numero" }, { status: 404 });
      }

      if (!user.isActive) {
        return NextResponse.json({ error: "Compte desactive" }, { status: 403 });
      }

      // Generate 6-digit OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExp = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // Store hashed OTP in user record
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      await db.user.update({
        where: { id: user.id },
        data: { phoneOtpCode: otpHash, phoneOtpExp: otpExp },
      });

      // In production, send OTP via SMS (Twilio/Infobip/Africa's Talking)
      // For now, return the OTP in the response for testing
      if (process.env.NODE_ENV !== "production") {
        console.log(`[PHONE-AUTH] OTP for ${cleanPhone}: ${otp}`);
      }

      return NextResponse.json({
        success: true,
        ...(process.env.NODE_ENV !== "production" ? { otp } : {}),
        message: "Code de verification envoye par SMS",
        expiresIn: 300, // 5 minutes
      });
    }

    if (action === "verify-otp") {
      if (!phone || !code) {
        return NextResponse.json({ error: "Telephone et code requis" }, { status: 400 });
      }

      const cleanPhone = phone.replace(/\s/g, "");

      // Rate limit: max 10 attempts per phone per 15 minutes
      const rl = await rateLimit(`phone-verify:${cleanPhone}`, 10, 900000);
      if (!rl.allowed) {
        return NextResponse.json({ error: "Trop de tentatives. Reessayez plus tard." }, { status: 429 });
      }

      await bootstrap();

      const user = await db.user.findFirst({
        where: { phone: cleanPhone },
        include: { company: true },
      });

      if (!user) {
        return NextResponse.json({ error: "Aucun compte trouve" }, { status: 404 });
      }

      // Verify OTP
      if (!user.phoneOtpCode || !user.phoneOtpExp) {
        return NextResponse.json({ error: "Aucun code envoye. Demandez d'abord un code." }, { status: 400 });
      }

      if (new Date() > user.phoneOtpExp) {
        return NextResponse.json({ error: "Code expire. Demandez un nouveau code." }, { status: 400 });
      }

      // Timing-safe comparison to prevent timing attacks
      const providedHash = crypto.createHash('sha256').update(code).digest('hex');
      const storedHash = user.phoneOtpCode || '';
      const hashBuffer = Buffer.from(providedHash, 'utf-8');
      const storedBuffer = Buffer.from(storedHash, 'utf-8');
      const isValid = hashBuffer.length === storedBuffer.length && crypto.timingSafeEqual(hashBuffer, storedBuffer);

      if (!isValid) {
        return NextResponse.json({ error: "Code invalide" }, { status: 401 });
      }

      // Clear OTP after successful verification
      await db.user.update({
        where: { id: user.id },
        data: { phoneOtpCode: null, phoneOtpExp: null, phoneVerified: true },
      });

      // Create JWT token
      const token = await createToken({
        userId: user.id,
        companyId: user.company.id,
        role: user.role,
      });

      return NextResponse.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
        },
        company: {
          id: user.company.id,
          name: user.company.name,
          plan: user.company.plan,
        },
      });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
