import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { rateLimit, handleError } from "@/lib/security";

// C3 FIX: AI endpoint now requires authentication + rate limiting
export async function POST(request: Request) {
  try {
    // Auth check
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Rate limit: 20 requests per minute per user
    const rl = rateLimit(`ai:${payload.userId}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Trop de requetes. Veuillez patienter." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, context, language } = body;

    const responses: Record<string, string[]> = {
      greeting: [
        "Bonjour ! Bienvenue chez notre etablissement. Comment puis-je vous aider ?",
        "Bonsoir ! Merci de nous contacter. Que desirez-vous commander ?",
        "Hello ! Nous sommes ravis de vous servir. Que puis-je faire pour vous ?",
      ],
      menu: [
        "Voici notre menu du jour :\nPoulet DG - 4 500 FCFA\nNdole - 3 500 FCFA\nEru - 3 000 FCFA\nJus de Mangue - 1 000 FCFA\nSouhaitez-vous commander ?",
      ],
      delivery: [
        "Nous livrons dans toute la ville !\n- Livraison standard : 500 FCFA (45 min)\n- Livraison express : 1 000 FCFA (20 min)\nAcceptons Orange Money et MTN MoMo.",
      ],
      price: [
        "Nos prix sont tres competitifs :\n- Plats principaux : 2 000 - 5 000 FCFA\n- Boissons : 300 - 1 500 FCFA\n- Desserts : 500 - 2 500 FCFA\nTous les prix incluent la TVA.",
      ],
      hours: [
        "Nos horaires d'ouverture :\nLundi - Samedi : 9h00 - 22h00\nDimanche : 10h00 - 20h00\nNous sommes actuellement ouverts !",
      ],
      payment: [
        "Nous acceptons plusieurs methodes de paiement :\n- Orange Money\n- MTN Mobile Money\n- Especes\n- Carte (sur place uniquement)\nQuel mode preferez-vous ?",
      ],
      default: [
        "Merci pour votre message ! Je vais transferrer votre demande a notre equipe. Un instant s'il vous plait...",
        "Je comprends votre demande. Permettez-moi de verifier cela pour vous.",
        "Bonne question ! Laissez-moi recueillir les informations necessaires pour vous repondre au mieux.",
      ],
    };

    const msg = ((message || "") as string).toLowerCase();
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
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}