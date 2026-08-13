import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

// ═══════════════════════════════════════════
// CHATCOMMERCE CRM AFRICA — FULL DEMO SEED
// Idempotent: uses upsert() throughout
// ═══════════════════════════════════════════

const COMPANY_1_SLUG = "company-admin-001";

interface Stats {
  companies: number;
  users: number;
  businesses: number;
  products: number;
  services: number;
  contacts: number;
  orders: number;
  drivers: number;
  bookings: number;
  deliveries: number;
}

export async function seedDemoData(): Promise<Stats> {
  const stats: Stats = {
    companies: 0,
    users: 0,
    businesses: 0,
    products: 0,
    services: 0,
    contacts: 0,
    orders: 0,
    drivers: 0,
    bookings: 0,
    deliveries: 0,
  };

  // ─── Utility: date string N days from now ───
  function daysFromNow(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  // ─── Helper: upsert Company ───
  async function upsertCompany(slug: string, name: string, extra: Record<string, unknown> = {}) {
    const data = {
      name,
      slug,
      country: "Cameroun",
      plan: "business",
      whatsappNumber: "+237612345678",
      maxContacts: 5000,
      maxAgents: 10,
      currency: "XAF",
      ...extra,
    };
    const company = await db.company.upsert({
      where: { slug },
      update: data,
      create: data,
    });
    stats.companies++;
    return company;
  }

  // ─── Helper: upsert User ───
  async function upsertUser(
    companyId: string,
    email: string,
    name: string,
    role: string,
    phone: string,
    password: string
  ) {
    const passwordHash = await hashPassword(password);
    const user = await db.user.upsert({
      where: { email_companyId: { email, companyId } },
      update: { name, role, phone, passwordHash },
      create: {
        companyId,
        email,
        name,
        role,
        phone,
        passwordHash,
        emailVerified: true,
        isActive: true,
      },
    });
    stats.users++;
    return user;
  }

  // ─── Helper: upsert Category (deterministic ID) ───
  async function upsertCategory(companyId: string, name: string, sortOrder: number) {
    const id = `${companyId}-cat-${name.toLowerCase().replace(/\s+/g, "-")}`;
    return db.category.upsert({
      where: { id },
      update: { name, sortOrder },
      create: { id, companyId, name, sortOrder },
    });
  }

  // ─── Helper: upsert Product (deterministic ID from SKU) ───
  async function upsertProduct(
    companyId: string,
    sku: string,
    name: string,
    price: number,
    categoryId: string | null,
    stock: number
  ) {
    const id = `${companyId}-prod-${sku}`;
    const product = await db.product.upsert({
      where: { id },
      update: { name, price, stock, isActive: true },
      create: { id, companyId, categoryId, name, price, sku, stock, isActive: true },
    });
    stats.products++;
    return product;
  }

  // ─── Helper: upsert Contact (deterministic ID from phone) ───
  async function upsertContact(
    companyId: string,
    phone: string,
    name: string,
    city: string,
    tags: string = ""
  ) {
    const id = `${companyId}-contact-${phone.replace(/[^0-9]/g, "")}`;
    const contact = await db.contact.upsert({
      where: { id },
      update: { name, city, tags },
      create: {
        id,
        companyId,
        phone,
        name,
        city,
        tags,
        source: "whatsapp",
        totalSpent: Math.round(Math.random() * 500000 + 10000),
        orderCount: Math.floor(Math.random() * 20) + 1,
        lastMessageAt: new Date(Date.now() - Math.random() * 7 * 86400000),
        lastSeenAt: new Date(Date.now() - Math.random() * 3 * 86400000),
      },
    });
    stats.contacts++;
    return contact;
  }

  // ─── Helper: upsert Driver (deterministic ID) ───
  async function upsertDriver(
    companyId: string,
    phone: string,
    name: string,
    vehicleType: string,
    status: string
  ) {
    const id = `${companyId}-driver-${phone.replace(/[^0-9]/g, "")}`;
    const driver = await db.driver.upsert({
      where: { id },
      update: { name, vehicleType, status, isActive: true },
      create: {
        id,
        companyId,
        phone,
        name,
        vehicleType,
        status,
        rating: +(Math.random() * 2 + 3).toFixed(1),
        totalDeliveries: Math.floor(Math.random() * 200) + 10,
        totalEarnings: Math.round(Math.random() * 300000 + 50000),
        location: { lat: 4.0511 + Math.random() * 0.05, lng: 9.7679 + Math.random() * 0.05, address: "Douala, Cameroun" },
        isActive: true,
      },
    });
    stats.drivers++;
    return driver;
  }

  // ─── Helper: upsert TelegramAgent (deterministic ID) ───
  async function upsertTelegramAgent(
    companyId: string,
    name: string,
    businessType: string,
    token: string
  ) {
    const id = `${companyId}-tagent-${businessType}`;
    const agent = await db.telegramAgent.upsert({
      where: { id },
      update: { name, token, isActive: true },
      create: {
        id,
        companyId,
        name,
        token,
        botUsername: `@${name.toLowerCase().replace(/\s+/g, "_")}_bot`,
        businessType,
        isActive: true,
        welcomeMessage: `Bienvenue chez ${name} ! 🎉 Comment puis-je vous aider ?`,
        address: "Douala, Cameroun",
        currency: "XAF",
        paymentMethod: "orange_money",
      },
    });
    stats.businesses++;
    return agent;
  }

  // ─── Helper: upsert BusinessService (deterministic ID) ───
  async function upsertBusinessService(
    agentId: string,
    name: string,
    price: number,
    duration: number | null = null,
    sortOrder: number = 0
  ) {
    const id = `${agentId}-svc-${name.toLowerCase().replace(/\s+/g, "-")}`;
    const svc = await db.businessService.upsert({
      where: { id },
      update: { name, price, duration, isActive: true },
      create: { id, agentId, name, price, duration, sortOrder, isActive: true },
    });
    stats.services++;
    return svc;
  }

  // ─── Helper: upsert Order (deterministic ID from orderNumber) ───
  async function upsertOrder(
    companyId: string,
    orderNumber: string,
    contactId: string,
    status: string,
    subtotal: number,
    tax: number,
    total: number,
    paymentMethod: string,
    createdById: string | null,
    daysAgo: number = 0
  ) {
    const id = `${companyId}-order-${orderNumber}`;
    const paymentStatus = status === "delivered" ? "paid" : status === "cancelled" ? "failed" : "pending";
    const order = await db.order.upsert({
      where: { id },
      update: { status, paymentStatus, total, updatedAt: new Date() },
      create: {
        id,
        companyId,
        contactId,
        orderNumber,
        status,
        subtotal,
        tax,
        total,
        currency: "XAF",
        paymentMethod,
        paymentStatus,
        createdById,
        createdAt: new Date(Date.now() - daysAgo * 86400000),
      },
    });
    stats.orders++;
    return order;
  }

  // ═══════════════════════════════════════════
  // 1. ENSURE COMPANIES
  // ═══════════════════════════════════════════
  const company1 = await upsertCompany(COMPANY_1_SLUG, "ChatCommerce Demo", {
    whatsappNumber: "+237612345678",
    phone: "+237612345678",
    address: "Douala, Cameroun",
  });

  // ═══════════════════════════════════════════
  // 2. ENSURE USERS per company
  // ═══════════════════════════════════════════
  const admin1 = await upsertUser(company1.id, "admin@chatcommerce.africa", "Administrateur Principal", "company_admin", "+237612345678", "Admin@2024");

  // ═══════════════════════════════════════════
  // 3. CATEGORIES & PRODUCTS — Company 1
  // ═══════════════════════════════════════════

  // --- Restaurant Le Baobab ---
  const catBaobab = await upsertCategory(company1.id, "Plats du jour", 1);
  const catBaobabBoisson = await upsertCategory(company1.id, "Boissons et accompagnements", 2);

  const baobabProducts = {
    pouletBraze: await upsertProduct(company1.id, "BBA-001", "Poulet braisé", 2500, catBaobab.id, 25),
    poissonGrille: await upsertProduct(company1.id, "BBA-002", "Poisson grillé", 3000, catBaobab.id, 15),
    rizAuGras: await upsertProduct(company1.id, "BBA-003", "Riz au gras", 1500, catBaobab.id, 40),
    jusNaturel: await upsertProduct(company1.id, "BBA-004", "Jus naturel", 1000, catBaobabBoisson.id, 50),
    plantainFrit: await upsertProduct(company1.id, "BBA-005", "Plantain frit", 800, catBaobabBoisson.id, 60),
  };

  // --- Salon Beauté Plus (via TelegramAgent + BusinessService) ---
  const salonAgent = await upsertTelegramAgent(company1.id, "Salon Beauté Plus", "salon_coiffure", "DEMO-SALON-TOKEN-001");
  const salonCoupe = await upsertBusinessService(salonAgent.id, "Coupe homme", 2000, 30, 1);
  const salonTresses = await upsertBusinessService(salonAgent.id, "Tresses", 5000, 120, 2);
  const salonBarbe = await upsertBusinessService(salonAgent.id, "Barbe", 1000, 15, 3);
  const salonManucure = await upsertBusinessService(salonAgent.id, "Manucure", 1500, 45, 4);

  // --- Pharmacie Centrale ---
  const catPharma = await upsertCategory(company1.id, "Médicaments", 3);
  const catPharmaPara = await upsertCategory(company1.id, "Paramédical", 4);

  const pharmaProducts = {
    paracetamol: await upsertProduct(company1.id, "PHA-001", "Paracétamol", 500, catPharma.id, 100),
    amoxicilline: await upsertProduct(company1.id, "PHA-002", "Amoxicilline", 1500, catPharma.id, 30),
    vitamineC: await upsertProduct(company1.id, "PHA-003", "Vitamine C", 800, catPharmaPara.id, 50),
    bandage: await upsertProduct(company1.id, "PHA-004", "Bandage", 300, catPharmaPara.id, 80),
    siropToux: await upsertProduct(company1.id, "PHA-005", "Sirop toux", 1200, catPharma.id, 40),
  };

  // --- Taxi Express (via TelegramAgent + BusinessService) ---
  const taxiAgent = await upsertTelegramAgent(company1.id, "Taxi Express", "taxi", "DEMO-TAXI-TOKEN-001");
  const taxiVille = await upsertBusinessService(taxiAgent.id, "Course ville", 1500, 30, 1);
  const taxiAeroport = await upsertBusinessService(taxiAgent.id, "Course aéroport", 5000, 60, 2);

  // --- Supermarché Saveur ---
  const catSuperAliment = await upsertCategory(company1.id, "Alimentation", 5);
  const catSuperHygiene = await upsertCategory(company1.id, "Hygiène et Soins", 6);

  const superProducts = {
    riz: await upsertProduct(company1.id, "SUP-001", "Riz 5kg", 3500, catSuperAliment.id, 50),
    huile: await upsertProduct(company1.id, "SUP-002", "Huile 1L", 2000, catSuperAliment.id, 45),
    savon: await upsertProduct(company1.id, "SUP-003", "Savon", 500, catSuperHygiene.id, 80),
    lait: await upsertProduct(company1.id, "SUP-004", "Lait 1L", 1500, catSuperAliment.id, 35),
    sucre: await upsertProduct(company1.id, "SUP-005", "Sucre 1kg", 1200, catSuperAliment.id, 40),
    pates: await upsertProduct(company1.id, "SUP-006", "Pâtes 500g", 800, catSuperAliment.id, 60),
  };

  // ═══════════════════════════════════════════
  // 4. CONTACTS — 12 for Company 1
  // ═══════════════════════════════════════════
  const contacts1: { id: string; name: string; phone: string }[] = [];
  const c1Data = [
    { name: "Jean-Pierre Mbarga", phone: "+237612345678", city: "Douala", tags: "vip,régulier" },
    { name: "Fatou Bamba", phone: "+237623456789", city: "Douala", tags: "nouveau" },
    { name: "Omar Diallo", phone: "+237634567890", city: "Douala", tags: "régulier" },
    { name: "Aïcha Touré", phone: "+237645678901", city: "Yaoundé", tags: "vip" },
    { name: "Kwame Asante", phone: "+237656789012", city: "Douala", tags: "nouveau,prospect" },
    { name: "Chantal Ngassa", phone: "+237667890123", city: "Yaoundé", tags: "régulier" },
    { name: "Moussa Keïta", phone: "+237678901234", city: "Douala", tags: "prospect" },
    { name: "Isabelle Ondo", phone: "+237689012345", city: "Bafoussam", tags: "nouveau" },
    { name: "Serge Nziengui", phone: "+237690123456", city: "Douala", tags: "régulier" },
    { name: "Rachida Compaoré", phone: "+237601234567", city: "Douala", tags: "vip,régulier" },
    { name: "Patrick Okwu", phone: "+237611234567", city: "Douala", tags: "prospect" },
    { name: "Mariama Bah", phone: "+237621234567", city: "Garoua", tags: "nouveau" },
  ];

  for (const c of c1Data) {
    const contact = await upsertContact(company1.id, c.phone, c.name, c.city, c.tags);
    contacts1.push(contact);
  }

  // ═══════════════════════════════════════════
  // 5. DRIVERS — 10 for Company 1
  // ═══════════════════════════════════════════
  const drivers: { id: string; name: string; vehicleType: string | null; status: string }[] = [];

  const driverData = [
    // 3 motorcycle
    { name: "Alain Kamga", phone: "+237650100001", vehicleType: "motorcycle", status: "available" },
    { name: "Brice Tchinda", phone: "+237650100002", vehicleType: "motorcycle", status: "busy" },
    { name: "Cédric Ngo", phone: "+237650100003", vehicleType: "motorcycle", status: "offline" },
    // 2 car
    { name: "David Nkoulou", phone: "+237650100004", vehicleType: "car", status: "available" },
    { name: "Emmanuel Mbeki", phone: "+237650100005", vehicleType: "car", status: "available" },
    // 2 bicycle
    { name: "Fabrice Nganou", phone: "+237650100006", vehicleType: "bicycle", status: "available" },
    { name: "Gabriel Ateba", phone: "+237650100007", vehicleType: "bicycle", status: "available" },
    // 3 foot
    { name: "Hervé Ngah", phone: "+237650100008", vehicleType: "foot", status: "available" },
    { name: "Ivan Foe", phone: "+237650100009", vehicleType: "foot", status: "available" },
    { name: "Joel Ngom", phone: "+237650100010", vehicleType: "foot", status: "available" },
  ];

  for (const d of driverData) {
    const driver = await upsertDriver(company1.id, d.phone, d.name, d.vehicleType, d.status);
    drivers.push(driver);
  }

  // ═══════════════════════════════════════════
  // 7. ORDERS — 20 across both companies
  // ═══════════════════════════════════════════

  // Company 1: 12 orders
  const c1OrderSpecs = [
    { contactIdx: 0, items: [{ prod: baobabProducts.pouletBraze, qty: 2 }, { prod: baobabProducts.rizAuGras, qty: 1 }], status: "delivered", daysAgo: 8, payment: "orange_money" },
    { contactIdx: 1, items: [{ prod: baobabProducts.poissonGrille, qty: 1 }, { prod: baobabProducts.plantainFrit, qty: 2 }], status: "delivered", daysAgo: 7, payment: "mtn_momo" },
    { contactIdx: 2, items: [{ prod: baobabProducts.pouletBraze, qty: 1 }, { prod: baobabProducts.jusNaturel, qty: 2 }], status: "delivered", daysAgo: 6, payment: "orange_money" },
    { contactIdx: 3, items: [{ prod: pharmaProducts.paracetamol, qty: 3 }, { prod: baobabProducts.jusNaturel, qty: 2 }], status: "delivered", daysAgo: 5, payment: "mtn_momo" },
    { contactIdx: 4, items: [{ prod: superProducts.riz, qty: 2 }, { prod: superProducts.huile, qty: 1 }], status: "confirmed", daysAgo: 2, payment: "orange_money" },
    { contactIdx: 5, items: [{ prod: baobabProducts.rizAuGras, qty: 1 }, { prod: baobabProducts.plantainFrit, qty: 3 }], status: "preparing", daysAgo: 1, payment: "mtn_momo" },
    { contactIdx: 6, items: [{ prod: pharmaProducts.amoxicilline, qty: 1 }, { prod: pharmaProducts.siropToux, qty: 2 }], status: "preparing", daysAgo: 1, payment: "orange_money" },
    { contactIdx: 7, items: [{ prod: superProducts.lait, qty: 3 }, { prod: superProducts.sucre, qty: 2 }], status: "ready", daysAgo: 0, payment: "mtn_momo" },
    { contactIdx: 8, items: [{ prod: superProducts.savon, qty: 5 }, { prod: superProducts.pates, qty: 4 }], status: "pending", daysAgo: 0, payment: "orange_money" },
    { contactIdx: 9, items: [{ prod: baobabProducts.poissonGrille, qty: 2 }, { prod: baobabProducts.pouletBraze, qty: 1 }], status: "pending", daysAgo: 0, payment: "mtn_momo" },
    { contactIdx: 10, items: [{ prod: pharmaProducts.vitamineC, qty: 2 }, { prod: pharmaProducts.bandage, qty: 4 }], status: "cancelled", daysAgo: 3, payment: "orange_money" },
    { contactIdx: 11, items: [{ prod: superProducts.riz, qty: 1 }, { prod: superProducts.pates, qty: 2 }], status: "cancelled", daysAgo: 4, payment: "mtn_momo" },
  ];

  for (let i = 0; i < c1OrderSpecs.length; i++) {
    const spec = c1OrderSpecs[i];
    const contact = contacts1[spec.contactIdx];
    const subtotal = spec.items.reduce((s, item) => s + item.prod.price * item.qty, 0);
    const tax = Math.round(subtotal * 0.1925);
    const total = subtotal + tax;
    const orderNumber = `CMD-${String(2001 + i).padStart(4, "0")}`;
    const order = await upsertOrder(
      company1.id, orderNumber, contact.id, spec.status,
      subtotal, tax, total, spec.payment,
      i % 2 === 0 ? admin1.id : admin1.id, spec.daysAgo
    );

    // Upsert order items
    for (const item of spec.items) {
      const itemId = `${order.id}-item-${item.prod.id}`;
      await db.orderItem.upsert({
        where: { id: itemId },
        update: {},
        create: {
          id: itemId,
          orderId: order.id,
          productId: item.prod.id,
          productName: item.prod.name,
          quantity: item.qty,
          unitPrice: item.prod.price,
          total: item.prod.price * item.qty,
        },
      });
    }
  }


  // ═══════════════════════════════════════════
  // 8. TELEGRAM BOOKINGS — 10 for Salon (Company 1)
  // ═══════════════════════════════════════════
  const bookingSpecs = [
    { chatId: "1001", customerName: "Jean-Pierre Mbarga", customerPhone: "+237612345678", service: salonTresses, date: "2025-01-20", time: "10:00", status: "completed" },
    { chatId: "1002", customerName: "Fatou Bamba", customerPhone: "+237623456789", service: salonCoupe, date: "2025-01-21", time: "14:00", status: "completed" },
    { chatId: "1003", customerName: "Aïcha Touré", customerPhone: "+237645678901", service: salonManucure, date: "2025-01-22", time: "09:30", status: "completed" },
    { chatId: "1004", customerName: "Chantal Ngassa", customerPhone: "+237667890123", service: salonTresses, date: "2025-01-23", time: "11:00", status: "cancelled" },
    { chatId: "1005", customerName: "Rachida Compaoré", customerPhone: "+237601234567", service: salonCoupe, date: daysFromNow(1), time: "15:00", status: "confirmed" },
    { chatId: "1006", customerName: "Isabelle Ondo", customerPhone: "+237689012345", service: salonBarbe, date: daysFromNow(2), time: "08:00", status: "confirmed" },
    { chatId: "1007", customerName: "Serge Nziengui", customerPhone: "+237690123456", service: salonManucure, date: daysFromNow(3), time: "16:30", status: "confirmed" },
    { chatId: "1008", customerName: "Patrick Okwu", customerPhone: "+237611234567", service: salonTresses, date: daysFromNow(5), time: "10:00", status: "pending" },
    { chatId: "1009", customerName: "Mariama Bah", customerPhone: "+237621234567", service: salonCoupe, date: daysFromNow(7), time: "13:00", status: "pending" },
    { chatId: "1010", customerName: "Omar Diallo", customerPhone: "+237634567890", service: salonBarbe, date: daysFromNow(10), time: "09:00", status: "pending" },
  ];

  for (const b of bookingSpecs) {
    const id = `${salonAgent.id}-booking-${b.chatId}`;
    await db.telegramBooking.upsert({
      where: { id },
      update: { status: b.status, bookingDate: b.date, bookingTime: b.time },
      create: {
        id,
        agentId: salonAgent.id,
        companyId: company1.id,
        chatId: b.chatId,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        serviceId: b.service.id,
        serviceName: b.service.name,
        bookingDate: b.date,
        bookingTime: b.time,
        status: b.status,
      },
    });
    stats.bookings++;
  }

  // ═══════════════════════════════════════════
  // 9. DELIVERIES — 5 for Company 1
  // ═══════════════════════════════════════════
  const c1Orders = await db.order.findMany({
    where: { companyId: company1.id },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  const deliverySpecs = [
    { orderIdx: 0, driverIdx: 0, status: "delivered", pickup: "Restaurant Le Baobab, Douala", delivery: "Bonapriso, Douala", fee: 500, earnings: 350, distance: 3.2, time: 15 },
    { orderIdx: 1, driverIdx: 1, status: "delivered", pickup: "Restaurant Le Baobab, Douala", delivery: "Makepé, Douala", fee: 700, earnings: 500, distance: 5.1, time: 20 },
    { orderIdx: 2, driverIdx: 3, status: "on_the_way", pickup: "Pharmacie Centrale, Douala", delivery: "Akwa, Douala", fee: 600, earnings: 420, distance: 2.8, time: 12 },
    { orderIdx: 3, driverIdx: 0, status: "picked_up", pickup: "Supermarché Saveur, Douala", delivery: "Bonabéri, Douala", fee: 1000, earnings: 700, distance: 8.5, time: 30 },
    { orderIdx: 4, driverIdx: 4, status: "assigned", pickup: "Restaurant Le Baobab, Douala", delivery: "Kotto, Douala", fee: 800, earnings: 560, distance: 4.7, time: 18 },
  ];

  for (let i = 0; i < deliverySpecs.length; i++) {
    const spec = deliverySpecs[i];
    const order = c1Orders[spec.orderIdx];
    if (!order) continue;
    const driver = drivers[spec.driverIdx];
    const id = `${company1.id}-delivery-${order.orderNumber}`;

    const pickedUpAt = (spec.status === "picked_up" || spec.status === "on_the_way" || spec.status === "delivered")
      ? new Date(Date.now() - 30 * 60000)
      : null;
    const deliveredAt = spec.status === "delivered"
      ? new Date(Date.now() - 15 * 60000)
      : null;

    await db.delivery.upsert({
      where: { id },
      update: { status: spec.status, driverId: driver.id },
      create: {
        id,
        companyId: company1.id,
        orderId: order.id,
        driverId: driver.id,
        pickupAddress: spec.pickup,
        deliveryAddress: spec.delivery,
        customerPhone: "+237612345678",
        customerName: "Client Demo",
        status: spec.status,
        fee: spec.fee,
        driverEarnings: spec.earnings,
        distance: spec.distance,
        estimatedTime: spec.time,
        pickedUpAt,
        deliveredAt,
      },
    });
    stats.deliveries++;
  }

  // ═══════════════════════════════════════════
  // 10. SUBSCRIPTIONS
  // ═══════════════════════════════════════════
  for (const [comp, plan] of [[company1, "business"]] as const) {
    const subId = `${comp.id}-subscription`;
    await db.subscription.upsert({
      where: { id: subId },
      update: {},
      create: {
        id: subId,
        companyId: comp.id,
        plan,
        status: "active",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
    });
  }

  // ═══════════════════════════════════════════
  // 11. AUTOMATIONS — Company 1
  // ═══════════════════════════════════════════
  const automations = [
    { type: "welcome", name: "Message de bienvenue", trigger: "conversation_created", message: "Bienvenue chez nous ! 🎉 Comment puis-je vous aider ?", delay: 0 },
    { type: "abandoned_order", name: "Relance commande abandonnée", trigger: "order_abandoned", message: "Votre panier vous attend ! Finalisez votre commande 🚚", delay: 60 },
    { type: "scheduled", name: "Confirmation de commande", trigger: "order_created", message: "Votre commande {order_number} est bien reçue ! Nous la préparons avec soin 🍽️", delay: 5 },
  ];

  for (const a of automations) {
    const autoId = `${company1.id}-auto-${a.type}`;
    await db.automation.upsert({
      where: { id: autoId },
      update: {},
      create: {
        id: autoId,
        companyId: company1.id,
        name: a.name,
        type: a.type,
        trigger: a.trigger,
        messageTemplate: a.message,
        isActive: true,
        delayMinutes: a.delay,
      },
    });
  }

  console.log("[SEED-DEMO] Complete:", JSON.stringify(stats, null, 2));
  return stats;
}
