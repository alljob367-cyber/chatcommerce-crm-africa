const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://neondb_owner:npg_Vu1EqLD0fyxl@ep-icy-bar-ayw4j64r-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require'
    }
  }
});

async function main() {
  const COMPANY_ID = 'cmsrwbtcx0000l404gf1ky34w'; // BOT company

  // 1. Create the Telegram Agent
  const agent = await prisma.telegramAgent.create({
    data: {
      companyId: COMPANY_ID,
      name: 'A la Brasa - Braiseuse de Poisson',
      token: '8699939596:AAHYnRSWZ1kbFtanDGp8uqY390UJDCzj0HE',
      botUsername: 'Alabrasa_bot',
      businessType: 'braiseuse_poisson',
      isActive: true,
      welcomeMessage: 'Bienvenue chez A la Brasa ! Poisson braise au feu de bois, prepare avec amour. Commandez directement ici.',
      address: 'Douala, Cameroun',
      phone: '+237 6XX XXX XXX',
      currency: 'XAF',
      paymentMethod: 'orange_money',
      openHours: JSON.stringify({
        lun: '10:00-22:00',
        mar: '10:00-22:00',
        mer: '10:00-22:00',
        jeu: '10:00-22:00',
        ven: '10:00-23:00',
        sam: '10:00-23:00',
        dim: '12:00-21:00',
      }),
    },
  });
  console.log('Agent created:', agent.id, agent.name);

  // 2. Create services (menu de la braiseuse)
  const services = [
    { name: 'Poisson braise complet', description: 'Poisson braise au feu de bois avec plantain, macabo et epices', price: 2500, sortOrder: 1 },
    { name: 'Poisson braise demi', description: 'Demi poisson braise avec accompagnements', price: 1500, sortOrder: 2 },
    { name: 'Poisson braise simple', description: 'Poisson braise sans accompagnement', price: 1000, sortOrder: 3 },
    { name: 'Bar braise entier', description: 'Bar braise entier au feu de bois, sauce pimentee', price: 3500, sortOrder: 4 },
    { name: 'Maquereau braise', description: 'Maquereau braise grille avec legumes', price: 1800, sortOrder: 5 },
    { name: 'Tilapia braise', description: 'Tilapia braise croustillant avec alloco', price: 2000, sortOrder: 6 },
    { name: 'Poisson braise + boisson', description: 'Poisson braise complet avec boisson incluse', price: 3000, sortOrder: 7 },
    { name: 'Commande groupe (5 pers+)', description: 'Menu special pour groupe de 5 personnes ou plus', price: 10000, sortOrder: 8 },
  ];

  for (const svc of services) {
    await prisma.businessService.create({
      data: {
        agentId: agent.id,
        name: svc.name,
        description: svc.description,
        price: svc.price,
        sortOrder: svc.sortOrder,
        isActive: true,
      },
    });
    console.log('Service created:', svc.name, '-', svc.price, 'FCFA');
  }

  console.log('\n=== Configuration terminee ===');
  console.log('Agent ID:', agent.id);
  console.log('Bot: @Alabrasa_bot');
  console.log('Services:', services.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());