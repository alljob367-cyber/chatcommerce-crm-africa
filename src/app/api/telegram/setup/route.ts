import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";
import { checkPlanLimit, PLAN_LIMITS } from "@/lib/plan-limits";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── ALL 12 AGENT TEMPLATES ───
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
  // ─── 6 NOUVEAUX AGENTS ───
  {
    name: "Supermarché Afrimart",
    token: "PLACEHOLDER_SUPERMARCHE_TOKEN",
    botUsername: "afrimart_super_bot",
    businessType: "supermarche",
    welcomeMessage: "Bienvenue à Afrimart ! 🛒🥘\n\nCommandez vos courses en ligne.\nLivraison rapide à domicile ! 🚗",
    address: "Douala, Quartier Bali",
    phone: "+237 611 222 333",
    openHours: JSON.stringify({ lun: "07:00-21:00", mar: "07:00-21:00", mer: "07:00-21:00", jeu: "07:00-21:00", ven: "07:00-21:30", sam: "07:00-21:30", dim: "08:00-14:00" }),
    currency: "XAF",
    paymentMethod: "orange_money",
  },
  {
    name: "Clinique Vie Saine",
    token: "PLACEHOLDER_CLINIQUE_TOKEN",
    botUsername: "viesaine_clinic_bot",
    businessType: "clinique",
    welcomeMessage: "Bienvenue à la Clinique Vie Saine ! 🏥❤️\n\nPrenez rendez-vous avec nos médecins.\nConsultations, analyses et suivi médical !",
    address: "Douala, Quartier Bonanjo",
    phone: "+237 622 333 444",
    openHours: JSON.stringify({ lun: "07:00-19:00", mar: "07:00-19:00", mer: "07:00-19:00", jeu: "07:00-19:00", ven: "07:00-19:00", sam: "08:00-16:00", dim: "09:00-14:00" }),
    currency: "XAF",
    paymentMethod: "mtn_money",
  },
  {
    name: "Voyages & Destinations",
    token: "PLACEHOLDER_VOYAGE_TOKEN",
    botUsername: "voyages_dest_bot",
    businessType: "agence_voyage",
    welcomeMessage: "Bienvenue chez Voyages & Destinations ! ✈️🌍\n\nRéservez vos billets d'avion, hôtels et excursions.\nOffres exclusives toute l'année !",
    address: "Douala, Avenue de la Liberté",
    phone: "+237 644 555 666",
    openHours: JSON.stringify({ lun: "08:00-18:00", mar: "08:00-18:00", mer: "08:00-18:00", jeu: "08:00-18:00", ven: "08:00-18:00", sam: "09:00-14:00", dim: "Fermé" }),
    currency: "XAF",
    paymentMethod: "orange_money",
  },
  {
    name: "Boulangerie La Mie Dorée",
    token: "PLACEHOLDER_BOULANGERIE_TOKEN",
    botUsername: "miedoree_bakery_bot",
    businessType: "boulangerie",
    welcomeMessage: "Bienvenue à La Mie Dorée ! 🥖🥐\n\nCommandez votre pain frais et pâtisseries.\nRetrait sur place ou livraison ! 🚗",
    address: "Douala, Quartier Nylon",
    phone: "+237 666 777 888",
    openHours: JSON.stringify({ lun: "05:30-20:00", mar: "05:30-20:00", mer: "05:30-20:00", jeu: "05:30-20:00", ven: "05:30-21:00", sam: "05:30-21:00", dim: "06:00-14:00" }),
    currency: "XAF",
    paymentMethod: "orange_money",
  },
  {
    name: "Garage Auto Pro",
    token: "PLACEHOLDER_GARAGE_TOKEN",
    botUsername: "autoprogarage_bot",
    businessType: "garage_auto",
    welcomeMessage: "Bienvenue au Garage Auto Pro ! 🔧🚗\n\nRéservez votre entretien ou réparation.\nDevis instantané et suivi de votre véhicule !",
    address: "Douala, Quartier Ndokoti",
    phone: "+237 688 999 000",
    openHours: JSON.stringify({ lun: "07:30-18:30", mar: "07:30-18:30", mer: "07:30-18:30", jeu: "07:30-18:30", ven: "07:30-18:30", sam: "08:00-16:00", dim: "Fermé" }),
    currency: "XAF",
    paymentMethod: "mtn_money",
  },
  {
    name: "FitClub Douala",
    token: "PLACEHOLDER_SPORT_TOKEN",
    botUsername: "fitclub_dl_bot",
    businessType: "salle_sport",
    welcomeMessage: "Bienvenue au FitClub Douala ! 💪🏋️\n\nConsultez nos cours et inscrivez-vous.\nMusculation, yoga, cardio, zumba et plus !",
    address: "Douala, Quartier Kotto",
    phone: "+237 655 111 222",
    openHours: JSON.stringify({ lun: "06:00-22:00", mar: "06:00-22:00", mer: "06:00-22:00", jeu: "06:00-22:00", ven: "06:00-22:00", sam: "07:00-20:00", dim: "08:00-16:00" }),
    currency: "XAF",
    paymentMethod: "orange_money",
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
  supermarche: [
    { name: "Sac Riz 25kg", description: "Riz parfumé long grain, sac de 25 kg", price: 18000, duration: null, sortOrder: 1 },
    { name: "Huile de Palme 5L", description: "Huile de palme rouge authentique, bidon 5 litres", price: 5500, duration: null, sortOrder: 2 },
    { name: "Sardines Lot de 12", description: "Boîtes de sardines, lot de 12", price: 3600, duration: null, sortOrder: 3 },
    { name: "Pâte Haricots 500g", description: "Pâte d'arachide ou haricots, pot de 500g", price: 1500, duration: null, sortOrder: 4 },
    { name: "Concentré Tomate", description: "Concentré de tomates, lot de 6 sachets", price: 2000, duration: null, sortOrder: 5 },
    { name: "Poulet Congelé 1kg", description: "Poulet entier congelé, par kilo", price: 2800, duration: null, sortOrder: 6 },
    { name: "Poisson Machoiron 1kg", description: "Poisson fumé machoiron, par kilo", price: 3500, duration: null, sortOrder: 7 },
    { name: "Sucre 1kg", description: "Sucre blanc raffiné, paquet 1 kg", price: 900, duration: null, sortOrder: 8 },
    { name: "Lait en Poudre 400g", description: "Lait concentré en poudre Nestlé", price: 1800, duration: null, sortOrder: 9 },
    { name: "Savon Lot de 6", description: "Savon de Marseille, lot de 6", price: 2400, duration: null, sortOrder: 10 },
    { name: "Livraison Courses", description: "Livraison à domicile dans rayon de 5 km", price: 1000, duration: 60, sortOrder: 11 },
    { name: "Pack Famille Hebdo", description: "Courses familiales pour 1 semaine (varié)", price: 35000, duration: null, sortOrder: 12 },
  ],
  clinique: [
    { name: "Consultation Générale", description: "Consultation médecin généraliste", price: 5000, duration: 30, sortOrder: 1 },
    { name: "Consultation Spécialiste", description: "Consultation médecin spécialiste", price: 10000, duration: 30, sortOrder: 2 },
    { name: "Analyses de Sang", description: "Bilan sanguin complet (NFS, glycémie, cholestérol)", price: 8000, duration: null, sortOrder: 3 },
    { name: "Échographie", description: "Échographie abdominale ou pelvienne", price: 12000, duration: 20, sortOrder: 4 },
    { name: "Radiographie", description: "Radio thorax ou membre", price: 7000, duration: 15, sortOrder: 5 },
    { name: "Consultation Prénatale", description: "Suivi grossesse avec échographie", price: 15000, duration: 45, sortOrder: 6 },
    { name: "Vaccination", description: "Vaccin selon calendrier national", price: 3000, duration: 15, sortOrder: 7 },
    { name: "Test Paludisme", description: "TDR (Test de Diagnostic Rapide) paludisme", price: 2000, duration: 10, sortOrder: 8 },
    { name: "Consultation Pédiatrique", description: "Consultation pour enfants (-12 ans)", price: 5000, duration: 30, sortOrder: 9 },
    { name: "Soin Infirmier", description: "Injection, pansement, perfusion", price: 2000, duration: 20, sortOrder: 10 },
  ],
  agence_voyage: [
    { name: "Billet Avion Douala - Yaoundé", description: "Vol aller-retour Douala / Yaoundé", price: 35000, duration: null, sortOrder: 1 },
    { name: "Billet Avion Douala - Douala", description: "Vol domestique Aller simple", price: 25000, duration: null, sortOrder: 2 },
    { name: "Billet International Afrique", description: "Vol vers Abidjan, Libreville, Malabo...", price: 120000, duration: null, sortOrder: 3 },
    { name: "Billet International Europe", description: "Vol vers Paris, Bruxelles, Lyon...", price: 350000, duration: null, sortOrder: 4 },
    { name: "Hôtel Douala 1 Nuit", description: "Chambre double petit-déjeuner inclus", price: 25000, duration: null, sortOrder: 5 },
    { name: "Hôtel Yaoundé 1 Nuit", description: "Chambre double petit-déjeuner inclus", price: 22000, duration: null, sortOrder: 6 },
    { name: "Excursion Limbé", description: "Journée Mont Cameroun + plages, transport inclus", price: 15000, duration: null, sortOrder: 7 },
    { name: "Excursion Kribi", description: "Week-end chutes de la Lobé + plage, tout compris", price: 45000, duration: null, sortOrder: 8 },
    { name: "Visa Assistance", description: "Accompagnement visa Schengen, USA, Canada", price: 50000, duration: null, sortOrder: 9 },
    { name: "Assurance Voyage", description: "Assurance couverture médicale bagages", price: 15000, duration: null, sortOrder: 10 },
  ],
  boulangerie: [
    { name: "Baguette Tradition", description: "Baguette tradition française croustillante", price: 200, duration: null, sortOrder: 1 },
    { name: "Pain de Campagne", description: "Pain complet maison de 500g", price: 350, duration: null, sortOrder: 2 },
    { name: "Croissant Beurre", description: "Croissant au beurre pur charentais", price: 300, duration: null, sortOrder: 3 },
    { name: "Pain au Chocolat", description: "Pain au chocolat fondant", price: 350, duration: null, sortOrder: 4 },
    { name: "Chausson aux Pommes", description: "Chausson garni de compote de pommes", price: 300, duration: null, sortOrder: 5 },
    { name: "Beignet", description: "Beignet sucré enrobé de sucre", price: 100, duration: null, sortOrder: 6 },
    { name: "Brioche Tressée", description: "Brioche moelleuse tressée", price: 500, duration: null, sortOrder: 7 },
    { name: "Gâteau Chocolat", description: "Moelleux au chocolat (6 parts)", price: 3500, duration: null, sortOrder: 8 },
    { name: "Gâteau Anniversaire", description: "Gâteau personnalisé, décoration incluse", price: 10000, duration: null, sortOrder: 9 },
    { name: "Macarons (Boîte 12)", description: "Macarons artisanaux assortis", price: 6000, duration: null, sortOrder: 10 },
    { name: "Pack Petit-Déj", description: "2 croissants + 2 pains au chocolat + 1 brioche", price: 1200, duration: null, sortOrder: 11 },
  ],
  garage_auto: [
    { name: "Vidange Standard", description: "Vidange huile moteur + filtre", price: 15000, duration: 60, sortOrder: 1 },
    { name: "Vidange Complète", description: "Vidange + filtres (huile, air, habitacle)", price: 25000, duration: 90, sortOrder: 2 },
    { name: "Révision Générale", description: "Check-up complet du véhicule", price: 35000, duration: 120, sortOrder: 3 },
    { name: "Changement Pneus x2", description: "Montage et équilibrage de 2 pneus", price: 10000, duration: 60, sortOrder: 4 },
    { name: "Changement Pneus x4", description: "Montage et équilibrage de 4 pneus", price: 18000, duration: 90, sortOrder: 5 },
    { name: "Diagnostic Électronique", description: "Lecture et effacement codes défaut", price: 5000, duration: 30, sortOrder: 6 },
    { name: "Freinage Avant", description: "Remplacement plaquettes et disques avant", price: 45000, duration: 120, sortOrder: 7 },
    { name: "Batterie", description: "Remplacement batterie voiture standard", price: 40000, duration: 30, sortOrder: 8 },
    { name: "Climatisation", description: "Recharge et contrôle gaz climatisation", price: 20000, duration: 60, sortOrder: 9 },
    { name: "Dépannage 24h", description: "Service de dépannage et remorquage", price: 15000, duration: null, sortOrder: 10 },
  ],
  salle_sport: [
    { name: "Abonnement Mensuel", description: "Accès illimité musculation + cardio", price: 15000, duration: null, sortOrder: 1 },
    { name: "Abonnement Trimestriel", description: "3 mois accès illimité (économisez 10%)", price: 40000, duration: null, sortOrder: 2 },
    { name: "Abonnement Annuel", description: "12 mois accès illimité (économisez 25%)", price: 135000, duration: null, sortOrder: 3 },
    { name: "Cours de Yoga", description: "Séance de yoga (1h), tous niveaux", price: 3000, duration: 60, sortOrder: 4 },
    { name: "Cours de Zumba", description: "Séance de zumba fitness (1h)", price: 2500, duration: 60, sortOrder: 5 },
    { name: "Coaching Personnel", description: "Séance coaching individuel avec coach (1h)", price: 10000, duration: 60, sortOrder: 6 },
    { name: "Pack Musculation", description: "Programme personnalisé 3 mois + coaching", price: 75000, duration: null, sortOrder: 7 },
    { name: "Pack Minceur Femme", description: "Programme fitness + nutrition 2 mois", price: 60000, duration: null, sortOrder: 8 },
    { name: "Boxe / Arts Martiaux", description: "Cours de boxe ou muay thaï (1h)", price: 4000, duration: 60, sortOrder: 9 },
    { name: "Journée Découverte", description: "Pass journée pour tester toutes les activités", price: 2000, duration: null, sortOrder: 10 },
  ],
};

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Setup réservé à l'admin
    const isAdmin = session.role === "company_admin" || session.role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json({ error: "Acces refuse. Seul un administrateur peut creer des agents." }, { status: 403 });
    }

    const companyId = session.companyId;
    const body = await request.json();
    const agentType = body.agentType; // optional: create specific type

    // Check existing agents
    const existingAgents = await db.telegramAgent.findMany({ where: { companyId } });
    const existingTypes = existingAgents.map((a) => a.businessType);

    // Check plan limit BEFORE creating any agents
    const company = await db.company.findUnique({ where: { id: companyId }, select: { plan: true } });
    const currentCount = existingAgents.length;
    const limitError = checkPlanLimit(company?.plan || "starter", "maxTelegramAgents", currentCount);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 403 });
    }

    // Determine which agents to create
    let templatesToCreate = agentType
      ? AGENT_TEMPLATES.filter((t) => t.businessType === agentType && !existingTypes.includes(agentType))
      : AGENT_TEMPLATES.filter((t) => !existingTypes.includes(t.businessType));

    // Limit creation to the plan's maxTelegramAgents
    const maxAgents = (company?.plan && PLAN_LIMITS[company.plan]?.maxTelegramAgents) || PLAN_LIMITS.starter.maxTelegramAgents;
    const remaining = maxAgents - currentCount;
    if (remaining <= 0) {
      return NextResponse.json({ error: limitError }, { status: 403 });
    }
    if (templatesToCreate.length > remaining) {
      templatesToCreate = templatesToCreate.slice(0, remaining);
    }

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
