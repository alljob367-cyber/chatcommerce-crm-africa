import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  bootstrapped: boolean
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  })

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
        maxContacts: 50000,
        maxAgents: 50,
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

    console.log("[DB] Bootstrap complete: admin + demo accounts created");
  } catch (error) {
    console.error("[DB] Bootstrap failed:", error);
  }
}