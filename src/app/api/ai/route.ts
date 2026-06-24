import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, context, language } = body;

    // AI-powered response generation
    // In production, this would call OpenAI API
    // For demo, we provide intelligent context-aware responses
    const responses: Record<string, string[]> = {
      greeting: [
        "Bonjour ! Bienvenue chez notre établissement. Comment puis-je vous aider ? 😊",
        "Bonsoir ! Merci de nous contacter. Que désirez-vous commander ?",
        "Hello ! Nous sommes ravis de vous servir. Que puis-je faire pour vous ?",
      ],
      menu: [
        "Voici notre menu du jour :\n🥘 Poulet DG - 4 500 FCFA\n🍲 Ndolé - 3 500 FCFA\n🥘 Eru - 3 000 FCFA\n🍹 Jus de Mangue - 1 000 FCFA\nSouhaitez-vous commander ?",
      ],
      delivery: [
        "Nous livrons dans toute la ville ! 🚚\n- Livraison standard : 500 FCFA (45 min)\n- Livraison express : 1 000 FCFA (20 min)\nAcceptons Orange Money et MTN MoMo.",
      ],
      price: [
        "Nos prix sont très compétitifs :\n- Plats principaux : 2 000 - 5 000 FCFA\n- Boissons : 300 - 1 500 FCFA\n- Desserts : 500 - 2 500 FCFA\nTous les prix incluent la TVA.",
      ],
      hours: [
        "Nos horaires d'ouverture :\n📅 Lundi - Samedi : 9h00 - 22h00\n📅 Dimanche : 10h00 - 20h00\nNous sommes actuellement ouverts ! ✅",
      ],
      payment: [
        "Nous acceptons plusieurs méthodes de paiement :\n🟠 Orange Money\n🟡 MTN Mobile Money\n💰 Espèces\n💳 Carte (sur place uniquement)\nQuel mode préférez-vous ?",
      ],
      default: [
        "Merci pour votre message ! Je vais transférer votre demande à notre équipe. Un instant s'il vous plaît...",
        "Je comprends votre demande. Permettez-moi de vérifier cela pour vous. 🔍",
        "Bonne question ! Laissez-moi recueillir les informations nécessaires pour vous répondre au mieux.",
      ],
    };

    // Simple keyword matching
    const msg = (message || "").toLowerCase();
    let category = "default";
    if (msg.match(/bonjour|salut|hello|hi|bonsoir|good morning/)) category = "greeting";
    else if (msg.match(/menu|carte|plats|disponib|what do you have/)) category = "menu";
    else if (msg.match(/livraison|delivery|livrer|commander|commande/)) category = "delivery";
    else if (msg.match(/prix|price|coût|combien|tarif|cout/)) category = "price";
    else if (msg.match(/horaire|heure|ouverture|fermé|open|close/)) category = "hours";
    else if (msg.match(/paiement|payment|orange money|momo|payer/)) category = "payment";

    const options = responses[category];
    const reply = options[Math.floor(Math.random() * options.length)];

    return NextResponse.json({
      reply,
      category,
      confidence: category !== "default" ? 0.92 : 0.7,
      language: language || "fr",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}