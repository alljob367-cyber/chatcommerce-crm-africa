import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function seedDatabase() {
  // Check if data already exists
  const existingCompany = await db.company.findFirst();
  if (existingCompany) return existingCompany;

  // Create company
  const company = await db.company.create({
    data: {
      name: "ChatCommerce Demo",
      slug: "chatcommerce-demo",
      country: "Cameroun",
      plan: "business",
      whatsappNumber: "+237612345678",
      maxContacts: 5000,
      maxAgents: 10,
    },
  });

  // Create users
  const adminPass = await hashPassword("admin123");
  const agentPass = await hashPassword("agent123");
  const managerPass = await hashPassword("manager123");

  const admin = await db.user.create({
    data: {
      email: "admin@chatcommerce.africa",
      passwordHash: adminPass,
      name: "Marie Nkoulou",
      phone: "+237612345678",
      role: "company_admin",
      emailVerified: true,
      companyId: company.id,
    },
  });

  const manager = await db.user.create({
    data: {
      email: "manager@chatcommerce.africa",
      passwordHash: managerPass,
      name: "Paul Essomba",
      phone: "+237698765432",
      role: "manager",
      emailVerified: true,
      companyId: company.id,
    },
  });

  const agent1 = await db.user.create({
    data: {
      email: "agent@chatcommerce.africa",
      passwordHash: agentPass,
      name: "Amina Diallo",
      phone: "+237655544433",
      role: "agent",
      emailVerified: true,
      companyId: company.id,
    },
  });

  // Create categories
  const cat1 = await db.category.create({
    data: { companyId: company.id, name: "Plats principaux", sortOrder: 1 },
  });
  const cat2 = await db.category.create({
    data: { companyId: company.id, name: "Boissons", sortOrder: 2 },
  });
  const cat3 = await db.category.create({
    data: { companyId: company.id, name: "Desserts", sortOrder: 3 },
  });
  const cat4 = await db.category.create({
    data: { companyId: company.id, name: "Produits locaux", sortOrder: 4 },
  });

  // Create products
  const products = [
    { name: "Poulet DG", price: 4500, categoryId: cat1.id, stock: 50 },
    { name: "Ndolé", price: 3500, categoryId: cat1.id, stock: 30 },
    { name: "Eru", price: 3000, categoryId: cat1.id, stock: 25 },
    { name: "Kondré", price: 2500, categoryId: cat1.id, stock: 20 },
    { name: "Sanga", price: 2000, categoryId: cat1.id, stock: 40 },
    { name: "Jus de Mangue Frais", price: 1000, categoryId: cat2.id, stock: 100 },
    { name: "Bissap", price: 800, categoryId: cat2.id, stock: 80 },
    { name: "Ginger Juice", price: 900, categoryId: cat2.id, stock: 60 },
    { name: "Beignets Haricots", price: 500, categoryId: cat3.id, stock: 200 },
    { name: "Gâteau Chocolat", price: 2500, categoryId: cat3.id, stock: 15 },
    { name: "Huile de Palme 1L", price: 1500, categoryId: cat4.id, stock: 100 },
    { name: "Piment Foufou", price: 300, categoryId: cat4.id, stock: 150 },
  ];

  for (const p of products) {
    await db.product.create({
      data: {
        companyId: company.id,
        ...p,
        sku: `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      },
    });
  }

  // Create contacts with African names and phone numbers
  const contacts = [
    { name: "Jean-Pierre Mbarga", phone: "+237671234567", city: "Douala", tags: "vip,régulier" },
    { name: "Fatou Bamba", phone: "+225071234567", city: "Abidjan", tags: "nouveau" },
    { name: "Omar Diallo", phone: "+221771234567", city: "Dakar", tags: "régulier" },
    { name: "Aïcha Touré", phone: "+22361234567", city: "Bamako", tags: "vip" },
    { name: "Kwame Asante", phone: "+233241234567", city: "Accra", tags: "nouveau,prospect" },
    { name: "Chantal Ngassa", phone: "+237699876543", city: "Yaoundé", tags: "régulier" },
    { name: "Moussa Keïta", phone: "+22370123456", city: "Bamako", tags: "prospect" },
    { name: "Isabelle Ondo", phone: "+240222123456", city: "Malabo", tags: "nouveau" },
    { name: "Serge Nziengui", phone: "+24106123456", city: "Libreville", tags: "régulier" },
    { name: "Rachida Compaoré", phone: "+22670123456", city: "Ouagadougou", tags: "vip,régulier" },
    { name: "Patrick Okwu", phone: "+2348012345678", city: "Lagos", tags: "prospect" },
    { name: "Mariama Bah", phone: "+22462123456", city: "Conakry", tags: "nouveau" },
    { name: "Yao Koffi", phone: "+225051234567", city: "Abidjan", tags: "régulier" },
    { name: "Ndeye Fatou Diop", phone: "+221781234567", city: "Dakar", tags: "vip" },
    { name: "Alain Moukouri", phone: "+24206123456", city: "Brazzaville", tags: "nouveau,prospect" },
  ];

  const createdContacts: Awaited<ReturnType<typeof db.contact.create>>[] = [];
  for (const c of contacts) {
    const contact = await db.contact.create({
      data: {
        companyId: company.id,
        source: "whatsapp",
        totalSpent: Math.random() * 500000 + 10000,
        orderCount: Math.floor(Math.random() * 20) + 1,
        lastMessageAt: new Date(Date.now() - Math.random() * 7 * 86400000),
        lastSeenAt: new Date(Date.now() - Math.random() * 3 * 86400000),
        ...c,
      },
    });
    createdContacts.push(contact);
  }

  // Create conversations and messages
  const statuses = ["new", "open", "waiting", "closed"];
  const sampleMessages = [
    "Bonjour, je voudrais commander du Poulet DG pour ce soir",
    "Est-ce que le Ndolé est disponible ?",
    "Quel est le prix de votre menu complet ?",
    "Je veux réserver une table pour 4 personnes",
    "Bonjour, pouvez-vous me livrer à Makepé ?",
    "Le Bissap est-il fait maison ?",
    "Combien de temps pour une livraison à Bonapriso ?",
    "Je voudrais passer une commande groupée pour mon entreprise",
    "Est-ce que vous acceptez Orange Money ?",
    "Bonjour, j'ai une question sur votre carte",
    "Merci pour la commande d'hier, c'était délicieux !",
    "Pouvez-vous me faire un prix pour 50 beignets ?",
    "Quels sont vos horaires d'ouverture ?",
    "Je souhaite devenir client régulier, avez-vous des offres ?",
    "Le poulet DG est en rupture ? Quand sera-t-il dispo ?",
  ];

  for (let i = 0; i < createdContacts.length; i++) {
    const contact = createdContacts[i];
    const status = statuses[i % statuses.length];

    const conversation = await db.conversation.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        status,
        assignedToId:
          i % 3 === 0
            ? agent1.id
            : i % 3 === 1
              ? manager.id
              : admin.id,
        lastMessage: sampleMessages[i],
        lastMessageAt: new Date(Date.now() - Math.random() * 86400000),
        unreadCount: i % 4 === 0 ? Math.floor(Math.random() * 5) + 1 : 0,
      },
    });

    // Create 2-5 messages per conversation
    const msgCount = Math.floor(Math.random() * 4) + 2;
    for (let j = 0; j < msgCount; j++) {
      await db.message.create({
        data: {
          conversationId: conversation.id,
          body:
            j === 0
              ? sampleMessages[i]
              : j % 2 === 1
                ? "Bien sûr, je vérifie cela pour vous. Un instant s'il vous plaît."
                : "Merci ! J'attends votre réponse.",
          direction: j % 2 === 0 ? "inbound" : "outbound",
          senderType: j % 2 === 0 ? "customer" : "agent",
          senderId: j % 2 === 1 ? agent1.id : null,
          isRead: j < msgCount - 1,
          createdAt: new Date(Date.now() - (msgCount - j) * 3600000),
        },
      });
    }
  }

  // Create orders
  const orderStatuses = ["pending", "confirmed", "preparing", "delivered", "cancelled"];
  const allProducts = await db.product.findMany({
    where: { companyId: company.id },
  });

  for (let i = 0; i < 10; i++) {
    const contact = createdContacts[i % createdContacts.length];
    const product1 = allProducts[i % allProducts.length];
    const product2 = allProducts[(i + 3) % allProducts.length];
    const qty1 = Math.floor(Math.random() * 5) + 1;
    const qty2 = Math.floor(Math.random() * 3) + 1;
    const subtotal = product1.price * qty1 + product2.price * qty2;
    const total = subtotal * 1.19; // 19% tax
    const status = orderStatuses[i % orderStatuses.length];

    const order = await db.order.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        orderNumber: `CMD-${String(i + 1001).padStart(4, "0")}`,
        status,
        subtotal,
        tax: subtotal * 0.19,
        total,
        currency: "XAF",
        paymentMethod: i % 2 === 0 ? "orange_money" : "mtn_momo",
        paymentStatus: status === "delivered" ? "paid" : "pending",
        createdById: i % 3 === 0 ? admin.id : agent1.id,
        createdAt: new Date(Date.now() - (10 - i) * 86400000),
      },
    });

    await db.orderItem.create({
      data: {
        orderId: order.id,
        productId: product1.id,
        productName: product1.name,
        quantity: qty1,
        unitPrice: product1.price,
        total: product1.price * qty1,
      },
    });

    await db.orderItem.create({
      data: {
        orderId: order.id,
        productId: product2.id,
        productName: product2.name,
        quantity: qty2,
        unitPrice: product2.price,
        total: product2.price * qty2,
      },
    });
  }

  // Create automations
  await db.automation.createMany({
    data: [
      {
        companyId: company.id,
        name: "Message de bienvenue",
        type: "welcome",
        trigger: "conversation_created",
        messageTemplate:
          "Bonjour ! Bienvenue chez {company_name} 🎉 Comment puis-je vous aider aujourd'hui ?",
        isActive: true,
        delayMinutes: 0,
      },
      {
        companyId: company.id,
        name: "Relance commande abandonnée",
        type: "abandoned_order",
        trigger: "order_abandoned",
        messageTemplate:
          "Bonjour {contact_name}, votre panier vous attend ! Finalisez votre commande et profitez de la livraison gratuite 🚚",
        isActive: true,
        delayMinutes: 60,
      },
      {
        companyId: company.id,
        name: "Réactivation client inactif",
        type: "reactivation",
        trigger: "customer_inactive",
        messageTemplate:
          "Ça fait longtemps {contact_name} ! Nous vous manquons 😊 Profitez de -20% sur votre prochaine commande avec le code BIENVENUE20",
        isActive: true,
        delayMinutes: 0,
      },
    ],
  });

  // Create leads
  for (let i = 0; i < 5; i++) {
    const leadStatuses = ["new", "contacted", "qualified", "converted", "lost"];
    await db.lead.create({
      data: {
        companyId: company.id,
        contactId: createdContacts[i + 10]?.id || createdContacts[i].id,
        status: leadStatuses[i],
        source: "whatsapp",
        value: Math.random() * 200000 + 50000,
        notes: "Prospect intéressé par nos services de livraison",
        assignedToId: [admin.id, manager.id, agent1.id][i % 3],
      },
    });
  }

  // Create subscription
  await db.subscription.create({
    data: {
      companyId: company.id,
      plan: "business",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  return company;
}