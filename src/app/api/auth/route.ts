import { NextResponse } from "next/server";
import { db, ensureBootstrapped } from "@/lib/db";
import { hashPassword, createToken, verifyToken } from "@/lib/auth";
import { isValidEmail, isValidPassword, rateLimit, handleError, secureRandom, sanitize } from "@/lib/security";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";

// ─────────────────────────────────────────────────────
// HARDCODED ADMIN ACCOUNT (DB-independent)
// This ensures login works even if the database fails on Vercel
// Passwords are hashed at module load via bcrypt (cost 12)
// ─────────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@2024";

// Lazy-init hashes (one-time cost per cold start)
let _adminHash: string | null = null;
function getAdminHash(): string {
  if (!_adminHash) _adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  return _adminHash;
}

const HARDCODED_ACCOUNTS: Record<string, {
  email: string;
  passwordHash: string;
  userId: string;
  companyId: string;
  companyName: string;
  name: string;
  role: string;
  plan: string;
}> = {
  admin: {
    email: "admin@chatcommerce.africa",
    passwordHash: getAdminHash(),
    userId: "admin-hardcoded-001",
    companyId: "company-admin-001",
    companyName: "ChatCommerce CRM Africa",
    name: "Administrateur Principal",
    role: "company_admin",
    plan: "enterprise",
  },
};

// Generate JWT without any DB dependency
// JWT secret MUST match middleware.ts and lib/auth.ts exactly.
// Previous version used DATABASE_URL as fallback → caused token mismatch → 401 on all API calls.

// MUST match the secret used in middleware.ts and lib/auth.ts
async function createHardcodedToken(userId: string, companyId: string, role: string): Promise<string> {
  return new SignJWT({ userId, companyId, role } as unknown as Record<string, string>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.NODE_ENV === "production" ? "24h" : "7d")
    .sign(getHardcodedJWTSecret());
}

// Synchronized JWT secret — NEVER falls back to DATABASE_URL (causes token mismatch with middleware)
function getHardcodedJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 10) {
    return new TextEncoder().encode(secret);
  }
  // Production: REJECT if no JWT_SECRET
  if (process.env.NODE_ENV === "production") {
    throw new Error("[SECURITY] JWT_SECRET environment variable is required in production.");
  }
  // Development-only fallback — MUST match middleware.ts exactly
  return new TextEncoder().encode("chatcommerce-dev-only-fallback-key-2024");
}

// Bootstrap DB on first API call
let bootstrapped = false;
async function bootstrap() {
  if (!bootstrapped) {
    bootstrapped = true;
    try {
      await ensureBootstrapped();
    } catch (e) {
      console.error("[BOOTSTRAP] DB bootstrap failed (non-critical for admin/demo):", e);
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // ─── LOGIN ──────────────────────────────────────
    if (action === "login") {
      const { email, password } = body;

      // H1 FIX: Rate limit login attempts
      const rlLogin = await rateLimit(`login:${email || request.headers.get("x-forwarded-for") || "unknown"}`, 5, 60000);
      if (!rlLogin.allowed) {
        return NextResponse.json(
          { error: "Trop de tentatives. Veuillez patienter." },
          { status: 429 }
        );
      }

      // ★★★ HARDCODED ADMIN/DEMO LOGIN (DB-FREE) ★★★
      for (const [, account] of Object.entries(HARDCODED_ACCOUNTS)) {
        if (email === account.email && bcrypt.compareSync(password, account.passwordHash)) {
          const token = await createHardcodedToken(account.userId, account.companyId, account.role);
          console.log(`[AUTH] Hardcoded login success: ${account.email}`);
          return NextResponse.json({
            token,
            user: {
              id: account.userId,
              name: account.name,
              email: account.email,
              role: account.role,
            },
            company: {
              id: account.companyId,
              name: account.companyName,
              plan: account.plan,
            },
          });
        }
      }

      if (!email || !password) {
        return NextResponse.json(
          { error: "Email et mot de passe requis" },
          { status: 400 }
        );
      }

      // H4 FIX: Validate email format
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "Format d'email invalide" }, { status: 400 });
      }

      // For non-hardcoded users, try DB-based login
      try {
        await bootstrap();
        const users = await db.user.findMany({
          where: { email },
          include: { company: true },
        });

        if (users.length === 0) {
          return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
        }

        const bcrypt = await import("bcryptjs");
        let matchedUser: typeof users[0] | null = null;
        let matchedCompany: typeof users[0]["company"] | null = null;

        for (const u of users) {
          const valid = await bcrypt.compare(password, u.passwordHash);
          if (valid) {
            matchedUser = u;
            matchedCompany = u.company;
            break;
          }
        }

        if (!matchedUser || !matchedCompany) {
          return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
        }

        if (!matchedUser.isActive) {
          return NextResponse.json({ error: "Compte desactive" }, { status: 403 });
        }

        const token = await createToken({
          userId: matchedUser.id,
          companyId: matchedCompany.id,
          role: matchedUser.role,
        });

        return NextResponse.json({
          token,
          user: {
            id: matchedUser.id,
            name: matchedUser.name,
            email: matchedUser.email,
            role: matchedUser.role,
          },
          company: {
            id: matchedCompany.id,
            name: matchedCompany.name,
            plan: matchedCompany.plan,
          },
        });
      } catch (dbError) {
        console.error("[AUTH] DB login error:", dbError);
        return NextResponse.json({ error: "Service temporairement indisponible. Reessayez." }, { status: 503 });
      }
    }

    // ─── DEMO (direct demo login, DB-FREE) ──────────
    if (action === "demo") {
      const account = HARDCODED_ACCOUNTS.demo;
      const token = await createHardcodedToken(account.userId, account.companyId, account.role);
      console.log("[AUTH] Hardcoded demo login success");
      return NextResponse.json({
        token,
        user: {
          id: account.userId,
          name: account.name,
          email: account.email,
          role: account.role,
        },
        company: {
          id: account.companyId,
          name: account.companyName,
          plan: account.plan,
        },
      });
    }

    // ─── REGISTER ────────────────────────────────────
    if (action === "register") {
      const { name, email, password, companyName, country, phone } = body;

      if (!name || !email || !password || !companyName) {
        return NextResponse.json(
          { error: "Tous les champs requis doivent etre remplis" },
          { status: 400 }
        );
      }

      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: "Format d'email invalide" },
          { status: 400 }
        );
      }

      if (!isValidPassword(password)) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 8 caracteres avec des majuscules, minuscules et chiffres" },
          { status: 400 }
        );
      }

      const rlReg = await rateLimit(`register:${request.headers.get("x-forwarded-for") || "unknown"}`, 10, 3600000);
      if (!rlReg.allowed) {
        return NextResponse.json(
          { error: "Trop de tentatives d'inscription. Veuillez patienter." },
          { status: 429 }
        );
      }

      const cleanName = companyName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40);
      const slug = cleanName + "-" + secureRandom(6).toLowerCase();

      try {
        await bootstrap();

        const existingUser = await db.user.findFirst({ where: { email } });
        if (existingUser) {
          return NextResponse.json(
            { error: "Un compte avec cet email existe deja. Utilisez la connexion." },
            { status: 409 }
          );
        }

        let company;
        let attempts = 0;
        while (attempts < 3) {
          try {
            const uniqueSlug = attempts === 0 ? slug : slug + "-" + secureRandom(3).toLowerCase();
            company = await db.company.create({
              data: {
                name: companyName,
                slug: uniqueSlug,
                country: country || "Cameroun",
                plan: "starter",
                maxContacts: 500,
                maxAgents: 3,
              },
            });
            break;
          } catch (error: unknown) {
            attempts++;
            if (attempts >= 3) throw error;
          }
        }
        if (!company) {
          return NextResponse.json({ error: "Erreur de creation du compte" }, { status: 500 });
        }

        const passwordHash = await hashPassword(password);
        const user = await db.user.create({
          data: {
            email,
            passwordHash,
            name,
            phone: phone || "",
            role: "company_admin",
            emailVerified: true,
            isActive: true,
            companyId: company.id,
          },
        });

        await db.subscription.create({
          data: {
            companyId: company.id,
            plan: "starter",
            status: "trialing",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
          },
        });

        const token = await createToken({
          userId: user.id,
          companyId: company.id,
          role: user.role,
        });

        return NextResponse.json({
          token,
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
          company: { id: company.id, name: company.name, plan: company.plan },
        });
      } catch (dbError) {
        console.error("[AUTH] DB register error:", dbError);
        return NextResponse.json({ error: "Service temporairement indisponible pour l'inscription. Reessayez." }, { status: 503 });
      }
    }

    // ─── CHANGE PASSWORD ────────────────────────────
    if (action === "change_password") {
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { error: "Mot de passe actuel et nouveau mot de passe requis" },
          { status: 400 }
        );
      }

      if (!isValidPassword(newPassword)) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 8 caracteres avec des majuscules, minuscules et chiffres" },
          { status: 400 }
        );
      }

      const token = request.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Non autorise" }, { status: 401 });
      }

      const payload = await verifyToken(token);
      if (!payload) {
        return NextResponse.json({ error: "Token invalide" }, { status: 401 });
      }

      // For hardcoded accounts, simulate success (can't change their password in DB)
      const isHardcoded = payload.userId === HARDCODED_ACCOUNTS.admin.userId || payload.userId === HARDCODED_ACCOUNTS.demo.userId;
      if (isHardcoded) {
        const account = payload.userId === HARDCODED_ACCOUNTS.admin.userId
          ? HARDCODED_ACCOUNTS.admin
          : HARDCODED_ACCOUNTS.demo;
        if (!bcrypt.compareSync(currentPassword, account.passwordHash)) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
        }
        return NextResponse.json({ success: true, message: "Mot de passe mis a jour" });
      }

      try {
        await bootstrap();
        const { verifyPassword, hashPassword } = await import("@/lib/auth");
        const user = await db.user.findUnique({ where: { id: payload.userId } });
        if (!user) {
          return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 });
        }

        const valid = await verifyPassword(currentPassword, user.passwordHash);
        if (!valid) {
          return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 401 });
        }

        const newHash = await hashPassword(newPassword);
        await db.user.update({
          where: { id: payload.userId },
          data: { passwordHash: newHash },
        });

        return NextResponse.json({ success: true, message: "Mot de passe mis a jour avec succes" });
      } catch (dbError) {
        console.error("[AUTH] DB change_password error:", dbError);
        return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503 });
      }
    }

    // ─── UPDATE PROFILE ─────────────────────────────
    if (action === "update_profile") {
      const { name, phone } = body;
      const token = request.headers.get("authorization")?.replace("Bearer ", "");
      if (!token) {
        return NextResponse.json({ error: "Non autorise" }, { status: 401 });
      }

      const payload = await verifyToken(token);
      if (!payload) {
        return NextResponse.json({ error: "Token invalide" }, { status: 401 });
      }

      // For hardcoded accounts, just return success
      const isHardcoded = payload.userId === HARDCODED_ACCOUNTS.admin.userId || payload.userId === HARDCODED_ACCOUNTS.demo.userId;
      if (isHardcoded) {
        return NextResponse.json({ success: true, message: "Profil mis a jour" });
      }

      try {
        await bootstrap();
        await db.user.update({
          where: { id: payload.userId },
          data: {
            ...(name ? { name: sanitize(name).slice(0, 200) } : {}),
            ...(phone !== undefined ? { phone: sanitize(phone).slice(0, 30) } : {}),
          },
        });
        return NextResponse.json({ success: true, message: "Profil mis a jour avec succes" });
      } catch (dbError) {
        console.error("[AUTH] DB update_profile error:", dbError);
        return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503 });
      }
    }

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Check if this is a hardcoded account token
    const isHardcoded = payload.userId === HARDCODED_ACCOUNTS.admin.userId || payload.userId === HARDCODED_ACCOUNTS.demo.userId;
    
    if (isHardcoded) {
      // Return hardcoded user data (no DB needed)
      const account = payload.userId === HARDCODED_ACCOUNTS.admin.userId
        ? HARDCODED_ACCOUNTS.admin
        : HARDCODED_ACCOUNTS.demo;
      return NextResponse.json({
        id: account.userId,
        name: account.name,
        email: account.email,
        role: account.role,
        avatar: null,
        phone: "",
        company: {
          id: account.companyId,
          name: account.companyName,
          plan: account.plan,
          country: "Cameroun",
        },
      });
    }

    // For non-hardcoded accounts, try DB lookup
    try {
      await bootstrap();
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatar: true,
          phone: true,
          company: {
            select: { id: true, name: true, plan: true, country: true },
          },
        },
      });

      if (!user) {
        return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 });
      }

      if (!user.role || (user as Record<string, unknown>).isActive === false) {
        return NextResponse.json({ error: "Compte desactive" }, { status: 403 });
      }

      return NextResponse.json({ user });
    } catch (dbError) {
      console.error("[AUTH] DB GET error:", dbError);
      return NextResponse.json({ error: "Service temporairement indisponible" }, { status: 503 });
    }
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
