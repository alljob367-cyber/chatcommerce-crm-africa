import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { safePagination, handleError } from "@/lib/security";
import { notifyCustomerOrderStatus } from "@/lib/telegram-notifications";
import { checkPlanLimit } from "@/lib/plan-limits";

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

    // Check plan limit for orders
    const company = await db.company.findUnique({ where: { id: session.companyId }, select: { plan: true } });
    if (company) {
      const orderCount = await db.order.count({ where: { companyId: session.companyId } });
      const limitError = await checkPlanLimit(company.plan, "maxOrders", orderCount);
      if (limitError) {
        return NextResponse.json({ error: limitError }, { status: 403 });
      }
    }

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

    // ── Transaction: count + create order + items + decrement stock ──
    const order = await db.$transaction(async (tx) => {
      // Generate order number INSIDE transaction to prevent race conditions
      const orderCount = await tx.order.count({ where: { companyId: session.companyId } });
      const orderNumber = `CMD-${String(orderCount + 1001).padStart(4, "0")}`;

      // 1. Create the order
      const newOrder = await tx.order.create({
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

      // 2. Validate stock, create items, and decrement stock
      for (const item of itemData) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId: session.companyId },
        });
        if (!product || product.stock < item.quantity) {
          throw new Error(
            `Stock insuffisant pour ${product?.name || "produit"} (stock: ${product?.stock || 0})`
          );
        }

        // Decrement stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        // If stock reaches 0, deactivate the product
        const updatedProduct = await tx.product.findFirst({
          where: { id: item.productId },
        });
        if (updatedProduct && updatedProduct.stock <= 0) {
          await tx.product.update({
            where: { id: item.productId },
            data: { isActive: false },
          });
        }

        // Create the order item
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          },
        });
      }

      return newOrder;
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error: unknown) {
    // Handle stock errors with specific French message
    if (error instanceof Error && error.message.startsWith("Stock insuffisant")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
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

    const existing = await db.order.findFirst({
      where: { id, companyId: session.companyId },
      include: { items: true, contact: { select: { name: true, phone: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    const previousStatus = existing.status;

    // ── If order is being cancelled, restore stock ──
    if (status === "cancelled" && previousStatus !== "cancelled") {
      await db.$transaction(async (tx) => {
        // Update order status first
        await tx.order.update({
          where: { id },
          data: {
            status,
            ...(paymentStatus && { paymentStatus }),
            ...(notes !== undefined && { notes }),
          },
        });

        // Increment stock for each item and reactivate products if needed
        for (const item of existing.items) {
          const product = await tx.product.findFirst({
            where: { id: item.productId },
          });
          if (product) {
            const newStock = product.stock + item.quantity;
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: { increment: item.quantity },
                // Reactivate product if it was deactivated due to zero stock
                ...(newStock > 0 && !product.isActive ? { isActive: true } : {}),
              },
            });
          }
        }
      });

      // Fetch updated order for response
      const updatedOrder = await db.order.findFirst({
        where: { id, companyId: session.companyId },
        include: {
          contact: { select: { name: true, phone: true } },
          items: true,
        },
      });
      return NextResponse.json({ order: updatedOrder });
    }

    // ── Normal status update (not cancellation) ──
    const order = await db.order.update({
      where: { id },
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

    // ── Send Telegram notification on status change ──
    if (status && status !== previousStatus) {
      // Find delivery to get telegramChatId
      const delivery = await db.delivery.findFirst({
        where: { orderId: id },
        select: { telegramChatId: true },
      });

      if (delivery?.telegramChatId) {
        // Fire notification asynchronously (don't block response)
        notifyCustomerOrderStatus(
          delivery.telegramChatId,
          order.orderNumber,
          status,
          {
            customerName: order.contact.name,
            items: order.items.map((i) => `${i.quantity}x ${i.productName}`),
            total: order.total,
            currency: order.currency,
          }
        ).catch(() => {
          // Silently fail — notification is non-critical
        });
      }
    }

    return NextResponse.json({ order });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
