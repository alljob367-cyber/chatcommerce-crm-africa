import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { safePagination, handleError } from "@/lib/security";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "";
    const contactId = searchParams.get("contactId") || "";
    const { page, limit, skip } = safePagination(searchParams.get("page"), searchParams.get("limit"));

    const where: Record<string, unknown> = { companyId: session.companyId };
    if (status && status !== "all") where.status = status;
    if (contactId) where.contactId = contactId;

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          contact: { select: { name: true, phone: true, avatar: true } },
          items: true,
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { contactId, items, notes, paymentMethod } = body;

    if (!contactId || !items || items.length === 0) {
      return NextResponse.json({ error: "Contact et articles requis" }, { status: 400 });
    }

    // H7 FIX: Validate prices from database, not client
    const itemData: { productId: string; productName: string; quantity: number; unitPrice: number; total: number }[] = [];
    let subtotal = 0;
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: "Donnees d'article invalides" }, { status: 400 });
      }
      const product = await db.product.findFirst({
        where: { id: item.productId, companyId: session.companyId, isActive: true },
      });
      if (!product) {
        return NextResponse.json({ error: `Produit ${item.productId} non trouve` }, { status: 404 });
      }
      const unitPrice = product.price;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      itemData.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        total: lineTotal,
      });
    }
    const tax = subtotal * 0.19;
    const total = subtotal + tax;

    // Generate order number
    const orderCount = await db.order.count({ where: { companyId: session.companyId } });
    const orderNumber = `CMD-${String(orderCount + 1001).padStart(4, "0")}`;

    const order = await db.order.create({
      data: {
        companyId: session.companyId,
        contactId,
        orderNumber,
        status: "pending",
        subtotal,
        tax,
        total,
        currency: "XAF",
        paymentMethod: paymentMethod || "orange_money",
        paymentStatus: "pending",
        notes,
        createdById: session.userId,
      },
    });

    for (const item of itemData) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        },
      });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = await request.json();
    const { id, status, paymentStatus, notes } = body;

    const order = await db.order.update({
      where: { id, companyId: session.companyId },
      data: {
        ...(status && { status }),
        ...(paymentStatus && { paymentStatus }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        contact: { select: { name: true, phone: true } },
        items: true,
      },
    });

    return NextResponse.json({ order });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}