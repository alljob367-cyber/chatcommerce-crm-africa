import { NextResponse } from "next/server";
import { resolveCompanyId, db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";
import { checkPlanLimit } from "@/lib/plan-limits";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session)
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const body = await request.json();
    const { action, agentId, productIds, serviceIds } = body;

    if (!action || !agentId) {
      return NextResponse.json(
        { error: "Action et agentId requis" },
        { status: 400 }
      );
    }

    // Verify the agent belongs to the company
    const agent = await db.telegramAgent.findFirst({
      where: { id: agentId, companyId: realCompanyId },
    });
    if (!agent) {
      return NextResponse.json(
        { error: "Agent introuvable ou n'appartient pas à votre entreprise" },
        { status: 404 }
      );
    }

    // Récupérer le plan de l'entreprise pour les vérifications de limites
    const user = await db.user.findUnique({
      where: { id: session.userId },
      include: { company: true },
    });
    const companyPlan = user?.company?.plan || "starter";

    if (action === "products_to_services") {
      return handleProductsToServices(
        realCompanyId,
        agentId,
        productIds || [],
        companyPlan
      );
    }

    if (action === "services_to_products") {
      return handleServicesToProducts(
        realCompanyId,
        agentId,
        serviceIds || [],
        companyPlan
      );
    }

    return NextResponse.json(
      { error: "Action invalide. Utilisez 'products_to_services' ou 'services_to_products'" },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("[API /sync]", error);
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─────────────────────────────────────────────
// Products → Telegram Services
// ─────────────────────────────────────────────
async function handleProductsToServices(
  companyId: string,
  agentId: string,
  productIds: string[],
  companyPlan: string
) {
  // Fetch active products for the company
  const where: Record<string, unknown> = {
    companyId,
    isActive: true,
  };
  if (productIds.length > 0) {
    where.id = { in: productIds };
  }

  const products = await db.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (products.length === 0) {
    return NextResponse.json({
      synced: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      message: "Aucun produit actif trouvé",
    });
  }

  // Fetch existing services for this agent
  const existingServices = await db.businessService.findMany({
    where: { agentId },
  });

  // Build a map by name (case-insensitive) for quick lookup
  const serviceByName = new Map(
    existingServices.map((s) => [s.name.toLowerCase(), s])
  );

  // Get max sort order for new services
  const maxSort = existingServices.reduce(
    (max, s) => Math.max(max, s.sortOrder),
    0
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let currentSort = maxSort;

  for (const product of products) {
    try {
      const existing = serviceByName.get(product.name.toLowerCase());

      if (existing) {
        // Check if update is needed
        if (
          existing.price !== product.price ||
          existing.description !== product.description ||
          existing.image !== product.image
        ) {
          await db.businessService.update({
            where: { id: existing.id },
            data: {
              price: product.price,
              description: product.description || null,
              image: product.image || null,
            },
          });
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Create new service
        currentSort++;
        await db.businessService.create({
          data: {
            agentId,
            name: sanitize(product.name),
            description: product.description
              ? sanitize(product.description)
              : null,
            price: product.price,
            duration: null,
            image: product.image || null,
            isActive: true,
            sortOrder: currentSort,
          },
        });
        created++;
      }
    } catch (err) {
      console.error(
        `[SYNC] Erreur lors de la synchronisation du produit ${product.id}:`,
        err
      );
      skipped++;
    }
  }

  return NextResponse.json({
    synced: created + updated,
    created,
    updated,
    skipped,
  });
}

// ─────────────────────────────────────────────
// Telegram Services → Products
// ─────────────────────────────────────────────
async function handleServicesToProducts(
  companyId: string,
  agentId: string,
  serviceIds: string[],
  companyPlan: string
) {
  // Fetch services for the agent
  const serviceWhere: Record<string, unknown> = { agentId };
  if (serviceIds.length > 0) {
    serviceWhere.id = { in: serviceIds };
  }

  const services = await db.businessService.findMany({
    where: serviceWhere,
    orderBy: { sortOrder: "asc" },
  });

  if (services.length === 0) {
    return NextResponse.json({
      synced: 0,
      created: 0,
      updated: 0,
      message: "Aucun service trouvé pour cet agent",
    });
  }

  // Fetch existing products for the company
  const existingProducts = await db.product.findMany({
    where: { companyId, isActive: true },
  });

  // Compter combien de NOUVEAUX produits seraient créés (pas les updates)
  const existingNames = new Set(existingProducts.map((p) => p.name.toLowerCase()));
  const newCount = services.filter((s) => !existingNames.has(s.name.toLowerCase())).length;

  if (newCount > 0) {
    const currentProductCount = existingProducts.length;
    const limitError = await checkPlanLimit(companyPlan, "maxProducts", currentProductCount + newCount);
    if (limitError) {
      return NextResponse.json({ error: limitError }, { status: 403 });
    }
  }

  // Build a map by name (case-insensitive)
  const productByName = new Map(
    existingProducts.map((p) => [p.name.toLowerCase(), p])
  );

  let created = 0;
  let updated = 0;

  for (const service of services) {
    try {
      const existing = productByName.get(service.name.toLowerCase());

      if (existing) {
        // Check if update is needed
        if (
          existing.price !== service.price ||
          existing.description !== service.description
        ) {
          await db.product.update({
            where: { id: existing.id },
            data: {
              price: service.price,
              description: service.description || null,
            },
          });
          updated++;
        }
        // else: already in sync, no action needed
      } else {
        // Create new product
        await db.product.create({
          data: {
            companyId,
            name: sanitize(service.name),
            description: service.description
              ? sanitize(service.description)
              : null,
            price: service.price,
            sku: `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            stock: 0,
            image: service.image || null,
            isActive: true,
          },
        });
        created++;
      }
    } catch (err) {
      console.error(
        `[SYNC] Erreur lors de l'import du service ${service.id}:`,
        err
      );
    }
  }

  return NextResponse.json({
    synced: created + updated,
    created,
    updated,
  });
}
