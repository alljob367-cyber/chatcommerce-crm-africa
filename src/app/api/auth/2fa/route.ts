import { NextResponse } from "next/server";
import { db, ensureBootstrapped } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";
import crypto from "crypto";

let bootstrapped = false;
async function bootstrap() {
  if (!bootstrapped) {
    bootstrapped = true;
    try { await ensureBootstrapped(); } catch (e) { console.error("[2FA] Bootstrap failed:", e); }
  }
}

// ─── POST: Enable/Setup 2FA ───────────────────────────────
// POST /api/auth/2fa  body: { action: "enable" | "verify" | "disable", code?: string }
export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Token invalide" }, { status: 401 });

    const body = await request.json();
    const { action, code } = body;

    await bootstrap();

    const user = await db.user.findUnique({ where: { id: payload.userId } });
    if (!user) return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 });

    // ─── ENABLE 2FA: Generate TOTP secret + backup codes ───
    if (action === "enable") {
      // Generate base32-like secret for TOTP
      const bytes = crypto.randomBytes(20);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      let secret = "";
      for (const b of bytes) secret += chars[b % chars.length];

      // Generate 8 backup codes
      const backupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 8));
      }

      // Generate a simple 6-digit code for initial verification
      const verifyCode = crypto.randomInt(100000, 999999).toString();

      // Store the secret and backup codes (user must verify with code to fully enable)
      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: secret,
          twoFactorBackupCodes: JSON.stringify(backupCodes),
          // Don't enable yet — wait for verification
          twoFactorEnabled: false,
        },
      });

      return NextResponse.json({
        success: true,
        secret,
        ...(process.env.NODE_ENV !== "production" ? { verifyCode } : {}),
        ...(process.env.NODE_ENV !== "production" ? { backupCodes } : {}),
        message: "Scannez ce code avec votre app d'authentification (Google Authenticator, Authy)",
      });
    }

    // ─── VERIFY 2FA: Confirm the setup with code ───
    if (action === "verify") {
      if (!code) return NextResponse.json({ error: "Code requis" }, { status: 400 });

      if (!user.twoFactorSecret) {
        return NextResponse.json({ error: "2FA non configure. Activez d'abord la 2FA." }, { status: 400 });
      }

      // Generate TOTP code from stored secret and compare with user input
      // Simple time-based derivation: secret provides entropy, time provides rotation
      const timeStep = Math.floor(Date.now() / 30000); // 30-second windows
      const hmac = crypto.createHmac('sha1', user.twoFactorSecret);
      hmac.update(timeStep.toString());
      const expectedCode = hmac.digest('hex').slice(0, 6);
      // Accept code if it matches current or previous window (for clock drift)
      const prevHmac = crypto.createHmac('sha1', user.twoFactorSecret);
      prevHmac.update((timeStep - 1).toString());
      const prevCode = prevHmac.digest('hex').slice(0, 6);

      const isCodeValid = code === expectedCode || code === prevCode;

      if (!isCodeValid) {
        return NextResponse.json({ error: "Code invalide" }, { status: 400 });
      }

      await db.user.update({
        where: { id: user.id },
        data: { twoFactorEnabled: true },
      });

      return NextResponse.json({
        success: true,
        message: "2FA active avec succes !",
      });
    }

    // ─── DISABLE 2FA ───
    if (action === "disable") {
      if (!code) return NextResponse.json({ error: "Code de verification requis" }, { status: 400 });

      if (!user.twoFactorSecret) {
        return NextResponse.json({ error: "2FA non configuree" }, { status: 400 });
      }

      // Verify with current TOTP code before disabling (same derivation as verify)
      const timeStep = Math.floor(Date.now() / 30000);
      const hmac = crypto.createHmac('sha1', user.twoFactorSecret);
      hmac.update(timeStep.toString());
      const expectedCode = hmac.digest('hex').slice(0, 6);

      if (code !== expectedCode) {
        return NextResponse.json({ error: "Code invalide" }, { status: 400 });
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "2FA desactivee",
      });
    }

    // ─── GENERATE OTP (for login step 2) ───
    if (action === "generate-otp") {
      if (!user.twoFactorEnabled) {
        return NextResponse.json({ error: "2FA non activee" }, { status: 400 });
      }

      const otp = crypto.randomInt(100000, 999999).toString();

      return NextResponse.json({
        success: true,
        ...(process.env.NODE_ENV !== "production" ? { otp } : {}),
        message: "Code de verification genere",
      });
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── GET: Check 2FA status ─────────────────────────────
export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Non autorise" }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: "Token invalide" }, { status: 401 });

    await bootstrap();

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { twoFactorEnabled: true, phoneVerified: true, phone: true },
    });

    if (!user) return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 });

    return NextResponse.json({
      twoFactorEnabled: user.twoFactorEnabled,
      phoneVerified: user.phoneVerified,
      phone: user.phone,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
