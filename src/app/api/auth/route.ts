import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createToken, verifyToken } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed";
import { isValidEmail, isValidPassword, rateLimit, handleError, secureRandom } from "@/lib/security";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "register") {
      const { name, email, password, companyName, country, phone } = body;

      if (!name || !email || !password || !companyName) {
        return NextResponse.json(
          { error: "Tous les champs requis doivent etre remplis" },
          { status: 400 }
        );
      }

      // H4 FIX: Validate email format
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: "Format d'email invalide" },
          { status: 400 }
        );
      }

      // H3 FIX: Validate password complexity
      if (!isValidPassword(password)) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 8 caracteres avec des majuscules, minuscules et chiffres" },
          { status: 400 }
        );
      }

      // H1 FIX: Rate limit registrations
      const rlReg = rateLimit(`register:${request.headers.get("x-forwarded-for") || "unknown"}`, 10, 3600000);
      if (!rlReg.allowed) {
        return NextResponse.json(
          { error: "Trop de tentatives d'inscription. Veuillez patienter." },
          { status: 429 }
        );
      }

      // FIX: Sanitize slug - remove accents and special chars
      const cleanName = companyName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40);
      const slug = cleanName + "-" + secureRandom(6).toLowerCase();

      // Check if email already exists in any company
      const existingUser = await db.user.findFirst({ where: { email } });
      if (existingUser) {
        return NextResponse.json(
          { error: "Un compte avec cet email existe deja. Utilisez la connexion." },
          { status: 409 }
        );
      }

      // Create company with retry on slug collision
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

      // Create admin user - auto-verify email
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

      // Create subscription (trial)
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
    }

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

      // Demo login works in all environments
      if (email === "demo@chatcommerce.africa" && password === "Demo@2024") {
        let company = await db.company.findFirst({
          where: { slug: "chatcommerce-demo" },
        });
        if (!company) {
          company = await seedDatabase();
        }
        const user = await db.user.findFirst({
          where: { companyId: company.id, role: "company_admin" },
        });
        if (user) {
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

      // Check if user is active
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
    }

    if (action === "demo") {
      // Demo mode: direct login with demo credentials
      const demoCompany = await db.company.findFirst({
        where: { slug: "chatcommerce-demo" },
      });
      if (!demoCompany) {
        return NextResponse.json({ error: "Compte demo non trouve. Contactez l'admin." }, { status: 404 });
      }
      const user = await db.user.findFirst({
        where: { companyId: demoCompany.id, role: "company_admin" },
      });
      if (!user) {
        return NextResponse.json({ error: "Compte demo non trouve" }, { status: 404 });
      }
      const token = await createToken({
        userId: user.id,
        companyId: demoCompany.id,
        role: user.role,
      });
      return NextResponse.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        company: { id: demoCompany.id, name: demoCompany.name, plan: demoCompany.plan },
      });
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

    // M4 FIX: Check if user is still active
    if (!user.role || (user as Record<string, unknown>).isActive === false) {
      return NextResponse.json({ error: "Compte desactive" }, { status: 403 });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}