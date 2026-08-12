import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Singleton pattern for Prisma with PostgreSQL adapter (Neon)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  bootstrapped: boolean
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set. Configure your Neon PostgreSQL database.");
  }

  // PostgreSQL Pool - works with Neon and standard PostgreSQL
  const pool = new Pool({
    connectionString: databaseUrl,
    // Connection settings optimized for serverless (Vercel)
    max: 5,                    // Max connections
    idleTimeoutMillis: 10000,  // Close idle connections after 10s
    connectionTimeoutMillis: 5000, // Fail fast on connection issues
  });

  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Auto-bootstrap: create admin accounts if DB is empty
export async function ensureBootstrapped() {
  if (globalForPrisma.bootstrapped) return;
  globalForPrisma.bootstrapped = true;

  try {
    const userCount = await db.user.count();
    if (userCount > 0) return; // DB already has data

    const bcrypt = await import("bcryptjs");

    // Create admin company
    const company = await db.company.create({
      data: {
        name: "ChatCommerce CRM Africa",
        slug: "chatcommerce-crm-africa",
        country: "Cameroun",
        plan: "enterprise",
        whatsappNumber: "+237612345678",
        maxContacts: 999999,
        maxAgents: 999999,
      },
    });

    // Create admin user
    await db.user.create({
      data: {
        email: "admin@chatcommerce.africa",
        passwordHash: bcrypt.hashSync("Admin@2024", 12),
        name: "Administrateur Principal",
        phone: "+237612345678",
        role: "company_admin",
        emailVerified: true,
        isActive: true,
        companyId: company.id,
      },
    });

    // Create admin subscription
    await db.subscription.create({
      data: {
        companyId: company.id,
        plan: "enterprise",
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
      },
    });

    // Create demo company
    const demoCompany = await db.company.create({
      data: {
        name: "ChatCommerce Demo",
        slug: "chatcommerce-demo",
        country: "Cameroun",
        plan: "business",
        whatsappNumber: "+237699999999",
        maxContacts: 5000,
        maxAgents: 10,
      },
    });

    await db.user.create({
      data: {
        email: "demo@chatcommerce.africa",
        passwordHash: bcrypt.hashSync("Demo@2024", 12),
        name: "Utilisateur Demo",
        phone: "+237699999999",
        role: "company_admin",
        emailVerified: true,
        isActive: true,
        companyId: demoCompany.id,
      },
    });

    console.log("[DB] Bootstrap complete: admin + demo accounts created on PostgreSQL");
  } catch (error) {
    console.error("[DB] Bootstrap failed:", error);
  }
}
