import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const companyId = session.companyId;

    // Check if agents already exist for this company
    const existingAgents = await db.telegramAgent.findMany({
      where: { companyId },
    });

    if (existingAgents.length >= 2) {
      return NextResponse.json({ 
        success: true, 
        message: "Agents déjà configurés",
        agents: existingAgents.length 
      });
    }

    // ─── Create RESTAURANT Agent ───
    const restaurantAgent = await db.telegramAgent.create({
      data: {
        companyId,
        name: "Restaurant Le Paradis",
        token: "PLACEHOLDER_RESTAURANT_TOKEN",
        botUsername: "leparadis_resto_bot",
        businessType: "restaurant",
        isActive: false, // Will activate when real token is provided
        welcomeMessage: "Bienvenue au Restaurant Le Paradis ! 🍽️\n\nCommandez vos plats préférés directement ici.\nNous livrons à domicile ! 🚗",
        address: "Douala, Quartier Bonapriso",
        phone: "+237 612 345 678",
        openHours: JSON.stringify({
          lun: "09:00-22:00", mar: "09:00-22:00", mer: "09:00-22:00",
          jeu: "09:00-22:00", ven: "09:00-23:00", sam: "10:00-23:00", dim: "11:00-21:00"
        }),
        currency: "XAF",
        paymentMethod: "orange_money",
      },
    });

    // Restaurant services (plats camerounais)
    const restaurantServices = [
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
    ];

    for (const svc of restaurantServices) {
      await db.businessService.create({
        data: {
          agentId: restaurantAgent.id,
          name: svc.name,
          description: svc.description,
          price: svc.price,
          duration: svc.duration,
          sortOrder: svc.sortOrder,
          isActive: true,
        },
      });
    }

    // ─── Create SALON DE COIFFURE Agent ───
    const salonAgent = await db.telegramAgent.create({
      data: {
        companyId,
        name: "Salon Élégance",
        token: "PLACEHOLDER_SALON_TOKEN",
        botUsername: "elegance_salon_bot",
        businessType: "salon_coiffure",
        isActive: false,
        welcomeMessage: "Bienvenue au Salon Élégance ! ✂️💅\n\nRéservez votre créneau en quelques clics.\nNos coiffeurs experts vous attendent !",
        address: "Douala, Quartier Akwa",
        phone: "+237 698 765 432",
        openHours: JSON.stringify({
          lun: "08:00-19:00", mar: "08:00-19:00", mer: "08:00-19:00",
          jeu: "08:00-19:00", ven: "08:00-20:00", sam: "08:00-20:00", dim: "09:00-17:00"
        }),
        currency: "XAF",
        paymentMethod: "mtn_money",
      },
    });

    // Salon services
    const salonServices = [
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
    ];

    for (const svc of salonServices) {
      await db.businessService.create({
        data: {
          agentId: salonAgent.id,
          name: svc.name,
          description: svc.description,
          price: svc.price,
          duration: svc.duration,
          sortOrder: svc.sortOrder,
          isActive: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "2 agents pré-configurés créés avec succès !",
      agents: {
        restaurant: { id: restaurantAgent.id, name: restaurantAgent.name, services: restaurantServices.length },
        salon: { id: salonAgent.id, name: salonAgent.name, services: salonServices.length },
      },
    });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
