import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { handleError } from "@/lib/security";

const CHARIOW_API_BASE = "https://api.chariow.com/v1";

// Prix des plans en FCFA
const PLAN_PRICES: Record<string, number> = {
  starter: 5000,
  pro: 14900,
  business: 29900,
  enterprise: 69900,
};

// ID produit Chariow unique (utilise pour tous les plans, le montant est passe dynamiquement)
const CHARIOW_PRODUCT_ID = process.env.CHARIOW_PRODUCT_STARTER || process.env.CHARIOW_PRODUCT_ID || "prd_9lchjpi5";

/**
 * POST /api/chariow/checkout
 * Initie un paiement Chariow pour un upgrade de plan
 * 
 * Body: { plan: "pro" }
 * Response: { checkoutUrl, orderId, chariowSaleId }
 */
export async function POST(request: Request) {
  try {
    // 1. Authentification
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // 2. Vérifier que la clé API Chariow est configurée
    const chariowKey = process.env.CHARIOW_API_KEY;
    if (!chariowKey) {
      console.error("[Chariow] CHARIOW_API_KEY non configuree");
      return NextResponse.json(
        { error: "Paiement en ligne non disponible. Contactez le support." },
        { status: 503 }
      );
    }

    // 3. Parser la requête
    const body = await request.json();
    const { plan, discountCode } = body;

    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: "Plan invalide. Choisissez: starter, pro, business, enterprise" },
        { status: 400 }
      );
    }

    // 4. Produit Chariow (unique pour tous les plans)
    const productId = CHARIOW_PRODUCT_ID;

    // 5. Récupérer les infos utilisateur et entreprise
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      include: { company: true },
    });

    if (!user || !user.company) {
      return NextResponse.json({ error: "Utilisateur non trouve" }, { status: 404 });
    }

    // 6. Vérifier qu'il n'y a pas une commande Chariow en cours pour ce plan
    const existingOrder = await db.chariowOrder.findFirst({
      where: {
        companyId: payload.companyId,
        userId: payload.userId,
        plan,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingOrder && existingOrder.checkoutUrl) {
      // Retourner l'URL existante si la commande est encore valide
      return NextResponse.json({
        success: true,
        checkoutUrl: existingOrder.checkoutUrl,
        orderId: existingOrder.id,
        chariowSaleId: existingOrder.chariowSaleId,
        amount: existingOrder.amount,
        currency: existingOrder.currency,
        plan: existingOrder.plan,
        message: "Vous avez une commande en cours. Vous serez redirige vers la page de paiement.",
      });
    }

    // 7. Préparer les données client pour Chariow
    const customerName = user.name.split(" ");
    const firstName = customerName[0] || "";
    const lastName = customerName.slice(1).join(" ") || "";

    // Extraire le numéro de téléphone (sans le +) — OBLIGATOIRE pour Chariow
    const phoneDigits = user.phone?.replace(/\D/g, "") || "";
    let countryCode = "CM"; // Défaut: Cameroun
    if (phoneDigits.startsWith("237")) countryCode = "CM";
    else if (phoneDigits.startsWith("228")) countryCode = "TG";
    else if (phoneDigits.startsWith("229")) countryCode = "BJ";
    else if (phoneDigits.startsWith("225")) countryCode = "CI";
    else if (phoneDigits.startsWith("33")) countryCode = "FR";

    // Si pas de téléphone, utiliser un numéro par défaut avec le pays de l'entreprise
    const finalPhone = phoneDigits || "690000000";
    const finalCountryCode = user.company?.country === "Togo" ? "TG"
      : user.company?.country === "Benin" ? "BJ"
      : user.company?.country === "Cote d'Ivoire" ? "CI"
      : user.company?.country === "France" ? "FR"
      : countryCode;

    // 8. Rediriger vers la boutique Chariow (produit pay-what-you-want)
    const storeDomain = process.env.CHARIOW_STORE_DOMAIN || "pvgxjrjr.mychariow.shop";
    const checkoutUrl = `https://${storeDomain}?email=${encodeURIComponent(user.email)}&plan=${plan}&company_id=${payload.companyId}&user_id=${payload.userId}`;

    console.log(`[Chariow] Redirection vers boutique pour plan=${plan}, user=${user.email}`);

    // 9. Créer l'enregistrement en base
    const chariowOrder = await db.chariowOrder.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        plan,
        amount: PLAN_PRICES[plan],
        currency: "XAF",
        status: "pending",
        productId,
        customerEmail: user.email,
        customerPhone: user.phone || null,
        customerName: user.name,
        checkoutUrl,
        metadata: JSON.stringify({ company_id: payload.companyId, user_id: payload.userId, plan, app: "chatcommerce-crm" }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // 10. Retourner l'URL de redirection
    return NextResponse.json({
      success: true,
      status: "awaiting_payment",
      checkoutUrl,
      orderId: chariowOrder.id,
      amount: chariowOrder.amount,
      currency: chariowOrder.currency,
      plan,
    });

  } catch (error: unknown) {
    console.error("[Chariow] Erreur checkout:", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * GET /api/chariow/checkout
 * Liste les commandes Chariow de l'utilisateur
 */
export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {
      companyId: payload.companyId,
      userId: payload.userId,
    };
    if (status) where.status = status;

    const orders = await db.chariowOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ orders });
  } catch (error: unknown) {
    console.error("[Chariow] Erreur liste:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
