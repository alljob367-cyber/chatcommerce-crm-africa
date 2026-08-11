import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";

const CHARIOW_API_BASE = "https://api.chariow.com/v1";

// Prix des plans en FCFA
const PLAN_PRICES: Record<string, number> = {
  starter: 5000,
  pro: 14900,
  business: 29900,
  enterprise: 69900,
};

// IDs des produits Chariow (à configurer dans le dashboard Chariow)
// Mapping: plan → product_id Chariow
// Ces IDs sont obtenus après création des produits sur app.chariow.com
const CHARIOW_PRODUCT_IDS: Record<string, string | undefined> = {
  starter: process.env.CHARIOW_PRODUCT_STARTER,
  pro: process.env.CHARIOW_PRODUCT_PRO,
  business: process.env.CHARIOW_PRODUCT_BUSINESS,
  enterprise: process.env.CHARIOW_PRODUCT_ENTERPRISE,
};

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

    // 4. Vérifier le produit Chariow est configuré pour ce plan
    const productId = CHARIOW_PRODUCT_IDS[plan];
    if (!productId) {
      console.error(`[Chariow] Produit non configure pour le plan: ${plan}`);
      return NextResponse.json(
        { error: "Ce plan n'est pas encore disponible au paiement en ligne. Utilisez le Mobile Money." },
        { status: 400 }
      );
    }

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

    // Extraire le numéro de téléphone (sans le +)
    const phoneDigits = user.phone?.replace(/\D/g, "") || "";
    const phoneObject: { number?: string; country_code?: string } = {};
    if (phoneDigits) {
      phoneObject.number = phoneDigits;
      // Détecter le pays depuis le numéro
      if (phoneDigits.startsWith("237")) {
        phoneObject.country_code = "CM";
      } else if (phoneDigits.startsWith("228")) {
        phoneObject.country_code = "TG";
      } else if (phoneDigits.startsWith("229")) {
        phoneObject.country_code = "BJ";
      } else if (phoneDigits.startsWith("225")) {
        phoneObject.country_code = "CI";
      } else if (phoneDigits.startsWith("33")) {
        phoneObject.country_code = "FR";
      } else {
        phoneObject.country_code = "CM"; // Défaut: Cameroun
      }
    }

    // 8. Construire le corps de la requête Chariow
    const chariowBody: Record<string, unknown> = {
      product_id: productId,
      email: user.email,
      first_name: firstName,
      last_name: lastName,
    };

    if (phoneObject.number) {
      chariowBody.phone = phoneObject;
    }

    if (discountCode) {
      chariowBody.discount_code = discountCode;
    }

    // URL de redirection après paiement
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : "https://chatcommerce-africa.vercel.app";
    chariowBody.redirect_url = `${baseUrl}?payment=success&plan=${plan}`;

    // Métadonnées personnalisées pour le webhook
    chariowBody.custom_metadata = {
      company_id: payload.companyId,
      user_id: payload.userId,
      plan: plan,
      app: "chatcommerce-crm",
    };

    // IP du client (optionnel)
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("cf-connecting-ip")?.trim()
      || undefined;
    if (clientIp) {
      chariowBody.customer_ip = clientIp;
    }

    // 9. Appeler l'API Chariow
    console.log(`[Chariow] Initiation checkout pour plan=${plan}, user=${user.email}`);

    const chariowResponse = await fetch(`${CHARIOW_API_BASE}/checkout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${chariowKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chariowBody),
    });

    const chariowData = await chariowResponse.json();

    if (!chariowResponse.ok) {
      console.error(`[Chariow] Erreur API ${chariowResponse.status}:`, JSON.stringify(chariowData));
      return NextResponse.json(
        { error: chariowData.message || chariowData.error?.message || "Erreur lors de l'initiation du paiement" },
        { status: chariowResponse.status }
      );
    }

    // 10. Traiter la réponse selon le statut
    const purchase = chariowData.data?.purchase || chariowData.purchase || chariowData;
    const saleStatus = purchase.status || "awaiting_payment";

    // 11. Créer l'enregistrement en base
    const chariowOrder = await db.chariowOrder.create({
      data: {
        companyId: payload.companyId,
        userId: payload.userId,
        plan,
        amount: PLAN_PRICES[plan],
        currency: "XAF",
        status: saleStatus === "completed" ? "completed" : "pending",
        chariowSaleId: purchase.id || null,
        chariowTxnId: purchase.transaction_id || null,
        checkoutUrl: purchase.checkout_url || null,
        productId,
        customerEmail: user.email,
        customerPhone: user.phone || null,
        customerName: user.name,
        paymentCurrency: purchase.payment_currency || null,
        discountCode: discountCode || null,
        metadata: JSON.stringify(chariowBody.custom_metadata),
        paidAt: saleStatus === "completed" ? new Date() : null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    // 12. Retourner la réponse
    if (saleStatus === "completed") {
      // Produit gratuit — appliquer l'upgrade immédiatement
      return NextResponse.json({
        success: true,
        status: "completed",
        orderId: chariowOrder.id,
        plan,
        amount: chariowOrder.amount,
        message: "Paiement finalise avec succes !",
      });
    }

    if (saleStatus === "already_purchased") {
      return NextResponse.json({
        success: false,
        status: "already_purchased",
        error: "Vous avez deja active ce plan.",
      });
    }

    // Rediriger vers la page de paiement Chariow
    return NextResponse.json({
      success: true,
      status: "awaiting_payment",
      checkoutUrl: purchase.checkout_url,
      orderId: chariowOrder.id,
      chariowSaleId: purchase.id,
      amount: chariowOrder.amount,
      currency: chariowOrder.currency,
      plan,
    });

  } catch (error: unknown) {
    console.error("[Chariow] Erreur checkout:", error);
    const message = error instanceof Error ? error.message : "Erreur interne du serveur";
    return NextResponse.json({ error: message }, { status: 500 });
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
