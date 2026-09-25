"use server";

import { revalidatePath } from "next/cache";
import { prisma, withTx, type Tx } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, isGlobal, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { notify, inventoryAlertRecipients } from "@/lib/notify";
import { nextReceiptNumber } from "@/lib/ids";
import {
  receiptCreateSchema,
  receiptLinesSchema,
  receiptCompleteSchema,
  receiptLineRemoveSchema,
  splitLineMeta,
  withLineMeta,
} from "@/lib/validations/inventory";
import type { InventoryItem, PurchaseOrder } from "@/generated/prisma";

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export type ReceiptLineResult = { id: string; description: string; quantity: number };

export type ReceiptResult = { id: string; receiptNumber: string };

async function assertReceiptOpen(tx: Tx, receivingId: string) {
  const posted = await tx.inventoryTransaction.findFirst({
    where: { referenceType: "RECEIVING", referenceId: receivingId },
    select: { id: true },
  });
  if (posted) {
    throw new AppError("This receipt has already been completed.", { code: "ALREADY_COMPLETED" });
  }
}

async function loadReceiptOrThrow(id: string) {
  const receipt = await prisma.receiving.findUnique({ where: { id } });
  if (!receipt) throw new AppError("Receipt not found.", { status: 404, code: "NOT_FOUND" });
  return receipt;
}

async function assertItemsUsable(
  tx: Tx,
  lineIds: string[],
  siteId: string
): Promise<Map<string, InventoryItem>> {
  const unique = Array.from(new Set(lineIds));
  const items = await tx.inventoryItem.findMany({ where: { id: { in: unique } } });
  const byId = new Map(items.map((item) => [item.id, item]));

  for (const id of unique) {
    const item = byId.get(id);
    if (!item || item.deletedAt) {
      throw new AppError("One of the selected inventory items no longer exists.", {
        status: 404,
        code: "NOT_FOUND",
      });
    }
    if (item.siteId !== siteId) {
      throw new AppError(`${item.sku} belongs to a different site than this receipt.`, {
        code: "SITE_MISMATCH",
      });
    }
  }
  return byId;
}

export async function createReceipt(raw: unknown): Promise<ActionResult<ReceiptResult>> {
  return withAction(
    async () => {
      const input = receiptCreateSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
      assertSiteAccess(user, input.siteId);

      let receipt: { id: string; receiptNumber: string } | null = null;
      let attempts = 0;
      while (!receipt && attempts < 3) {
        attempts += 1;
        try {
          receipt = await withTx(async (tx) => {
            const site = await tx.site.findUnique({ where: { id: input.siteId }, select: { code: true } });
            if (!site) throw new AppError("Site not found.", { status: 404 });

            if (input.stockLocationId) {
              const location = await tx.stockLocation.findUnique({
                where: { id: input.stockLocationId },
                select: { siteId: true },
              });
              if (!location || location.siteId !== input.siteId) {
                throw new AppError("Stock location does not belong to the selected site.", {
                  code: "LOCATION_MISMATCH",
                });
              }
            }

            let po: PurchaseOrder | null = null;
            if (input.poId) {
              po = await tx.purchaseOrder.findUnique({ where: { id: input.poId } });
              if (!po) throw new AppError("Purchase order not found.", { status: 404 });
              if (po.siteId !== input.siteId) {
                throw new AppError("Purchase order belongs to a different site.", {
                  code: "SITE_MISMATCH",
                });
              }
              if (po.status === "CANCELLED") {
                throw new AppError("This purchase order is cancelled.", { code: "PO_CANCELLED" });
              }
              if (input.supplierId && input.supplierId !== po.supplierId) {
                throw new AppError("The supplier does not match the purchase order.", {
                  code: "SUPPLIER_MISMATCH",
                });
              }
            }

            const supplierId = input.supplierId || po?.supplierId || null;
            if (supplierId) {
              const supplier = await tx.supplier.findUnique({
                where: { id: supplierId },
                select: { id: true, deletedAt: true },
              });
              if (!supplier || supplier.deletedAt) {
                throw new AppError("Supplier not found.", { status: 404 });
              }
            }

            await assertItemsUsable(
              tx,
              input.lines.map((line) => line.inventoryItemId),
              input.siteId
            );

            const receiptNumber = await nextReceiptNumber(tx, site.code);
            const totalCost = round3(
              input.lines.reduce((sum, line) => sum + line.quantity * Number(line.unitCost ?? 0), 0)
            );

            return tx.receiving.create({
              data: {
                receiptNumber,
                poId: po?.id ?? null,
                supplierId,
                siteId: input.siteId,
                stockLocationId: input.stockLocationId || null,
                receivedById: user.id,
                deliveryDate: input.deliveryDate ? new Date(input.deliveryDate) : new Date(),
                invoiceNumber: input.invoiceNumber || null,
                referenceNumber: input.referenceNumber || null,
                totalCost,
                notes: input.notes || null,
                items: {
                  create: input.lines.map((line) => ({
                    kind: "CONSUMABLE",
                    inventoryItemId: line.inventoryItemId,
                    description: withLineMeta(line.description, {
                      condition: line.condition,
                      expiryDate: line.expiryDate,
                      batch: line.batch,
                    }),
                    quantity: line.quantity,
                    unitCost: Number(line.unitCost ?? 0),
                    totalCost: round3(line.quantity * Number(line.unitCost ?? 0)),
                  })),
                },
              },
              select: { id: true, receiptNumber: true },
            });
          });
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "P2002" && attempts < 3) continue;
          throw error;
        }
      }
      if (!receipt) throw new AppError("Could not allocate a receipt number. Please retry.");

      revalidatePath("/inventory/receive");
      return receipt;
    },
    { action: "createReceipt" }
  );
}

export async function addReceiptLines(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const input = receiptLinesSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
      const receipt = await loadReceiptOrThrow(input.id);
      assertSiteAccess(user, receipt.siteId);

      await withTx(async (tx) => {
        await assertReceiptOpen(tx, receipt.id);
        await assertItemsUsable(
          tx,
          input.lines.map((line) => line.inventoryItemId),
          receipt.siteId
        );

        const totalCost = round3(
          input.lines.reduce((sum, line) => sum + line.quantity * Number(line.unitCost ?? 0), 0)
        );

        await tx.receivingItem.createMany({
          data: input.lines.map((line) => ({
            receivingId: receipt.id,
            kind: "CONSUMABLE",
            inventoryItemId: line.inventoryItemId,
            description: withLineMeta(line.description, {
              condition: line.condition,
              expiryDate: line.expiryDate,
              batch: line.batch,
            }),
            quantity: line.quantity,
            unitCost: Number(line.unitCost ?? 0),
            totalCost: round3(line.quantity * Number(line.unitCost ?? 0)),
          })),
        });

        await tx.receiving.update({
          where: { id: receipt.id },
          data: { totalCost: { increment: totalCost } },
        });
      });

      revalidatePath("/inventory/receive");
      revalidatePath(`/inventory/receive/${receipt.id}`);
      return { id: receipt.id };
    },
    { action: "addReceiptLines", receivingId: String((raw as { id?: string })?.id ?? "") }
  );
}

export async function removeReceiptLine(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const input = receiptLineRemoveSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
      const receipt = await loadReceiptOrThrow(input.receivingId);
      assertSiteAccess(user, receipt.siteId);

      await withTx(async (tx) => {
        await assertReceiptOpen(tx, receipt.id);
        const line = await tx.receivingItem.findUnique({ where: { id: input.lineId } });
        if (!line || line.receivingId !== receipt.id) {
          throw new AppError("Receipt line not found.", { status: 404, code: "NOT_FOUND" });
        }
        await tx.receivingItem.delete({ where: { id: line.id } });
        await tx.receiving.update({
          where: { id: receipt.id },
          data: { totalCost: { decrement: Number(line.totalCost) } },
        });
      });

      revalidatePath(`/inventory/receive/${receipt.id}`);
      revalidatePath("/inventory/receive");
      return { id: receipt.id };
    },
    { action: "removeReceiptLine" }
  );
}

export async function completeReceipt(raw: unknown): Promise<ActionResult<ReceiptResult>> {
  return withAction(
    async () => {
      const input = receiptCompleteSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
      const receipt = await loadReceiptOrThrow(input.id);
      assertSiteAccess(user, receipt.siteId);

      const result = await withTx(async (tx) => {
        await assertReceiptOpen(tx, receipt.id);

        const lines = await tx.receivingItem.findMany({ where: { receivingId: receipt.id } });
        if (lines.length === 0) {
          throw new AppError("Add at least one line before completing this receipt.", {
            code: "NO_LINES",
          });
        }

        const items = await assertItemsUsable(
          tx,
          lines.flatMap((line) => (line.inventoryItemId ? [line.inventoryItemId] : [])),
          receipt.siteId
        );

        let postedLines = 0;
        for (const line of lines) {
          if (!line.inventoryItemId) continue;
          const item = items.get(line.inventoryItemId);
          if (!item) continue;

          const previous = round3(Number(item.currentQty));
          const balance = round3(previous + line.quantity);
          const locationId = receipt.stockLocationId ?? item.stockLocationId;

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { currentQty: balance, lastMovementAt: new Date() },
          });

          await tx.inventoryTransaction.create({
            data: {
              inventoryItemId: item.id,
              type: "RECEIVE",
              quantity: line.quantity,
              balanceAfter: balance,
              unitCost: Number(line.unitCost),
              toSiteId: receipt.siteId,
              toLocationId: locationId,
              performedById: user.id,
              referenceType: "RECEIVING",
              referenceId: receipt.id,
              notes: `${receipt.receiptNumber} · ${item.sku}`,
            },
          });
          postedLines += 1;
        }

        if (postedLines === 0) {
          throw new AppError("No receipt line is linked to an inventory item.", { code: "NO_LINES" });
        }

        if (receipt.poId) {
          const po = await tx.purchaseOrder.findUnique({
            where: { id: receipt.poId },
            include: { items: true },
          });
          if (po && po.items.length > 0) {
            const deltas = new Map<string, number>();
            for (const line of lines) {
              const base = splitLineMeta(line.description).text.trim().toLowerCase();
              const matches = po.items.filter(
                (candidate) => candidate.description.trim().toLowerCase() === base
              );
              const target =
                matches.find(
                  (candidate) =>
                    candidate.receivedQty + (deltas.get(candidate.id) ?? 0) < candidate.quantity
                ) ?? matches[0];
              if (target) {
                deltas.set(target.id, (deltas.get(target.id) ?? 0) + line.quantity);
              }
            }

            let fullyReceived = true;
            let anyReceived = false;
            for (const poItem of po.items) {
              const receivedQty = poItem.receivedQty + (deltas.get(poItem.id) ?? 0);
              if (receivedQty !== poItem.receivedQty) {
                await tx.purchaseOrderItem.update({
                  where: { id: poItem.id },
                  data: { receivedQty },
                });
              }
              if (receivedQty < poItem.quantity) fullyReceived = false;
              if (receivedQty > 0) anyReceived = true;
            }

            const updatable = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"];
            if (updatable.includes(po.status)) {
              const nextStatus = fullyReceived
                ? "RECEIVED"
                : anyReceived
                  ? "PARTIALLY_RECEIVED"
                  : po.status;
              if (nextStatus !== po.status) {
                await tx.purchaseOrder.update({
                  where: { id: po.id },
                  data: { status: nextStatus },
                });
              }
            }
          }
        }

        return { postedLines };
      });

      await recordAudit({
        userId: user.id,
        action: "STOCK_RECEIVED",
        entityType: "Receiving",
        entityId: receipt.id,
        siteId: receipt.siteId,
        description: `Completed receipt ${receipt.receiptNumber} (${result.postedLines} line${result.postedLines === 1 ? "" : "s"})`,
        newValue: {
          receiptNumber: receipt.receiptNumber,
          lines: result.postedLines,
          totalCost: Number(receipt.totalCost),
          poId: receipt.poId,
        },
        ip: await getClientIp(),
      });

      await notify({
        userIds: await inventoryAlertRecipients(receipt.siteId),
        type: "RECEIVING_COMPLETED",
        title: `Receipt ${receipt.receiptNumber} completed`,
        body: `${result.postedLines} line${result.postedLines === 1 ? "" : "s"} posted to stock.`,
        entityType: "Receiving",
        entityId: receipt.id,
        link: `/inventory/receive/${receipt.id}`,
      });

      revalidatePath("/inventory/receive");
      revalidatePath(`/inventory/receive/${receipt.id}`);
      revalidatePath("/inventory");
      return { id: receipt.id, receiptNumber: receipt.receiptNumber };
    },
    { action: "completeReceipt", receivingId: String((raw as { id?: string })?.id ?? "") }
  );
}

export type PurchaseOrderOption = {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  supplierId: string;
  supplierName: string;
  siteId: string;
  totalAmount: number;
  items: {
    id: string;
    description: string;
    quantity: number;
    receivedQty: number;
    unitCost: number;
  }[];
};

/** Open purchase orders available for receiving against, scoped to the caller's sites. */
export async function listPurchaseOrdersForPicker(siteId?: string): Promise<PurchaseOrderOption[]> {
  const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
  if (siteId) assertSiteAccess(user, siteId);
  const global = isGlobal(user);

  const orders = await prisma.purchaseOrder.findMany({
    where: {
      status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] },
      ...(global ? {} : { siteId: { in: user.siteIds } }),
      ...(siteId ? { siteId } : {}),
    },
    include: { supplier: { select: { name: true } }, items: true },
    orderBy: { orderDate: "desc" },
    take: 100,
  });

  return orders.map((po) => ({
    id: po.id,
    poNumber: po.poNumber,
    status: po.status,
    orderDate: po.orderDate.toISOString(),
    expectedDate: po.expectedDate ? po.expectedDate.toISOString() : null,
    supplierId: po.supplierId,
    supplierName: po.supplier?.name ?? "—",
    siteId: po.siteId,
    totalAmount: Number(po.totalAmount),
    items: po.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      receivedQty: item.receivedQty,
      unitCost: Number(item.unitCost),
    })),
  }));
}
