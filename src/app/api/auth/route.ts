import { NextResponse } from "next/server";
import { db, ensureBootstrapped } from "@/lib/db";
import { hashPassword, createToken, verifyToken } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed";
import { isValidEmail, isValidPassword, rateLimit, handleError, secureRandom } from "@/lib/security";
import { SignJWT } from "jose";

// ─────────────────────────────────────────────────────
// HARDCODED ADMIN & DEMO ACCOUNTS (DB-independent)
// This ensures login works even if SQLite fails on Vercel
// ─────────────────────────────────────────────────────
const HARDCODED_ACCOUNTS: Record<string, {
  email: string;
  password: string;
  userId: string;
  companyId: string;
  companyName: string;
  name: string;
  role: string;
  plan: string;
}> = {
  admin: {
    email: "admin@chatcommerce.africa",
    password: "Admin@2024",
    userId: "admin-hardcoded-001",
    companyId: "company-admin-001",
    companyName: "ChatCommerce CRM Africa",
    name: "Administrateur Principal",
    role: "company_admin",
    plan: "enterprise",
  },
  demo: {
    email: "demo@chatcommerce.africa",
    password: "Demo@2024",
    userId: "demo-hardcoded-001",
    companyId: "company-demo-001",
    companyName: "ChatCommerce Demo",
    name: "Utilisateur Demo",
    role: "company_admin",
    plan: "business",
  },
};

// Generate JWT without any DB dependency
function getJWTSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length > 10) {
    return new TextEncoder().encode(secret);
  }
  const fallback = process.env.DATABASE_URL || "chatcommerce-fallback-secret-key-2024";
  return new TextEncoder().encode(fallback);
}

async function createHardcodedToken(userId: string, companyId: string, role: string): Promise<string> {
  return new SignJWT({ userId, companyId, role } as unknown as Record<string, string>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.NODE_ENV === "production" ? "24h" : "7d")
    .sign(getJWTSecret());
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
      const rlLogin = rateLimit(`login:${email || request.headers.get("x-forwarded-for") || "unknown"}`, 5, 60000);
      if (!rlLogin.allowed) {
        return NextResponse.json(
          { error: "Trop de tentatives. Veuillez patienter." },
          { status: 429 }
        );
      }

      // ★★★ HARDCODED ADMIN/DEMO LOGIN (DB-FREE) ★★★
      for (const [, account] of Object.entries(HARDCODED_ACCOUNTS)) {
        if (email === account.email && password === account.password) {
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

      const rlReg = rateLimit(`register:${request.headers.get("x-forwarded-for") || "unknown"}`, 10, 3600000);
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
