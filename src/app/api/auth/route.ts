import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createToken, verifyToken } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "register") {
      const { name, email, password, companyName, country, phone } = body;
      if (!name || !email || !password || !companyName) {
        return NextResponse.json(
          { error: "Tous les champs requis doivent être remplis" },
          { status: 400 }
        );
      }

      // Create company
      const company = await db.company.create({
        data: {
          name: companyName,
          slug: companyName.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString(36),
          country: country || "Cameroun",
          plan: "starter",
          maxContacts: 500,
          maxAgents: 3,
        },
      });

      // Create admin user
      const passwordHash = await hashPassword(password);
      const user = await db.user.create({
        data: {
          email,
          passwordHash,
          name,
          phone,
          role: "company_admin",
          emailVerified: true,
          companyId: company.id,
        },
      });

      // Create subscription
      await db.subscription.create({
        data: {
          companyId: company.id,
          plan: "starter",
          status: "active",
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

      // Try demo login first
      if (email === "demo@chatcommerce.africa" && password === "demo") {
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

      // Find user - try to find by email across all companies
      const users = await db.user.findMany({
        where: { email },
        include: { company: true },
      });

      if (users.length === 0) {
        return NextResponse.json(
          { error: "Identifiants invalides" },
          { status: 401 }
        );
      }

      // Check password for each user with this email
      const bcrypt = await import("bcryptjs");
      let matchedUser = null;
      let matchedCompany = null;

      for (const u of users) {
        const valid = await bcrypt.compare(password, u.passwordHash);
        if (valid) {
          matchedUser = u;
          matchedCompany = u.company;
          break;
        }
      }

      if (!matchedUser) {
        return NextResponse.json(
          { error: "Identifiants invalides" },
          { status: 401 }
        );
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
      let company = await db.company.findFirst({
        where: { slug: "chatcommerce-demo" },
      });
      if (!company) {
        company = await seedDatabase();
      }
      const user = await db.user.findFirst({
        where: { companyId: company.id, role: "company_admin" },
      });
      if (!user) {
        return NextResponse.json(
          { error: "Compte demo non trouvé" },
          { status: 404 }
        );
      }
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

    return NextResponse.json({ error: "Action non reconnue" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}