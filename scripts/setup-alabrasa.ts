/**
 * Script pour configurer le bot "A la Brasa" dans la base de données
 * À exécuter après le déploiement sur Vercel avec la vraie DB Neon
 * 
 * OU via: npx tsx scripts/setup-alabrasa.ts
 */

import { PrismaClient } from "@prisma/client";

const BOT_TOKEN = "8699939596:AAHYnRSWZ1kbFtanDGp8uqY390UJDCzj0HE";
const BOT_USERNAME = "Alabrasa_bot";

async function main() {
  const db = new PrismaClient();

  // 1. Trouver ou créer la company
  let company = await db.company.findFirst({ where: { name: "ChatCommerce CRM Africa" } });
  if (!company) {
    console.error("Company non trouvée. Lancez l'app d'abord pour le bootstrap.");
    process.exit(1);
  }
  console.log(`Company: ${company.name} (id: ${company.id})`);

  // 2. Créer l'agent Telegram
  let agent = await db.telegramAgent.findFirst({ where: { token: BOT_TOKEN } });
  if (!agent) {
    agent = await db.telegramAgent.create({
      data: {
        companyId: company.id,
        name: "A la Brasa - Poisson Braisé",
        token: BOT_TOKEN,
        botUsername: BOT_USERNAME,
        businessType: "restaurant",
        address: "Cameroun",
        phone: "+237612345678",
        currency: "XAF",
        isActive: true,
        welcomeMessage: `🐟 Bienvenue chez **A la Brasa** !\nLe meilleur poisson braisé de la ville.\n\n/menu — Voir notre carte\n/commander — Passer commande\n/contact — Nos coordonnées\n/payer — Envoyer un numéro de transaction`,
        aiConfig: JSON.stringify({
          enabled: true,
          provider: "mistral",
          model: "mistral-small-latest",
          temperature: 0.7,
          maxTokens: 500,
          systemPrompt: `Tu es l'assistant virtuel de "A la Brasa", un restaurant de poisson braisé au Cameroun. Tu es amical, professionnel et connais bien le menu. Tu parles français et anglais. Les prix sont en FCFA. Guide les clients vers les commandes et le paiement Mobile Money.`
        }),
        openHours: JSON.stringify({
          mon: "10:00-22:00", tue: "10:00-22:00", wed: "10:00-22:00",
          thu: "10:00-22:00", fri: "10:00-22:00", sat: "10:00-22:00",
          sun: "12:00-21:00"
        }),
      },
    });
    console.log(`✅ Agent créé: ${agent.name} (id: ${agent.id})`);
  } else {
    console.log(`Agent existe déjà: ${agent.name} (id: ${agent.id})`);
  }

  // 3. Ajouter les services (menu)
  const services = [
    { name: "Poisson braisé entier (Bar/Macabou)", price: 3500, description: "Poisson entier braisé aux épices camerounaises, servi avec légumes", duration: 25 },
    { name: "Poisson braisé demi-portion", price: 2000, description: "Demi poisson braisé, idéal pour un repas léger", duration: 20 },
    { name: "Poisson braisé complet + Alloco", price: 4000, description: "Poisson entier braisé avec alloco (plantain frit)", duration: 25 },
    { name: "Poisson braisé complet + Chips", price: 4200, description: "Poisson entier braisé accompagné de chips de patate", duration: 25 },
    { name: "Menu Duo (2 poissons complets)", price: 7000, description: "2 poissons braisés complets avec accompagnements - prix réduit", duration: 30 },
    { name: "Menu Famille (4 personnes)", price: 13000, description: "4 poissons braisés + 2 alloco + 2 chips + sauce maison", duration: 35 },
    { name: "Sauce piquante maison", price: 200, description: "Sauce piquante artisanale à ajouter", duration: null },
    { name: "Alloco seul (accompagnement)", price: 500, description: "Plantain frit bien doré", duration: null },
    { name: "Boisson (Lot/Limonade)", price: 500, description: "Boisson fraîche", duration: null },
    { name: "Eau minérale", price: 200, description: "Bouteille 50cl", duration: null },
  ];

  for (const svc of services) {
    const existing = await db.businessService.findFirst({
      where: { agentId: agent.id, name: svc.name },
    });
    if (!existing) {
      await db.businessService.create({
        data: {
          agentId: agent.id,
          name: svc.name,
          price: svc.price,
          description: svc.description,
          duration: svc.duration,
          isActive: true,
          sortOrder: services.indexOf(svc),
        },
      });
      console.log(`  ✅ Service ajouté: ${svc.name} — ${svc.price} FCFA`);
    } else {
      console.log(`  ⏭️  Service existe: ${svc.name}`);
    }
  }

  console.log(`\n🎉 Bot "A la Brasa" configuré avec ${services.length} services !`);
  console.log(`📱 Telegram: @${BOT_USERNAME}`);
  console.log(`🔗 Webhook: https://my-project-eight-xi-94.vercel.app/api/telegram/webhook`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error("Erreur:", e);
  process.exit(1);
});
