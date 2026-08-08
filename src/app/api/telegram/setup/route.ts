import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── ALL 6 AGENT TEMPLATES ───
interface AgentTemplate {
  name: string;
  token: string;
  botUsername: string;
  businessType: string;
  welcomeMessage: string;
  address: string;
  phone: string;
  openHours: string;
  currency: string;
  paymentMethod: string;
  services: { name: string; description: string; price: number; duration: number | null; sortOrder: number }[];
}

const AGENT_TEMPLATES: Omit<AgentTemplate, "services">[] = [
  {
    name: "Restaurant Le Paradis",
    token: "PLACEHOLDER_RESTAURANT_TOKEN",
    botUsername: "leparadis_resto_bot",
    businessType: "restaurant",
    welcomeMessage: "Bienvenue au Restaurant Le Paradis ! 🍽️\n\nCommandez vos plats préférés directement ici.\nNous livrons à domicile ! 🚗",
    address: "Douala, Quartier Bonapriso",
    phone: "+237 612 345 678",
    openHours: JSON.stringify({ lun: "09:00-22:00", mar: "09:00-22:00", mer: "09:00-22:00", jeu: "09:00-22:00", ven: "09:00-23:00", sam: "10:00-23:00", dim: "11:00-21:00" }),
    currency: "XAF",
    paymentMethod: "orange_money",
  },
  {
    name: "Salon Élégance",
    token: "PLACEHOLDER_SALON_TOKEN",
    botUsername: "elegance_salon_bot",
    businessType: "salon_coiffure",
    welcomeMessage: "Bienvenue au Salon Élégance ! ✂️💅\n\nRéservez votre créneau en quelques clics.\nNos coiffeurs experts vous attendent !",
    address: "Douala, Quartier Akwa",
    phone: "+237 698 765 432",
    openHours: JSON.stringify({ lun: "08:00-19:00", mar: "08:00-19:00", mer: "08:00-19:00", jeu: "08:00-19:00", ven: "08:00-20:00", sam: "08:00-20:00", dim: "09:00-17:00" }),
    currency: "XAF",
    paymentMethod: "mtn_money",
  },
  {
    name: "Pharmacie SantéPlus",
    token: "PLACEHOLDER_PHARMACIE_TOKEN",
    botUsername: "santeplus_pharma_bot",
    businessType: "pharmacie",
    welcomeMessage: "Bienvenue à Pharmacie SantéPlus ! 💊🏥\n\nCommandez vos médicaments et produits de santé.\nVérification de disponibilité instantanée !",
    address: "Douala, Quartier Makepe",
    phone: "+237 633 111 222",
    openHours: JSON.stringify({ lun: "07:00-21:00", mar: "07:00-21:00", mer: "07:00-21:00", jeu: "07:00-21:00", ven: "07:00-21:00", sam: "08:00-20:00", dim: "09:00-18:00" }),
    currency: "XAF",
    paymentMethod: "orange_money",
  },
  {
    name: "ExpressTaxi Douala",
    token: "PLACEHOLDER_TAXI_TOKEN",
    botUsername: "expresstaxi_dl_bot",
    businessType: "taxi_transport",
    welcomeMessage: "Bienvenue chez ExpressTaxi ! 🚕\n\nRéservez votre course en quelques secondes.\nDevis instantané, suivi en temps réel !",
    address: "Douala (toute la ville)",
    phone: "+237 655 444 555",
    openHours: JSON.stringify({ lun: "05:00-23:00", mar: "05:00-23:00", mer: "05:00-23:00", jeu: "05:00-23:00", ven: "05:00-23:59", sam: "05:00-23:59", dim: "06:00-22:00" }),
    currency: "XAF",
    paymentMethod: "mtn_money",
  },
  {
    name: "Pressing CleanPro",
    token: "PLACEHOLDER_PRESSING_TOKEN",
    botUsername: "cleanpro_pressing_bot",
    businessType: "pressing_laverie",
    welcomeMessage: "Bienvenue au Pressing CleanPro ! 👔✨\n\nDéposez votre linge en un clic.\nSuivi de commande et livraison à domicile !",
    address: "Douala, Quartier Bonapriso",
    phone: "+237 677 888 999",
    openHours: JSON.stringify({ lun: "07:00-19:00", mar: "07:00-19:00", mer: "07:00-19:00", jeu: "07:00-19:00", ven: "07:00-20:00", sam: "08:00-18:00", dim: "Fermé" }),
    currency: "XAF",
    paymentMethod: "orange_money",
  },
  {
    name: "Académie ExcelPro",
    token: "PLACEHOLDER_ECOLE_TOKEN",
    botUsername: "excelpro_academy_bot",
    businessType: "ecole_formation",
    welcomeMessage: "Bienvenue à l'Académie ExcelPro ! 📚🎓\n\nConsultez nos formations et inscrivez-vous en ligne.\nEmploi du temps et paiements simplifiés !",
    address: "Douala, Quartier Deido",
    phone: "+237 699 222 333",
    openHours: JSON.stringify({ lun: "08:00-18:00", mar: "08:00-18:00", mer: "08:00-18:00", jeu: "08:00-18:00", ven: "08:00-17:00", sam: "09:00-13:00", dim: "Fermé" }),
    currency: "XAF",
    paymentMethod: "mtn_money",
  },
];

const ALL_SERVICES: Record<string, { name: string; description: string; price: number; duration: number | null; sortOrder: number }[]> = {
  restaurant: [
    { name: "Poulet DG", description: "Poulet à l'ail avec plantain frit et légumes", price: 4500, duration: null, sortOrder: 1 },
    { name: "Ndolé", description: "Épinards amers avec arachides et viande fumée", price: 3500, duration: null, sortOrder: 2 },
    { name: "Eru", description: "Feuilles d'eau avec viande de chèvre et poisson fumé", price: 3000, duration: null, sortOrder: 3 },
    { name: "Kondré", description: "Ragoût de plantain avec viande de bœuf", price: 2500, duration: null, sortOrder: 4 },
    { name: "Sanga", description: "Plat de maïs avec feuilles de manioc et poisson", price: 2000, duration: null, sortOrder: 5 },
    { name: "Poisson Braisé", description: "Poisson grillé à la sauce tomate oignon", price: 5000, duration: null, sortOrder: 6 },
    { name: "Riz au Gras", description: "Riz cuit avec légumes et viande", price: 2000, duration: null, sortOrder: 7 },
    { name: "Jus de Mangue Frais", description: "Jus de mangue naturel fait maison", price: 1000, duration: null, sortOrder: 8 },
    { name: "Bissap", description: "Jus d'hibiscus glacé", price: 800, duration: null, sortOrder: 9 },
    { name: "Ginger Juice", description: "Jus de gingembre frais pimenté", price: 900, duration: null, sortOrder: 10 },
    { name: "Beignets Haricots", description: "Beignets de haricots noirs, portion de 5", price: 500, duration: null, sortOrder: 11 },
    { name: "Eau Minérale", description: "Bouteille 1.5L", price: 400, duration: null, sortOrder: 12 },
  ],
  salon_coiffure: [
    { name: "Coupe Homme", description: "Coupe + barbe classique", price: 2000, duration: 30, sortOrder: 1 },
    { name: "Coupe Femme", description: "Coupe et coiffage", price: 3500, duration: 45, sortOrder: 2 },
    { name: "Tresses Classiques", description: "Tresses collées ou mèches", price: 5000, duration: 120, sortOrder: 3 },
    { name: "Tresses Collées", description: "Tresses collées avec rallonges", price: 8000, duration: 180, sortOrder: 4 },
    { name: "Vanilles / Twists", description: "Vanilles ou twists africains", price: 6000, duration: 120, sortOrder: 5 },
    { name: "Tissage", description: "Pose de tissage complet", price: 10000, duration: 150, sortOrder: 6 },
    { name: "Barbe", description: "Taille de barbe soignée", price: 1000, duration: 20, sortOrder: 7 },
    { name: "Coloration", description: "Coloration cheveux complète", price: 7000, duration: 90, sortOrder: 8 },
    { name: "Lissage Brésilien", description: "Traitement lissant longue durée", price: 15000, duration: 120, sortOrder: 9 },
    { name: "Soin Deep", description: "Soin profond nourrissant", price: 3000, duration: 40, sortOrder: 10 },
    { name: "Manucure", description: "Pose de vernis et soin des ongles", price: 2000, duration: 30, sortOrder: 11 },
    { name: "Pédicure", description: "Soin complet des pieds", price: 2500, duration: 45, sortOrder: 12 },
    { name: "Pack Mariée", description: "Coiffure + maquillage pour mariées", price: 25000, duration: 180, sortOrder: 13 },
    { name: "Pack Enfant", description: "Coupe enfant (moins de 12 ans)", price: 1500, duration: 25, sortOrder: 14 },
  ],
  pharmacie: [
    { name: "Consultation Pharmaceutique", description: "Conseil personnalisé avec le pharmacien", price: 500, duration: 15, sortOrder: 1 },
    { name: "Commande Médicaments", description: "Commande de médicaments sur ordonnance", price: 0, duration: null, sortOrder: 2 },
    { name: "PANSEMENTS & Soins", description: "Kit pansements, antiseptiques, compresses", price: 1500, duration: null, sortOrder: 3 },
    { name: "Vitamines & Suppléments", description: "Complexes vitaminiques et compléments alimentaires", price: 3500, duration: null, sortOrder: 4 },
    { name: "Produits Maternité", description: "Articles pour femmes enceintes et bébés", price: 5000, duration: null, sortOrder: 5 },
    { name: "Test COVID-19", description: "Test antigénique rapide", price: 3000, duration: 10, sortOrder: 6 },
    { name: "Tension Artérielle", description: "Mesure de la tension et conseil", price: 0, duration: 5, sortOrder: 7 },
    { name: "Produits Hygiène", description: "Gel hydroalcoolique, masques, savon", price: 1200, duration: null, sortOrder: 8 },
    { name: "Livraison à Domicile", description: "Livraison de médicaments dans un rayon de 5 km", price: 1000, duration: 60, sortOrder: 9 },
    { name: "Rappel de Traitement", description: "Service de rappel pour prises de médicaments", price: 0, duration: null, sortOrder: 10 },
  ],
  taxi_transport: [
    { name: "Course intra-ville", description: "Trajet court dans Douala (moins de 5 km)", price: 1500, duration: null, sortOrder: 1 },
    { name: "Course inter-quartier", description: "Trajet moyen (5-15 km)", price: 3000, duration: null, sortOrder: 2 },
    { name: "Course longue distance", description: "Trajet longue distance (+15 km)", price: 5000, duration: null, sortOrder: 3 },
    { name: "Aéroport", description: "Départ ou arrivée aéroport international", price: 8000, duration: null, sortOrder: 4 },
    { name: "Course nocturne", description: "Course entre 22h et 5h du matin", price: 4000, duration: null, sortOrder: 5 },
    { name: "Course VIP", description: "Véhicule confortable, climatisé, eau offerte", price: 6000, duration: null, sortOrder: 6 },
    { name: "Déménagement", description: "Transport de meubles et effets personnels", price: 15000, duration: null, sortOrder: 7 },
    { name: "Course Horaire", description: "Réservation pour une durée de 1 heure", price: 5000, duration: 60, sortOrder: 8 },
    { name: "Course Mensuelle", description: "Forfait 20 courses/mois, économisez 30%", price: 80000, duration: null, sortOrder: 9 },
  ],
  pressing_laverie: [
    { name: "Lavage chemise", description: "Lavage et repassage chemise", price: 500, duration: null, sortOrder: 1 },
    { name: "Lavage costume", description: "Nettoyage à sec costume complet", price: 3000, duration: null, sortOrder: 2 },
    { name: "Lavage robe", description: "Nettoyage délicat robe", price: 2000, duration: null, sortOrder: 3 },
    { name: "Lavage jean", description: "Lavage et repassage jean", price: 800, duration: null, sortOrder: 4 },
    { name: "Repassage seul", description: "Repassage de vêtements (par pièce)", price: 300, duration: null, sortOrder: 5 },
    { name: "Nettoyage tapis", description: "Nettoyage tapis et moquette", price: 5000, duration: null, sortOrder: 6 },
    { name: "Nettoyage rideaux", description: "Nettoyage rideaux et voilages", price: 4000, duration: null, sortOrder: 7 },
    { name: "Blanchisserie", description: "Lavage draps, serviettes, couvertures (par kg)", price: 1500, duration: null, sortOrder: 8 },
    { name: "Pack Formule Mensuelle", description: "10 lavages/mois au prix de 8", price: 4000, duration: null, sortOrder: 9 },
    { name: "Livraison Express 24h", description: "Livraison en moins de 24 heures", price: 1500, duration: null, sortOrder: 10 },
    { name: "Cuir & Maroquinerie", description: "Entretien sacs, chaussures, ceintures", price: 2500, duration: null, sortOrder: 11 },
  ],
  ecole_formation: [
    { name: "Inscription Formation", description: "Inscription annuelle à une formation", price: 50000, duration: null, sortOrder: 1 },
    { name: "Pack Informatique", description: "Word, Excel, PowerPoint, Internet (3 mois)", price: 75000, duration: null, sortOrder: 2 },
    { name: "Pack Langues", description: "Anglais ou Espagnol intensif (3 mois)", price: 90000, duration: null, sortOrder: 3 },
    { name: "Pack Marketing Digital", description: "Réseaux sociaux, SEO, Publicité en ligne", price: 120000, duration: null, sortOrder: 4 },
    { name: "Pack Comptabilité", description: "Initiation à la comptabilité et gestion", price: 85000, duration: null, sortOrder: 5 },
    { name: "Pack Cuisine & Pâtisserie", description: "Formation cuisine camerounaise et pâtisserie", price: 65000, duration: null, sortOrder: 6 },
    { name: "Pack Coiffure", description: "Formation professionnelle coiffure (6 mois)", price: 150000, duration: null, sortOrder: 7 },
    { name: "Atelier Weekend", description: "Atelier intensif samedi-dimanche", price: 15000, duration: null, sortOrder: 8 },
    { name: "Certification", description: "Passage de certification professionnelle", price: 25000, duration: null, sortOrder: 9 },
    { name: "Soutien Scolaire", description: "Cours particuliers Maths/Français (1 mois)", price: 30000, duration: null, sortOrder: 10 },
    { name: "Pack Entrepreneuriat", description: "Création d'entreprise, business plan", price: 100000, duration: null, sortOrder: 11 },
  ],
};

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const companyId = session.companyId;
    const body = await request.json();
    const agentType = body.agentType; // optional: create specific type

    // Check existing agents
    const existingAgents = await db.telegramAgent.findMany({ where: { companyId } });
    const existingTypes = existingAgents.map((a) => a.businessType);

    // Determine which agents to create
    const templatesToCreate = agentType
      ? AGENT_TEMPLATES.filter((t) => t.businessType === agentType && !existingTypes.includes(agentType))
      : AGENT_TEMPLATES.filter((t) => !existingTypes.includes(t.businessType));

    if (templatesToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: agentType ? `Agent ${agentType} déjà configuré` : "Tous les agents sont déjà configurés",
        agents: existingAgents.length,
      });
    }

    const created: { type: string; name: string; services: number }[] = [];

    for (const template of templatesToCreate) {
      const agent = await db.telegramAgent.create({
        data: {
          companyId,
          name: template.name,
          token: template.token,
          botUsername: template.botUsername,
          businessType: template.businessType,
          isActive: false,
          welcomeMessage: template.welcomeMessage,
          address: template.address,
          phone: template.phone,
          openHours: template.openHours,
          currency: template.currency,
          paymentMethod: template.paymentMethod,
        },
      });

      const services = ALL_SERVICES[template.businessType] || [];
      for (const svc of services) {
        await db.businessService.create({
          data: {
            agentId: agent.id,
            name: svc.name,
            description: svc.description,
            price: svc.price,
            duration: svc.duration,
            sortOrder: svc.sortOrder,
            isActive: true,
          },
        });
      }

      created.push({ type: template.businessType, name: template.name, services: services.length });
    }

    return NextResponse.json({
      success: true,
      message: `${created.length} agent(s) créé(s) avec succès !`,
      agents: created,
      totalAgents: existingAgents.length + created.length,
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
