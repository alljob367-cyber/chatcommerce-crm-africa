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
    const bcrypt = await import("bcryptjs");

    const ADMIN_COMPANY_ID = "company-admin-001";

    // Create or find admin company with FIXED ID matching hardcoded JWT
    let company = await db.company.findUnique({ where: { id: ADMIN_COMPANY_ID } });
    if (!company) {
      try {
        company = await db.company.create({
          data: {
            id: ADMIN_COMPANY_ID,
            name: "ChatCommerce CRM Africa",
            slug: "chatcommerce-crm-africa",
            country: "Cameroun",
            plan: "enterprise",
            whatsappNumber: "+237612345678",
            maxContacts: 999999,
            maxAgents: 999999,
          },
        });
      } catch (createErr) {
        // Company might already exist (e.g. bootstrap ran before this fix)
        company = await db.company.findFirst({ where: { name: "ChatCommerce CRM Africa" } });
        if (!company) throw createErr;
      }
    }

    // Ensure admin user exists
    const existingAdmin = await db.user.findFirst({ where: { email: "admin@chatcommerce.africa" } });
    if (!existingAdmin) {
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
    }

    // Ensure admin subscription exists
    const existingSub = await db.subscription.findFirst({ where: { companyId: company.id } });
    if (!existingSub) {
      await db.subscription.create({
        data: {
          companyId: company.id,
          plan: "enterprise",
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
        },
      });
    }

    console.log(`[DB] Bootstrap complete: admin company id=${company.id}`);
  } catch (error) {
    console.error("[DB] Bootstrap failed:", error);
  }
}
