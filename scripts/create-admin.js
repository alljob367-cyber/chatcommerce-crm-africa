const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const db = new PrismaClient({
  datasources: { db: { url: "file:/home/z/my-project/db/custom.db" } },
});

async function main() {
  // 1. Create admin company
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
  console.log("Company created:", company.id, company.name);

  // 2. Create admin user
  const adminPass = bcrypt.hashSync("Admin@2024", 12);
  const admin = await db.user.create({
    data: {
      email: "admin@chatcommerce.africa",
      passwordHash: adminPass,
      name: "Administrateur Principal",
      phone: "+237612345678",
      role: "company_admin",
      emailVerified: true,
      isActive: true,
      companyId: company.id,
    },
  });
  console.log("Admin created:", admin.email, admin.role);

  // 3. Create enterprise subscription
  await db.subscription.create({
    data: {
      companyId: company.id,
      plan: "enterprise",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 365 * 86400000),
    },
  });
  console.log("Enterprise subscription created");

  // 4. Create demo company
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
  console.log("Demo company created:", demoCompany.id);

  const demoPass = bcrypt.hashSync("Demo@2024", 12);
  const demoUser = await db.user.create({
    data: {
      email: "demo@chatcommerce.africa",
      passwordHash: demoPass,
      name: "Utilisateur Demo",
      phone: "+237699999999",
      role: "company_admin",
      emailVerified: true,
      isActive: true,
      companyId: demoCompany.id,
    },
  });
  console.log("Demo user created:", demoUser.email);

  // 5. Demo data
  const cat1 = await db.category.create({ data: { companyId: demoCompany.id, name: "Plats principaux", sortOrder: 1 } });
  const cat2 = await db.category.create({ data: { companyId: demoCompany.id, name: "Boissons", sortOrder: 2 } });
  const cat3 = await db.category.create({ data: { companyId: demoCompany.id, name: "Desserts", sortOrder: 3 } });

  const products = [
    { name: "Poulet DG", price: 4500, categoryId: cat1.id, stock: 50 },
    { name: "Ndole", price: 3500, categoryId: cat1.id, stock: 30 },
    { name: "Eru", price: 3000, categoryId: cat1.id, stock: 25 },
    { name: "Jus de Mangue", price: 1000, categoryId: cat2.id, stock: 100 },
    { name: "Bissap", price: 800, categoryId: cat2.id, stock: 80 },
    { name: "Beignets Haricots", price: 500, categoryId: cat3.id, stock: 200 },
    { name: "Gateau Chocolat", price: 2500, categoryId: cat3.id, stock: 15 },
  ];
  for (const p of products) {
    await db.product.create({
      data: { companyId: demoCompany.id, ...p, sku: "SKU-" + Math.random().toString(36).substring(2, 8).toUpperCase() },
    });
  }
  console.log("Demo products:", products.length);

  const contacts = [
    { name: "Jean-Pierre Mbarga", phone: "+237671234567", city: "Douala", tags: "vip,regulier" },
    { name: "Fatou Bamba", phone: "+225071234567", city: "Abidjan", tags: "nouveau" },
    { name: "Omar Diallo", phone: "+221771234567", city: "Dakar", tags: "regulier" },
    { name: "Aicha Toure", phone: "+22361234567", city: "Bamako", tags: "vip" },
    { name: "Kwame Asante", phone: "+233241234567", city: "Accra", tags: "nouveau" },
  ];
  for (const c of contacts) {
    await db.contact.create({
      data: {
        companyId: demoCompany.id,
        source: "telegram",
        totalSpent: Math.random() * 200000 + 10000,
        orderCount: Math.floor(Math.random() * 10) + 1,
        lastMessageAt: new Date(Date.now() - Math.random() * 7 * 86400000),
        lastSeenAt: new Date(Date.now() - Math.random() * 3 * 86400000),
        ...c,
      },
    });
  }
  console.log("Demo contacts:", contacts.length);

  await db.subscription.create({
    data: {
      companyId: demoCompany.id,
      plan: "business",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  console.log("\n===== IDENTIFIANTS ADMIN =====");
  console.log("  Email:    admin@chatcommerce.africa");
  console.log("  Password: Admin@2024");
  console.log("  Role:     company_admin (Enterprise)");
  console.log("==================================");
  console.log("\n===== IDENTIFIANTS DEMO =====");
  console.log("  Email:    demo@chatcommerce.africa");
  console.log("  Password: Demo@2024");
  console.log("===============================");
}

main()
  .catch((e) => { console.error("Error:", e); process.exit(1); })
  .finally(() => db.$disconnect());
