"use server";

import { revalidatePath } from "next/cache";
import { prisma, withTx, type Tx } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, isGlobal, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { notify, inventoryAlertRecipients } from "@/lib/notify";
import {
  stockIssueSchema,
  stockConsumeSchema,
  stockAdjustSchema,
  stockReplenishSchema,
  inventoryItemCreateSchema,
  inventoryItemUpdateSchema,
} from "@/lib/validations/inventory";
import type { InventoryItem, StockTxType } from "@/generated/prisma";

const round3 = (value: number) => Math.round(value * 1000) / 1000;

function notesOf(...parts: (string | null | undefined)[]): string | null {
  const text = parts.filter((p) => p && String(p).trim()).join(" · ").trim();
  return text || null;
}

async function resolveCompanyId(): Promise<string> {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new AppError("No company is configured. Contact your administrator.", { status: 500 });
  return company.id;
}

async function loadItem(id: string): Promise<InventoryItem> {
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.deletedAt) {
    throw new AppError("Inventory item not found.", { status: 404, code: "NOT_FOUND" });
  }
  return item;
}

type MoveInput = {
  tx: Tx;
  item: InventoryItem;
  delta: number;
  type: StockTxType;
  userId: string;
  referenceType?: string;
  referenceId?: string;
  notes?: string | null;
  unitCost?: number | null;
  /** When true the movement may not consume reserved stock. */
  checkAvailable?: boolean;
};

/**
 * Applies a signed stock movement: updates quantities, appends the immutable ledger
 * row with its running balance and returns the previous / resulting balance.
 */
async function applyMovement(
  input: MoveInput
): Promise<{ previous: number; balance: number; available: number }> {
  const { tx, item, delta, type, userId } = input;
  const previous = round3(Number(item.currentQty));
  const reserved = round3(Number(item.reservedQty));
  const balance = round3(previous + delta);
  const available = round3(previous - reserved);

  if (balance < 0) {
    throw new AppError(
      `Only ${previous} ${item.unit} of ${item.sku} on hand — cannot remove ${Math.abs(delta)} ${item.unit}.`,
      { code: "INSUFFICIENT_STOCK" }
    );
  }
  if (input.checkAvailable && delta < 0 && available < Math.abs(delta)) {
    throw new AppError(
      `Only ${Math.max(available, 0)} ${item.unit} of ${item.sku} available (${previous} on hand, ${reserved} reserved).`,
      { code: "INSUFFICIENT_STOCK" }
    );
  }

  const incoming = delta > 0;

  await tx.inventoryItem.update({
    where: { id: item.id },
    data: {
      currentQty: balance,
      lastMovementAt: new Date(),
      ...(input.unitCost != null ? { unitCost: input.unitCost } : {}),
    },
  });

  await tx.inventoryTransaction.create({
    data: {
      inventoryItemId: item.id,
      type,
      quantity: delta,
      balanceAfter: balance,
      unitCost: input.unitCost ?? null,
      fromSiteId: incoming ? null : item.siteId,
      toSiteId: incoming ? item.siteId : null,
      fromLocationId: incoming ? null : item.stockLocationId,
      toLocationId: incoming ? item.stockLocationId : null,
      performedById: userId,
      referenceType: input.referenceType ?? "MANUAL",
      referenceId: input.referenceId ?? null,
      notes: input.notes ?? null,
    },
  });

  return { previous, balance, available };
}

async function notifyIfLowStock(item: InventoryItem, previous: number, balance: number): Promise<void> {
  const reorder = Number(item.reorderLevel);
  if (!(previous > reorder && balance <= reorder)) return;
  await notify({
    userIds: await inventoryAlertRecipients(item.siteId),
    type: "LOW_STOCK",
    title: `Low stock: ${item.sku}`,
    body: `${item.name} dropped to ${balance} ${item.unit} (reorder level ${reorder}).`,
    entityType: "InventoryItem",
    entityId: item.id,
    link: `/inventory/${item.id}`,
  });
}

export type StockMoveResult = { id: string; previous: number; balance: number };

export async function issueStock(raw: unknown): Promise<ActionResult<StockMoveResult>> {
  return withAction(
    async () => {
      const input = stockIssueSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_ISSUE);
      const item = await loadItem(input.inventoryItemId);
      assertSiteAccess(user, item.siteId);

      const moved = await withTx((tx) =>
        applyMovement({
          tx,
          item,
          delta: -input.quantity,
          type: "ISSUE",
          userId: user.id,
          notes: notesOf(input.issuedTo ? `Issued to ${input.issuedTo}` : null, input.reference ? `Ref ${input.reference}` : null, input.notes),
          checkAvailable: true,
        })
      );

      await recordAudit({
        userId: user.id,
        action: "STOCK_ISSUED",
        entityType: "InventoryItem",
        entityId: item.id,
        siteId: item.siteId,
        description: `Issued ${input.quantity} ${item.unit} of ${item.sku} (${item.name})`,
        previousValue: { currentQty: moved.previous },
        newValue: { currentQty: moved.balance, issuedTo: input.issuedTo ?? null, reference: input.reference ?? null },
        ip: await getClientIp(),
      });

      await notifyIfLowStock(item, moved.previous, moved.balance);
      revalidatePath("/inventory");
      revalidatePath(`/inventory/${item.id}`);
      return { id: item.id, previous: moved.previous, balance: moved.balance };
    },
    { action: "issueStock" }
  );
}

export async function consumeStock(raw: unknown): Promise<ActionResult<StockMoveResult>> {
  return withAction(
    async () => {
      const input = stockConsumeSchema.parse(raw);
      const isWriteOff = input.reason === "WRITE_OFF";
      const user = await requirePermission(
        isWriteOff ? PERMISSIONS.INVENTORY_ADJUST : PERMISSIONS.INVENTORY_ISSUE
      );
      const item = await loadItem(input.inventoryItemId);
      assertSiteAccess(user, item.siteId);

      const moved = await withTx((tx) =>
        applyMovement({
          tx,
          item,
          delta: -input.quantity,
          type: isWriteOff ? "ADJUSTMENT" : "CONSUME",
          userId: user.id,
          notes: notesOf(`Consumed — ${input.reason.toLowerCase()}`, input.reference ? `Ref ${input.reference}` : null, input.notes),
          checkAvailable: !isWriteOff,
        })
      );

      await recordAudit({
        userId: user.id,
        action: isWriteOff ? "STOCK_ADJUSTED" : "STOCK_CONSUMED",
        entityType: "InventoryItem",
        entityId: item.id,
        siteId: item.siteId,
        description: `${isWriteOff ? "Wrote off" : "Consumed"} ${input.quantity} ${item.unit} of ${item.sku} (${input.reason})`,
        previousValue: { currentQty: moved.previous },
        newValue: { currentQty: moved.balance, reason: input.reason },
        ip: await getClientIp(),
      });

      await notifyIfLowStock(item, moved.previous, moved.balance);
      revalidatePath("/inventory");
      revalidatePath(`/inventory/${item.id}`);
      return { id: item.id, previous: moved.previous, balance: moved.balance };
    },
    { action: "consumeStock" }
  );
}

export async function adjustStock(raw: unknown): Promise<ActionResult<StockMoveResult>> {
  return withAction(
    async () => {
      const input = stockAdjustSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST);
      const item = await loadItem(input.inventoryItemId);
      assertSiteAccess(user, item.siteId);

      const moved = await withTx((tx) =>
        applyMovement({
          tx,
          item,
          delta: input.quantity,
          type: "ADJUSTMENT",
          userId: user.id,
          notes: notesOf(input.reason, input.reference ? `Ref ${input.reference}` : null, input.notes),
        })
      );

      await recordAudit({
        userId: user.id,
        action: "STOCK_ADJUSTED",
        entityType: "InventoryItem",
        entityId: item.id,
        siteId: item.siteId,
        description: `Adjusted ${item.sku} by ${input.quantity > 0 ? "+" : ""}${input.quantity} ${item.unit}: ${input.reason}`,
        previousValue: { currentQty: moved.previous },
        newValue: { currentQty: moved.balance, reason: input.reason },
        ip: await getClientIp(),
      });

      await notifyIfLowStock(item, moved.previous, moved.balance);
      revalidatePath("/inventory");
      revalidatePath(`/inventory/${item.id}`);
      return { id: item.id, previous: moved.previous, balance: moved.balance };
    },
    { action: "adjustStock" }
  );
}

export async function replenishStock(raw: unknown): Promise<ActionResult<StockMoveResult>> {
  return withAction(
    async () => {
      const input = stockReplenishSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_RECEIVE);
      const item = await loadItem(input.inventoryItemId);
      assertSiteAccess(user, item.siteId);

      const unitCost =
        input.unitCost !== undefined && Number.isFinite(input.unitCost)
          ? round3(Number(input.unitCost))
          : null;

      const moved = await withTx((tx) =>
        applyMovement({
          tx,
          item,
          delta: input.quantity,
          type: "REPLENISHMENT",
          userId: user.id,
          unitCost,
          notes: notesOf("Replenishment", input.reference ? `Ref ${input.reference}` : null, input.notes),
        })
      );

      await recordAudit({
        userId: user.id,
        action: "STOCK_RECEIVED",
        entityType: "InventoryItem",
        entityId: item.id,
        siteId: item.siteId,
        description: `Replenished ${input.quantity} ${item.unit} of ${item.sku} (${item.name})`,
        previousValue: { currentQty: moved.previous, unitCost: Number(item.unitCost) },
        newValue: { currentQty: moved.balance, unitCost: unitCost ?? Number(item.unitCost) },
        ip: await getClientIp(),
      });

      await notifyIfLowStock(item, moved.previous, moved.balance);
      revalidatePath("/inventory");
      revalidatePath(`/inventory/${item.id}`);
      return { id: item.id, previous: moved.previous, balance: moved.balance };
    },
    { action: "replenishStock" }
  );
}

export type InventoryFormOptions = {
  sites: { id: string; name: string; code: string }[];
  categories: { id: string; name: string; itemTypes: { id: string; name: string }[] }[];
  stockLocations: { id: string; name: string; code: string; siteId: string }[];
  suppliers: { id: string; name: string }[];
};

/** Dropdown payload shared by the item form, movement dialogs and receipt form. */
export async function getInventoryFormOptions(siteId?: string): Promise<InventoryFormOptions> {
  const user = await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  if (siteId) assertSiteAccess(user, siteId);
  const global = isGlobal(user);

  const [sites, categories, stockLocations, suppliers] = await Promise.all([
    prisma.site.findMany({
      where: { status: "ACTIVE", deletedAt: null, ...(global ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        itemTypes: {
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
        ...(global ? {} : { siteId: { in: user.siteIds } }),
        ...(siteId ? { siteId } : {}),
      },
      select: { id: true, name: true, code: true, siteId: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  return { sites, categories, stockLocations, suppliers };
}

export type InventoryPickerItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentQty: number;
  reservedQty: number;
  unitCost: number;
  reorderLevel: number;
  siteId: string;
  stockLocationId: string;
};

/** Site-scoped item lookup used by movement and receipt pickers. */
export async function searchInventoryItems(
  query: string,
  siteId?: string
): Promise<InventoryPickerItem[]> {
  const user = await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  if (siteId) assertSiteAccess(user, siteId);
  const global = isGlobal(user);
  const q = (query ?? "").trim();

  const items = await prisma.inventoryItem.findMany({
    where: {
      deletedAt: null,
      ...(global ? {} : { siteId: { in: user.siteIds } }),
      ...(siteId ? { siteId } : {}),
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
              { binLocation: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      currentQty: true,
      reservedQty: true,
      unitCost: true,
      reorderLevel: true,
      siteId: true,
      stockLocationId: true,
    },
    orderBy: { sku: "asc" },
    take: 50,
  });

  return items.map((item) => ({
    ...item,
    currentQty: Number(item.currentQty),
    reservedQty: Number(item.reservedQty),
    unitCost: Number(item.unitCost),
    reorderLevel: Number(item.reorderLevel),
  }));
}

export type InventoryItemResult = { id: string };

export type InventoryItemDetail = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string;
  itemTypeId: string | null;
  siteId: string;
  stockLocationId: string;
  binLocation: string | null;
  unit: string;
  minQty: number;
  maxQty: number | null;
  reorderLevel: number;
  unitCost: number;
  supplierId: string | null;
  isActive: boolean;
};

/** Full editable projection of an item for the create/edit dialog. */
export async function getInventoryItemForEdit(id: string): Promise<InventoryItemDetail | null> {
  const user = await requirePermission(PERMISSIONS.INVENTORY_VIEW);
  const item = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!item || item.deletedAt) return null;
  assertSiteAccess(user, item.siteId);
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    description: item.description,
    categoryId: item.categoryId,
    itemTypeId: item.itemTypeId,
    siteId: item.siteId,
    stockLocationId: item.stockLocationId,
    binLocation: item.binLocation,
    unit: item.unit,
    minQty: Number(item.minQty),
    maxQty: item.maxQty ? Number(item.maxQty) : null,
    reorderLevel: Number(item.reorderLevel),
    unitCost: Number(item.unitCost),
    supplierId: item.supplierId,
    isActive: item.isActive,
  };
}

export async function createInventoryItem(raw: unknown): Promise<ActionResult<InventoryItemResult>> {
  return withAction(
    async () => {
      const input = inventoryItemCreateSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST);
      assertSiteAccess(user, input.siteId);

      const companyId = await resolveCompanyId();
      const [site, location, category] = await Promise.all([
        prisma.site.findUnique({ where: { id: input.siteId }, select: { id: true } }),
        prisma.stockLocation.findUnique({ where: { id: input.stockLocationId }, select: { id: true, siteId: true } }),
        prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
      ]);
      if (!site) throw new AppError("Site not found.", { status: 404 });
      if (!location || location.siteId !== input.siteId) {
        throw new AppError("Stock location does not belong to the selected site.", {
          code: "LOCATION_MISMATCH",
        });
      }
      if (!category) throw new AppError("Category not found.", { status: 404 });

      const duplicate = await prisma.inventoryItem.findFirst({
        where: {
          companyId,
          sku: input.sku.toUpperCase(),
          siteId: input.siteId,
          stockLocationId: input.stockLocationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new AppError("That SKU already exists at this location.", { code: "DUPLICATE_SKU" });
      }

      const openingQty = round3(Number(input.openingQty ?? 0));
      const item = await withTx(async (tx) => {
        const created = await tx.inventoryItem.create({
          data: {
            companyId,
            sku: input.sku.toUpperCase(),
            name: input.name,
            description: input.description || null,
            categoryId: input.categoryId,
            itemTypeId: input.itemTypeId || null,
            siteId: input.siteId,
            stockLocationId: input.stockLocationId,
            binLocation: input.binLocation || null,
            unit: input.unit || "EACH",
            currentQty: openingQty,
            minQty: Number(input.minQty ?? 0),
            maxQty: input.maxQty ? Number(input.maxQty) : null,
            reorderLevel: Number(input.reorderLevel ?? 0),
            unitCost: Number(input.unitCost ?? 0),
            supplierId: input.supplierId || null,
            isActive: input.isActive !== false,
            lastMovementAt: openingQty > 0 ? new Date() : null,
          },
        });

        if (openingQty > 0) {
          await tx.inventoryTransaction.create({
            data: {
              inventoryItemId: created.id,
              type: "RECEIVE",
              quantity: openingQty,
              balanceAfter: openingQty,
              unitCost: Number(input.unitCost ?? 0),
              toSiteId: created.siteId,
              toLocationId: created.stockLocationId,
              performedById: user.id,
              referenceType: "MANUAL",
              notes: "Opening balance received",
            },
          });
        }
        return created;
      });

      await recordAudit({
        userId: user.id,
        action: openingQty > 0 ? "STOCK_RECEIVED" : "STOCK_ADJUSTED",
        entityType: "InventoryItem",
        entityId: item.id,
        siteId: item.siteId,
        description: `Created inventory item ${item.sku} (${item.name}) with opening balance ${openingQty} ${item.unit}`,
        newValue: {
          sku: item.sku,
          name: item.name,
          currentQty: openingQty,
          reorderLevel: Number(item.reorderLevel),
          siteId: item.siteId,
        },
        ip: await getClientIp(),
      });

      revalidatePath("/inventory");
      return { id: item.id };
    },
    { action: "createInventoryItem" }
  );
}

export async function updateInventoryItem(raw: unknown): Promise<ActionResult<InventoryItemResult>> {
  return withAction(
    async () => {
      const input = inventoryItemUpdateSchema.parse(raw);
      const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST);
      const existing = await loadItem(input.id);
      assertSiteAccess(user, existing.siteId);

      const nextSiteId = input.siteId ?? existing.siteId;
      assertSiteAccess(user, nextSiteId);

      if (input.siteId && input.siteId !== existing.siteId && Number(existing.currentQty) > 0) {
        throw new AppError("Issue or transfer the stock before moving an item to another site.", {
          code: "ITEM_HAS_STOCK",
        });
      }

      if (input.stockLocationId && input.stockLocationId !== existing.stockLocationId) {
        const location = await prisma.stockLocation.findUnique({
          where: { id: input.stockLocationId },
          select: { siteId: true },
        });
        if (!location || location.siteId !== nextSiteId) {
          throw new AppError("Stock location does not belong to the selected site.", {
            code: "LOCATION_MISMATCH",
          });
        }
      }

      if (input.sku && input.sku.toUpperCase() !== existing.sku) {
        const duplicate = await prisma.inventoryItem.findFirst({
          where: {
            companyId: existing.companyId,
            sku: input.sku.toUpperCase(),
            siteId: nextSiteId,
            stockLocationId: input.stockLocationId ?? existing.stockLocationId,
            deletedAt: null,
            id: { not: existing.id },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new AppError("That SKU already exists at this location.", { code: "DUPLICATE_SKU" });
        }
      }

      const item = await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: {
          sku: input.sku ? input.sku.toUpperCase() : undefined,
          name: input.name ?? undefined,
          description: input.description !== undefined ? input.description || null : undefined,
          categoryId: input.categoryId ?? undefined,
          itemTypeId: input.itemTypeId !== undefined ? input.itemTypeId || null : undefined,
          siteId: input.siteId ?? undefined,
          stockLocationId: input.stockLocationId ?? undefined,
          binLocation: input.binLocation !== undefined ? input.binLocation || null : undefined,
          unit: input.unit ?? undefined,
          minQty: input.minQty !== undefined ? Number(input.minQty) : undefined,
          maxQty: input.maxQty !== undefined ? (input.maxQty ? Number(input.maxQty) : null) : undefined,
          reorderLevel: input.reorderLevel !== undefined ? Number(input.reorderLevel) : undefined,
          unitCost: input.unitCost !== undefined ? Number(input.unitCost) : undefined,
          supplierId: input.supplierId !== undefined ? input.supplierId || null : undefined,
          isActive: input.isActive !== undefined ? input.isActive : undefined,
        },
      });

      await recordAudit({
        userId: user.id,
        action: "STOCK_ADJUSTED",
        entityType: "InventoryItem",
        entityId: item.id,
        siteId: item.siteId,
        description: `Updated inventory item ${item.sku} (${item.name})`,
        previousValue: {
          sku: existing.sku,
          name: existing.name,
          reorderLevel: Number(existing.reorderLevel),
          minQty: Number(existing.minQty),
          unitCost: Number(existing.unitCost),
          isActive: existing.isActive,
        },
        newValue: {
          sku: item.sku,
          name: item.name,
          reorderLevel: Number(item.reorderLevel),
          minQty: Number(item.minQty),
          unitCost: Number(item.unitCost),
          isActive: item.isActive,
        },
        ip: await getClientIp(),
      });

      revalidatePath("/inventory");
      revalidatePath(`/inventory/${item.id}`);
      return { id: item.id };
    },
    { action: "updateInventoryItem", itemId: String((raw as { id?: string })?.id ?? "") }
  );
}

/** Soft-deletes an item so historical transactions stay intact. */
export async function archiveInventoryItem(id: string): Promise<ActionResult<InventoryItemResult>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.INVENTORY_ADJUST);
      const item = await loadItem(id);
      assertSiteAccess(user, item.siteId);

      if (Number(item.currentQty) > 0) {
        throw new AppError("Issue or adjust the remaining stock before archiving this item.", {
          code: "ITEM_HAS_STOCK",
        });
      }

      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: { deletedAt: new Date(), isActive: false },
      });

      await recordAudit({
        userId: user.id,
        action: "STOCK_ADJUSTED",
        entityType: "InventoryItem",
        entityId: item.id,
        siteId: item.siteId,
        description: `Archived inventory item ${item.sku} (${item.name})`,
        previousValue: { isActive: item.isActive, deletedAt: null },
        newValue: { isActive: false, deletedAt: new Date().toISOString() },
        ip: await getClientIp(),
      });

      revalidatePath("/inventory");
      return { id: item.id };
    },
    { action: "archiveInventoryItem", itemId: id }
  );
}

