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

    // Find or create admin company — always resolve the REAL DB ID
    let company = await db.company.findFirst({ where: { name: "ChatCommerce CRM Africa" } });
    if (!company) {
      company = await db.company.create({
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
      console.log(`[DB] Bootstrap: created company id=${company.id}`);
    }

    // Ensure admin user exists (use real company.id)
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
      console.log(`[DB] Bootstrap: created admin user with companyId=${company.id}`);
    } else if (existingAdmin.companyId !== company.id) {
      // Fix mismatch: admin user's companyId doesn't match the real company
      await db.user.update({
        where: { id: existingAdmin.id },
        data: { companyId: company.id },
      });
      console.log(`[DB] Bootstrap: fixed admin companyId ${existingAdmin.companyId} -> ${company.id}`);
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

    // Cache the real company ID globally so all routes can use it
    globalForPrisma.adminCompanyId = company.id;
    console.log(`[DB] Bootstrap complete: admin company id=${company.id}`);
  } catch (error) {
    console.error("[DB] Bootstrap failed:", error);
  }
}

/**
 * Resolve the actual companyId for the current session.
 * For the hardcoded admin, always returns the REAL DB company ID
 * (which may differ from the JWT companyId due to legacy mismatch).
 */
export async function resolveCompanyId(session: { userId: string; companyId: string }): Promise<string> {
  // For hardcoded admin, always use the real DB company ID
  if (session.userId === "admin-hardcoded-001") {
    await ensureBootstrapped();
    const realId = (globalForPrisma as unknown as { adminCompanyId?: string }).adminCompanyId;
    if (realId) return realId;
    // Fallback: look up from DB directly
    const company = await db.company.findFirst({ where: { name: "ChatCommerce CRM Africa" } });
    if (company) return company.id;
  }
  // For regular users, trust the JWT companyId (should match DB)
  return session.companyId;
}
