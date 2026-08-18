import { NextResponse } from "next/server";
import { resolveCompanyId, db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sanitize, handleError } from "@/lib/security";
import {
  notifyCustomerDeliveryStatus,
  notifyDriverNewDelivery,
  notifyDriverAssigned,
} from "@/lib/telegram-notifications";

export const dynamic = "force-dynamic";

async function auth(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return verifyToken(token);
}

// ─── GET: Single delivery with full details ────────────
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const { id } = await params;

    const delivery = await db.delivery.findFirst({
      where: { id, companyId: realCompanyId },
      include: {
        driver: {
          select: {
            id: true, name: true, phone: true, avatar: true,
            vehicleType: true, vehiclePlate: true, status: true,
            location: true, rating: true, totalDeliveries: true,
          },
        },
        order: {
          select: {
            id: true, orderNumber: true, total: true, currency: true,
            status: true, paymentStatus: true,
            items: { select: { productName: true, quantity: true, unitPrice: true } },
            contact: { select: { name: true, phone: true, avatar: true } },
          },
        },
        agent: {
          select: { id: true, name: true, botUsername: true, businessType: true },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true, action: true, details: true, createdAt: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!delivery) {
      return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    }

    return NextResponse.json({ delivery });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PUT: Update delivery status with validation ───────
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const { id } = await params;
    const body = await request.json();

    // Verify delivery belongs to company
    const existing = await db.delivery.findFirst({
      where: { id, companyId: realCompanyId },
      include: { driver: { select: { id: true, status: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Handle status transitions with validation
    if (body.status) {
      const VALID_TRANSITIONS: Record<string, string[]> = {
        pending: ["searching", "cancelled"],
        searching: ["assigned", "cancelled"],
        assigned: ["picked_up", "cancelled"],
        picked_up: ["on_the_way", "cancelled"],
        on_the_way: ["delivered"],
        delivered: [],
        cancelled: [],
      };

      const allowed = VALID_TRANSITIONS[existing.status];
      if (!allowed || !allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `Transition invalide: ${existing.status} → ${body.status}` },
          { status: 400 }
        );
      }

      updateData.status = body.status;

      // Set timestamps based on status
      if (body.status === "picked_up") updateData.pickedUpAt = new Date();
      if (body.status === "delivered") updateData.deliveredAt = new Date();
      if (body.status === "cancelled") {
        updateData.cancelledAt = new Date();
        updateData.cancelReason = body.cancelReason
          ? sanitize(body.cancelReason)
          : "Annulée manuellement";
      }
    }

    if (body.fee !== undefined) updateData.fee = Number(body.fee);
    if (body.driverEarnings !== undefined) updateData.driverEarnings = Number(body.driverEarnings);
    if (body.distance !== undefined) updateData.distance = Number(body.distance);
    if (body.estimatedTime !== undefined) updateData.estimatedTime = Number(body.estimatedTime);
    if (body.notes !== undefined) updateData.notes = body.notes ? sanitize(body.notes) : null;
    if (body.telegramChatId !== undefined) updateData.telegramChatId = body.telegramChatId || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Aucune donnée à mettre à jour" }, { status: 400 });
    }

    const newStatus = body.status as string | undefined;

    // If delivery is being completed, update driver stats
    if (newStatus === "delivered" && existing.driverId) {
      await db.$transaction([
        db.delivery.update({ where: { id }, data: updateData }),
        db.driver.update({
          where: { id: existing.driverId },
          data: {
            status: "available",
            totalDeliveries: { increment: 1 },
            totalEarnings: { increment: existing.driverEarnings },
          },
        }),
      ]);
    } else if (newStatus === "cancelled" && existing.driverId && existing.driver?.status === "busy") {
      // Release driver when delivery is cancelled
      await db.$transaction([
        db.delivery.update({ where: { id }, data: updateData }),
        db.driver.update({
          where: { id: existing.driverId },
          data: { status: "available" },
        }),
      ]);
    } else {
      await db.delivery.update({ where: { id }, data: updateData });
    }

    // ── Telegram notification on delivery status change ──
    if (newStatus && newStatus !== existing.status && existing.telegramChatId) {
      // Fetch order number for context
      const orderInfo = existing.orderId
        ? await db.order.findFirst({
            where: { id: existing.orderId },
            select: { orderNumber: true },
          })
        : null;
      const driverName = existing.driverId
        ? (await db.driver.findFirst({ where: { id: existing.driverId }, select: { name: true } }))?.name
        : undefined;

      notifyCustomerDeliveryStatus(
        existing.telegramChatId,
        orderInfo?.orderNumber,
        newStatus,
        driverName
      ).catch(() => {});
    }

    const updated = await db.delivery.findFirst({
      where: { id, companyId: realCompanyId },
      include: {
        driver: { select: { id: true, name: true, phone: true, vehicleType: true, status: true } },
        order: { select: { id: true, orderNumber: true, total: true } },
      },
    });

    return NextResponse.json({ delivery: updated });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}

// ─── PATCH: Special delivery actions ───────────────────
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth(request);
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const realCompanyId = await resolveCompanyId(session);

    const { id } = await params;
    const body = await request.json();
    const action = body.action;

    if (!action) {
      return NextResponse.json({ error: "Action requise" }, { status: 400 });
    }

    // ── search_drivers: Find available drivers near pickup ──
    if (action === "search_drivers") {
      const delivery = await db.delivery.findFirst({
        where: { id, companyId: realCompanyId },
      });
      if (!delivery) {
        return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
      }

      // Mark as searching
      await db.delivery.update({
        where: { id },
        data: { status: "searching" },
      });

      // ── Notify customer that we're searching for a driver ──
      if (delivery.telegramChatId) {
        const orderInfo = delivery.orderId
          ? await db.order.findFirst({
              where: { id: delivery.orderId },
              select: { orderNumber: true },
            })
          : null;
        notifyCustomerDeliveryStatus(
          delivery.telegramChatId,
          orderInfo?.orderNumber,
          "searching"
        ).catch(() => {});
      }

      // Find available drivers, ordered by rating (best first)
      const drivers = await db.driver.findMany({
        where: {
          companyId: realCompanyId,
          status: "available",
          isActive: true,
        },
        select: {
          id: true, name: true, phone: true, avatar: true,
          vehicleType: true, vehiclePlate: true, rating: true,
          totalDeliveries: true, location: true,
        },
        orderBy: { rating: "desc" },
        take: 10,
      });

      // If we have pickup coordinates and driver locations, sort by distance
      let sortedDrivers = drivers;
      if (delivery.pickupLat && delivery.pickupLng) {
        sortedDrivers = drivers
          .map((d) => {
            let dist: number | null = null;
            if (d.location && typeof d.location === "object") {
              const loc = d.location as { lat?: number; lng?: number };
              if (loc.lat && loc.lng) {
                // Haversine distance in km
                const R = 6371;
                const dLat = ((loc.lat - delivery.pickupLat!) * Math.PI) / 180;
                const dLng = ((loc.lng - delivery.pickupLng!) * Math.PI) / 180;
                const a =
                  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos((delivery.pickupLat! * Math.PI) / 180) *
                  Math.cos((loc.lat * Math.PI) / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
                dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              }
            }
            return { ...d, distance: dist };
          })
          .sort((a, b) => {
            // Sort by: has location first, then distance, then rating
            if (a.distance !== null && b.distance === null) return -1;
            if (a.distance === null && b.distance !== null) return 1;
            if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
            return b.rating - a.rating;
          });
      }

      return NextResponse.json({ drivers: sortedDrivers });
    }

    // ── assign_driver: Assign driver with double-accept protection ──
    if (action === "assign_driver") {
      const driverId = body.driverId;
      if (!driverId) {
        return NextResponse.json({ error: "ID chauffeur requis" }, { status: 400 });
      }

      try {
        const result = await db.$transaction(async (tx) => {
          // 1. Check delivery status is "searching" or "pending"
          const delivery = await tx.delivery.findFirst({
            where: { id, companyId: realCompanyId },
          });
          if (!delivery) throw new Error("NOT_FOUND");
          if (!["searching", "pending"].includes(delivery.status)) {
            throw new Error("INVALID_STATUS");
          }

          // 2. Check driver status is "available"
          const driver = await tx.driver.findFirst({
            where: { id: driverId, companyId: realCompanyId, isActive: true },
          });
          if (!driver) throw new Error("DRIVER_NOT_FOUND");
          if (driver.status !== "available") throw new Error("DRIVER_NOT_AVAILABLE");

          // 3. Atomically update both records
          const updatedDelivery = await tx.delivery.update({
            where: { id },
            data: {
              status: "assigned",
              driverId,
            },
            include: {
              driver: { select: { id: true, name: true, phone: true, vehicleType: true, status: true } },
              order: { select: { id: true, orderNumber: true, total: true } },
            },
          });

          await tx.driver.update({
            where: { id: driverId },
            data: { status: "busy" },
          });

          return updatedDelivery;
        });

        // ── Send Telegram notifications ──
        const fullDelivery = await db.delivery.findFirst({
          where: { id },
          select: {
            pickupAddress: true, deliveryAddress: true, driverEarnings: true,
            customerName: true, customerPhone: true, telegramChatId: true,
            driver: { select: { telegramId: true } },
            order: { select: { orderNumber: true } },
          },
        });

        // Notify driver about new delivery
        if (fullDelivery?.driver?.telegramId) {
          notifyDriverNewDelivery(fullDelivery.driver.telegramId, {
            id,
            orderNumber: fullDelivery.order?.orderNumber,
            pickupAddress: fullDelivery.pickupAddress,
            deliveryAddress: fullDelivery.deliveryAddress,
            driverEarnings: Number(fullDelivery.driverEarnings),
            customerName: fullDelivery.customerName,
            customerPhone: fullDelivery.customerPhone,
          }).catch(() => {});
        }

        // Notify customer that a driver is assigned
        if (fullDelivery?.telegramChatId) {
          notifyCustomerDeliveryStatus(
            fullDelivery.telegramChatId,
            fullDelivery.order?.orderNumber,
            "assigned",
            result.driver?.name
          ).catch(() => {});
        }

        return NextResponse.json({ delivery: result });
      } catch (txError: unknown) {
        const msg = txError instanceof Error ? txError.message : "UNKNOWN";
        if (msg === "NOT_FOUND") {
          return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
        }
        if (msg === "INVALID_STATUS") {
          return NextResponse.json({ error: "La livraison n'est plus disponible" }, { status: 409 });
        }
        if (msg === "DRIVER_NOT_FOUND") {
          return NextResponse.json({ error: "Chauffeur introuvable" }, { status: 404 });
        }
        if (msg === "DRIVER_NOT_AVAILABLE") {
          return NextResponse.json({ error: "Ce chauffeur n'est pas disponible" }, { status: 409 });
        }
        // Transaction conflict — another request won the race
        if (msg.includes("Prisma") || msg.includes("Unique")) {
          return NextResponse.json({ error: "Conflit: la livraison a déjà été assignée" }, { status: 409 });
        }
        throw txError;
      }
    }

    // ── driver_accept: Driver accepts delivery ──
    if (action === "driver_accept") {
      const driverId = body.driverId;
      if (!driverId) {
        return NextResponse.json({ error: "ID chauffeur requis" }, { status: 400 });
      }

      try {
        const result = await db.$transaction(async (tx) => {
          // 1. Find delivery with status "searching"
          const delivery = await tx.delivery.findFirst({
            where: { id, companyId: realCompanyId, status: "searching" },
          });
          if (!delivery) throw new Error("NOT_AVAILABLE");

          // 2. Verify driver is available
          const driver = await tx.driver.findFirst({
            where: { id: driverId, companyId: realCompanyId, isActive: true, status: "available" },
          });
          if (!driver) throw new Error("DRIVER_NOT_AVAILABLE");

          // 3. Atomically assign
          const updatedDelivery = await tx.delivery.update({
            where: { id },
            data: { status: "assigned", driverId },
            include: {
              driver: { select: { id: true, name: true, phone: true, vehicleType: true } },
            },
          });

          await tx.driver.update({
            where: { id: driverId },
            data: { status: "busy" },
          });

          return updatedDelivery;
        });

        // ── Send Telegram notifications ──
        const fullDelivery = await db.delivery.findFirst({
          where: { id },
          select: {
            pickupAddress: true, deliveryAddress: true, driverEarnings: true,
            customerName: true, customerPhone: true, telegramChatId: true,
            driver: { select: { telegramId: true, name: true } },
            order: { select: { orderNumber: true } },
          },
        });

        if (fullDelivery?.driver?.telegramId) {
          notifyDriverAssigned(fullDelivery.driver.telegramId, {
            id,
            orderNumber: fullDelivery.order?.orderNumber,
            pickupAddress: fullDelivery.pickupAddress,
            deliveryAddress: fullDelivery.deliveryAddress,
            driverEarnings: Number(fullDelivery.driverEarnings),
            customerName: fullDelivery.customerName,
            customerPhone: fullDelivery.customerPhone,
          }).catch(() => {});
        }

        if (fullDelivery?.telegramChatId) {
          notifyCustomerDeliveryStatus(
            fullDelivery.telegramChatId,
            fullDelivery.order?.orderNumber,
            "assigned",
            fullDelivery.driver?.name
          ).catch(() => {});
        }

        return NextResponse.json({ delivery: result });
      } catch (txError: unknown) {
        const msg = txError instanceof Error ? txError.message : "UNKNOWN";
        if (msg === "NOT_AVAILABLE") {
          return NextResponse.json({ error: "La livraison n'est plus disponible" }, { status: 409 });
        }
        if (msg === "DRIVER_NOT_AVAILABLE") {
          return NextResponse.json({ error: "Ce chauffeur n'est pas disponible" }, { status: 409 });
        }
        if (msg.includes("Prisma")) {
          return NextResponse.json({ error: "Un autre chauffeur a déjà accepté" }, { status: 409 });
        }
        throw txError;
      }
    }

    // ── driver_reject: Driver rejects delivery ──
    if (action === "driver_reject") {
      const delivery = await db.delivery.findFirst({
        where: { id, companyId: realCompanyId },
      });
      if (!delivery) {
        return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
      }

      // Delivery stays in "searching" so another driver can accept
      return NextResponse.json({ message: "Livraison marquée comme refusée, recherche continue" });
    }

    // ── pick_up: Mark as picked up ──
    if (action === "pick_up") {
      const delivery = await db.delivery.findFirst({
        where: { id, companyId: realCompanyId },
      });
      if (!delivery) {
        return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
      }
      if (!["assigned"].includes(delivery.status)) {
        return NextResponse.json(
          { error: `Impossible de marquer comme récupéré: statut actuel "${delivery.status}"` },
          { status: 400 }
        );
      }

      const updated = await db.delivery.update({
        where: { id },
        data: { status: "picked_up", pickedUpAt: new Date() },
        include: {
          driver: { select: { id: true, name: true, phone: true, vehicleType: true, status: true } },
          order: { select: { id: true, orderNumber: true, total: true } },
        },
      });

      // ── Notify customer ──
      if (delivery.telegramChatId) {
        notifyCustomerDeliveryStatus(
          delivery.telegramChatId,
          updated.order?.orderNumber,
          "picked_up"
        ).catch(() => {});
      }

      return NextResponse.json({ delivery: updated });
    }

    // ── start_delivery: Mark as on the way ──
    if (action === "start_delivery") {
      const delivery = await db.delivery.findFirst({
        where: { id, companyId: realCompanyId },
      });
      if (!delivery) {
        return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
      }
      if (!["picked_up"].includes(delivery.status)) {
        return NextResponse.json(
          { error: `Impossible de démarrer: statut actuel "${delivery.status}"` },
          { status: 400 }
        );
      }

      const updated = await db.delivery.update({
        where: { id },
        data: { status: "on_the_way" },
        include: {
          driver: { select: { id: true, name: true, phone: true, vehicleType: true, status: true } },
          order: { select: { id: true, orderNumber: true, total: true } },
        },
      });

      // ── Notify customer ──
      if (delivery.telegramChatId) {
        notifyCustomerDeliveryStatus(
          delivery.telegramChatId,
          updated.order?.orderNumber,
          "on_the_way"
        ).catch(() => {});
      }

      return NextResponse.json({ delivery: updated });
    }

    // ── complete: Mark as delivered ──
    if (action === "complete") {
      const delivery = await db.delivery.findFirst({
        where: { id, companyId: realCompanyId },
        include: { driver: { select: { id: true, status: true } } },
      });
      if (!delivery) {
        return NextResponse.json({ error: "Livraison introuvable" }, { status: 404 });
      }
      if (!["on_the_way"].includes(delivery.status)) {
        return NextResponse.json(
          { error: `Impossible de terminer: statut actuel "${delivery.status}"` },
          { status: 400 }
        );
      }

      const txResults = await db.$transaction([
        db.delivery.update({
          where: { id },
          data: { status: "delivered", deliveredAt: new Date() },
          include: {
            driver: { select: { id: true, name: true, phone: true, vehicleType: true, status: true } },
            order: { select: { id: true, orderNumber: true, total: true } },
          },
        }),
        ...(delivery.driverId && delivery.driver?.status === "busy"
          ? [
              db.driver.update({
                where: { id: delivery.driverId },
                data: {
                  status: "available",
                  totalDeliveries: { increment: 1 },
                  totalEarnings: { increment: delivery.driverEarnings },
                },
              }),
            ]
          : []),
      ]);

      // ── Notify customer ──
      if (delivery.telegramChatId) {
        const deliveredOrder = txResults[0] as { order?: { orderNumber?: string } | null };
        notifyCustomerDeliveryStatus(
          delivery.telegramChatId,
          deliveredOrder.order?.orderNumber,
          "delivered"
        ).catch(() => {});
      }

      return NextResponse.json({ delivery: txResults[0] });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (error: unknown) {
    const { error: msg, status } = handleError(error);
    return NextResponse.json({ error: msg }, { status });
  }
}
