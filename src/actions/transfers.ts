"use server";

import { revalidatePath } from "next/cache";
import { prisma, withTx, type Tx } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, getClientIp, type SessionUser } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit, snapshot } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { nextTransferNumber } from "@/lib/ids";
import { assertTransferable, assertAssetTransition, isTerminal } from "@/lib/lifecycle";
import {
  transferCreateSchema,
  transferIdSchema,
  transferRejectSchema,
  transferShipSchema,
  transferReceiveSchema,
} from "@/lib/validations/transfer";
import type { AssetCondition, AssetStatus, Prisma } from "@/generated/prisma";

const TRANSFER_INCLUDE = {
  assets: {
    include: {
      asset: { select: { id: true, assetTag: true, name: true, condition: true, status: true, siteId: true } },
    },
  },
  items: {
    include: {
      inventoryItem: {
        select: {
          id: true,
          sku: true,
          name: true,
          description: true,
          companyId: true,
          categoryId: true,
          itemTypeId: true,
          unit: true,
          minQty: true,
          maxQty: true,
          reorderLevel: true,
          unitCost: true,
          supplierId: true,
          currentQty: true,
          stockLocationId: true,
          siteId: true,
        },
      },
    },
  },
} as const;

type TransferWithLines = Prisma.TransferGetPayload<{ include: typeof TRANSFER_INCLUDE }>;

async function auditContext() {
  return { ip: await getClientIp() };
}

/** Users who act on inter-site movements: global admins plus staff scoped to the given sites. */
async function transferRecipients(siteIds: string[], extraUserIds: string[] = []): Promise<string[]> {
  const sites = Array.from(new Set(siteIds.filter(Boolean)));
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { role: { key: { in: ["SUPER_ADMIN", "INVENTORY_ADMIN"] } } },
        ...(sites.length ? [{ siteScopes: { some: { siteId: { in: sites } } } }] : []),
      ],
    },
    select: { id: true },
  });
  return Array.from(new Set([...users.map((u) => u.id), ...extraUserIds]));
}

async function loadTransfer(id: string): Promise<TransferWithLines> {
  const transfer = await prisma.transfer.findUnique({ where: { id }, include: TRANSFER_INCLUDE });
  if (!transfer) throw new AppError("Transfer not found.", { status: 404, code: "NOT_FOUND" });
  return transfer;
}

function assertTransferSites(user: SessionUser, transfer: { fromSiteId: string; toSiteId: string }) {
  assertSiteAccess(user, transfer.fromSiteId);
  assertSiteAccess(user, transfer.toSiteId);
}

function assertStatus(transfer: { status: string }, allowed: string[], action: string) {
  if (!allowed.includes(transfer.status)) {
    throw new AppError(
      `This transfer is ${transfer.status.toLowerCase()} — it cannot be ${action}.`,
      { code: "INVALID_STATUS" }
    );
  }
}

function destinationLocationId(transfer: TransferWithLines, fallback: string | null): string | null {
  return transfer.toLocationId ?? fallback;
}

/** Site-scoped consumable picker used by the new-transfer form. */
export async function searchConsumablesForPicker(
  query: string,
  siteId: string,
  limit = 20
): Promise<
  { id: string; sku: string; name: string; unit: string; currentQty: number; stockLocation: string }[]
> {
  const user = await requirePermission(PERMISSIONS.TRANSFERS_VIEW);
  if (!siteId) return [];
  assertSiteAccess(user, siteId);
  const q = (query ?? "").trim();

  const items = await prisma.inventoryItem.findMany({
    where: {
      siteId,
      isActive: true,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
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
      stockLocation: { select: { name: true } },
    },
    orderBy: { name: "asc" },
    take: Math.min(limit, 50),
  });

  return items.map((item) => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    unit: item.unit,
    currentQty: Number(item.currentQty),
    stockLocation: item.stockLocation.name,
  }));
}

export async function createTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_CREATE);
      const input = transferCreateSchema.parse(raw);
      assertSiteAccess(user, input.fromSiteId);
      assertSiteAccess(user, input.toSiteId);

      const [fromSite, toSite] = await Promise.all([
        prisma.site.findUnique({ where: { id: input.fromSiteId } }),
        prisma.site.findUnique({ where: { id: input.toSiteId } }),
      ]);
      if (!fromSite || !toSite) throw new AppError("Site not found.", { status: 404 });
      if (fromSite.status !== "ACTIVE" || toSite.status !== "ACTIVE") {
        throw new AppError("Both sites must be active to send a transfer.", { code: "INACTIVE_SITE" });
      }

      const assets = input.assetIds.length
        ? await prisma.asset.findMany({
            where: { id: { in: input.assetIds } },
            select: { id: true, assetTag: true, siteId: true, status: true, condition: true, deletedAt: true },
          })
        : [];
      if (assets.length !== input.assetIds.length) {
        throw new AppError("One or more selected assets no longer exist.", { status: 404 });
      }
      assets.forEach((asset) => {
        assertSiteAccess(user, asset.siteId);
        if (asset.deletedAt) throw new AppError(`${asset.assetTag} has been deleted.`, { code: "DELETED" });
        if (asset.siteId !== input.fromSiteId) {
          throw new AppError(`${asset.assetTag} is not held at the source site.`, { code: "WRONG_SITE" });
        }
        assertTransferable(asset.status, asset.assetTag);
      });

      // An asset can only be in one open transfer at a time.
      if (input.assetIds.length) {
        const inFlight = await prisma.transferAsset.findMany({
          where: {
            assetId: { in: input.assetIds },
            status: { in: ["PENDING", "SENT"] },
            transfer: { status: { in: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "IN_TRANSIT"] } },
          },
          select: { assetId: true, transfer: { select: { transferNumber: true } } },
        });
        if (inFlight.length > 0) {
          const tags = assets
            .filter((asset) => inFlight.some((line) => line.assetId === asset.id))
            .map((asset) => asset.assetTag);
          const ref = inFlight[0].transfer.transferNumber;
          throw new AppError(
            `${tags.join(", ")} already in open transfer ${ref}. Receive or cancel it first.`,
            { code: "ALREADY_IN_TRANSFER" }
          );
        }
      }

      const merged = new Map<string, number>();
      for (const line of input.items) {
        merged.set(line.inventoryItemId, (merged.get(line.inventoryItemId) ?? 0) + line.quantity);
      }
      const lines = Array.from(merged, ([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }));

      if (lines.length) {
        const inventoryItems = await prisma.inventoryItem.findMany({
          where: { id: { in: lines.map((l) => l.inventoryItemId) } },
          select: { id: true, sku: true, name: true, siteId: true, currentQty: true, deletedAt: true, isActive: true },
        });
        if (inventoryItems.length !== lines.length) {
          throw new AppError("One or more consumable lines no longer exist.", { status: 404 });
        }
        for (const line of lines) {
          const item = inventoryItems.find((i) => i.id === line.inventoryItemId)!;
          if (item.deletedAt || !item.isActive) throw new AppError(`${item.sku} is no longer active.`, { code: "INACTIVE" });
          if (item.siteId !== input.fromSiteId) {
            throw new AppError(`${item.sku} is not held at the source site.`, { code: "WRONG_SITE" });
          }
          if (Number(item.currentQty) < line.quantity) {
            throw new AppError(
              `Insufficient stock of ${item.sku} at the source site (${Number(item.currentQty)} available).`,
              { code: "INSUFFICIENT_STOCK" }
            );
          }
        }
      }

      if (input.fromLocationId) {
        const location = await prisma.stockLocation.findUnique({ where: { id: input.fromLocationId }, select: { siteId: true } });
        if (!location || location.siteId !== input.fromSiteId) {
          throw new AppError("The source storage location does not belong to the source site.", { code: "BAD_LOCATION" });
        }
      }
      if (input.toLocationId) {
        const location = await prisma.stockLocation.findUnique({ where: { id: input.toLocationId }, select: { siteId: true } });
        if (!location || location.siteId !== input.toSiteId) {
          throw new AppError("The destination storage location does not belong to the destination site.", {
            code: "BAD_LOCATION",
          });
        }
      }

      const expectedArrival = input.expectedArrival ? new Date(input.expectedArrival) : null;

      const created = await withTx(async (tx) => {
        const transferNumber = await nextTransferNumber(tx, fromSite.code, toSite.code);
        const transfer = await tx.transfer.create({
          data: {
            transferNumber,
            fromSiteId: input.fromSiteId,
            toSiteId: input.toSiteId,
            fromLocationId: input.fromLocationId || null,
            toLocationId: input.toLocationId || null,
            status: input.submit ? "PENDING_APPROVAL" : "DRAFT",
            requestedById: user.id,
            requestedAt: new Date(),
            expectedArrival,
            courier: input.courier || null,
            referenceNumber: input.referenceNumber || null,
            notes: input.notes || null,
          },
        });

        if (assets.length) {
          await tx.transferAsset.createMany({
            data: assets.map((asset) => ({
              transferId: transfer.id,
              assetId: asset.id,
              status: "PENDING" as const,
              conditionAtSend: asset.condition,
            })),
          });
        }

        for (const line of lines) {
          await tx.transferItem.create({
            data: {
              transferId: transfer.id,
              inventoryItemId: line.inventoryItemId,
              quantity: line.quantity,
              status: "PENDING" as const,
            },
          });
        }

        return transfer;
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_CREATED",
        entityType: "Transfer",
        entityId: created.id,
        siteId: input.fromSiteId,
        description: `Created transfer ${created.transferNumber} ${fromSite.name} → ${toSite.name} (${assets.length} asset(s), ${lines.length} consumable line(s))`,
        newValue: snapshot(created, ["transferNumber", "fromSiteId", "toSiteId", "status", "expectedArrival"]),
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([input.toSiteId], [user.id]),
        type: "TRANSFER_UPDATE",
        title: `Transfer ${created.transferNumber} created`,
        body: `${assets.length} asset(s) and ${lines.length} consumable line(s) will move from ${fromSite.name} to ${toSite.name}.`,
        entityType: "Transfer",
        entityId: created.id,
        link: `/transfers/${created.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath("/dashboard");
      return { id: created.id };
    },
    { action: "createTransfer" }
  );
}

/** DRAFT → PENDING_APPROVAL. */
export async function submitTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_CREATE);
      const input = transferIdSchema.parse(raw);
      const transfer = await loadTransfer(input.id);
      assertTransferSites(user, transfer);
      assertStatus(transfer, ["DRAFT"], "submitted");

      if (transfer.assets.length === 0 && transfer.items.length === 0) {
        throw new AppError("Add at least one asset or consumable line before submitting.", {
          code: "EMPTY_TRANSFER",
        });
      }

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: { status: "PENDING_APPROVAL", notes: input.notes ? appendNote(transfer.notes, input.notes) : transfer.notes },
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_CREATED",
        entityType: "Transfer",
        entityId: transfer.id,
        siteId: transfer.fromSiteId,
        description: `Submitted ${transfer.transferNumber} for approval`,
        previousValue: { status: transfer.status },
        newValue: { status: "PENDING_APPROVAL" },
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([transfer.toSiteId, transfer.fromSiteId]),
        type: "TRANSFER_UPDATE",
        title: `${transfer.transferNumber} awaits approval`,
        body: `${transfer.transferNumber} is ready for review.`,
        entityType: "Transfer",
        entityId: transfer.id,
        link: `/transfers/${transfer.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath(`/transfers/${transfer.id}`);
      return { id: transfer.id };
    },
    { action: "submitTransfer" }
  );
}

export async function approveTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_APPROVE);
      const input = transferIdSchema.parse(raw);
      const transfer = await loadTransfer(input.id);
      assertTransferSites(user, transfer);
      assertStatus(transfer, ["PENDING_APPROVAL"], "approved");

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: new Date(),
          notes: input.notes ? appendNote(transfer.notes, input.notes) : transfer.notes,
        },
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_APPROVED",
        entityType: "Transfer",
        entityId: transfer.id,
        siteId: transfer.fromSiteId,
        description: `Approved transfer ${transfer.transferNumber}`,
        previousValue: { status: transfer.status },
        newValue: { status: "APPROVED" },
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([transfer.fromSiteId, transfer.toSiteId], [transfer.requestedById]),
        type: "TRANSFER_UPDATE",
        title: `${transfer.transferNumber} approved`,
        body: "The transfer can now be shipped.",
        entityType: "Transfer",
        entityId: transfer.id,
        link: `/transfers/${transfer.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath(`/transfers/${transfer.id}`);
      return { id: transfer.id };
    },
    { action: "approveTransfer" }
  );
}

export async function rejectTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_APPROVE);
      const input = transferRejectSchema.parse(raw);
      const transfer = await loadTransfer(input.id);
      assertTransferSites(user, transfer);
      assertStatus(transfer, ["PENDING_APPROVAL"], "rejected");

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: "REJECTED",
          notes: appendNote(transfer.notes, `Rejected by ${user.name ?? user.email}: ${input.notes}`),
        },
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_REJECTED",
        entityType: "Transfer",
        entityId: transfer.id,
        siteId: transfer.fromSiteId,
        description: `Rejected transfer ${transfer.transferNumber}: ${input.notes}`,
        previousValue: { status: transfer.status },
        newValue: { status: "REJECTED", reason: input.notes },
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([transfer.fromSiteId], [transfer.requestedById]),
        type: "TRANSFER_UPDATE",
        title: `${transfer.transferNumber} rejected`,
        body: input.notes,
        entityType: "Transfer",
        entityId: transfer.id,
        link: `/transfers/${transfer.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath(`/transfers/${transfer.id}`);
      return { id: transfer.id };
    },
    { action: "rejectTransfer" }
  );
}

/** APPROVED → IN_TRANSIT. Marks every line as SENT and snapshots outbound condition. */
export async function shipTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_SHIP);
      const input = transferShipSchema.parse(raw);
      const transfer = await loadTransfer(input.id);
      assertTransferSites(user, transfer);
      assertStatus(transfer, ["APPROVED"], "shipped");
      if (transfer.assets.length === 0 && transfer.items.length === 0) {
        throw new AppError("This transfer has no lines to ship.", { code: "EMPTY_TRANSFER" });
      }

      for (const line of transfer.items) {
        if (Number(line.inventoryItem.currentQty) < Number(line.quantity)) {
          throw new AppError(
            `Insufficient stock of ${line.inventoryItem.sku} (${Number(line.inventoryItem.currentQty)} available).`,
            { code: "INSUFFICIENT_STOCK" }
          );
        }
      }

      const now = new Date();
      const expectedArrival = input.expectedArrival ? new Date(input.expectedArrival) : transfer.expectedArrival;

      await withTx(async (tx) => {
        await tx.transfer.update({
          where: { id: transfer.id },
          data: {
            status: "IN_TRANSIT",
            shippedAt: now,
            expectedArrival,
            courier: input.courier || transfer.courier,
            referenceNumber: input.referenceNumber || transfer.referenceNumber,
            notes: input.notes ? appendNote(transfer.notes, input.notes) : transfer.notes,
          },
        });
        if (transfer.assets.length) {
          await tx.transferAsset.updateMany({
            where: { transferId: transfer.id },
            data: { status: "SENT", receivedAt: null },
          });
          for (const line of transfer.assets) {
            if (!line.conditionAtSend) {
              await tx.transferAsset.update({
                where: { id: line.id },
                data: { conditionAtSend: line.asset.condition },
              });
            }
          }
        }
        if (transfer.items.length) {
          await tx.transferItem.updateMany({
            where: { transferId: transfer.id },
            data: { status: "SENT" },
          });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_SHIPPED",
        entityType: "Transfer",
        entityId: transfer.id,
        siteId: transfer.fromSiteId,
        description: `Shipped transfer ${transfer.transferNumber} via ${input.courier || transfer.courier || "hand carry"}`,
        previousValue: { status: transfer.status },
        newValue: { status: "IN_TRANSIT", expectedArrival },
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([transfer.toSiteId], [transfer.requestedById]),
        type: "TRANSFER_UPDATE",
        title: `${transfer.transferNumber} is in transit`,
        body: `${transfer.assets.length} asset(s) and ${transfer.items.length} consumable line(s) are on the way.`,
        entityType: "Transfer",
        entityId: transfer.id,
        link: `/transfers/${transfer.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath(`/transfers/${transfer.id}`);
      return { id: transfer.id };
    },
    { action: "shipTransfer" }
  );
}

/**
 * IN_TRANSIT → RECEIVED.
 * Moves each asset to the destination site, writes the asset ledger, moves
 * consumable quantities between inventory items and writes TRANSFER_OUT /
 * TRANSFER_IN stock ledger rows — all inside one transaction.
 */
export async function receiveTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_RECEIVE);
      const input = transferReceiveSchema.parse(raw);
      const transfer = await loadTransfer(input.id);
      assertTransferSites(user, transfer);
      assertStatus(transfer, ["IN_TRANSIT"], "received");

      const conditionByAsset = new Map(input.conditions.map((c) => [c.assetId, c.condition]));
      const now = new Date();

      await withTx(async (tx) => {
        const defaultDestinationLocation =
          transfer.toLocationId ??
          (
            await tx.stockLocation.findFirst({
              where: { siteId: transfer.toSiteId, isActive: true },
              orderBy: { code: "asc" },
              select: { id: true },
            })
          )?.id ??
          null;

        for (const line of transfer.assets) {
          const asset = line.asset;
          assertSiteAccess(user, asset.siteId);
          const condition: AssetCondition = conditionByAsset.get(asset.id) ?? line.conditionAtReceive ?? asset.condition;
          const siteChanged = asset.siteId !== transfer.toSiteId;
          const nextStatus: AssetStatus = isTerminal(asset.status) ||
          ["UNDER_MAINTENANCE", "FOR_REPAIR", "LOST", "STOLEN"].includes(asset.status)
            ? asset.status
            : condition === "DAMAGED"
              ? "UNDER_MAINTENANCE"
              : "AVAILABLE";
          assertAssetTransition(asset.status, nextStatus, asset.assetTag);

          await tx.transferAsset.update({
            where: { id: line.id },
            data: { status: "RECEIVED", conditionAtReceive: condition, receivedAt: now },
          });

          await tx.asset.update({
            where: { id: asset.id },
            data: {
              siteId: transfer.toSiteId,
              stockLocationId: destinationLocationId(transfer, defaultDestinationLocation),
              condition,
              status: nextStatus,
              ...(siteChanged ? { roomId: null, buildingId: null, floorId: null, departmentId: null } : {}),
            },
          });

          await tx.assetTransaction.create({
            data: {
              assetId: asset.id,
              type: "TRANSFER",
              fromStatus: asset.status,
              toStatus: nextStatus,
              fromSiteId: transfer.fromSiteId,
              toSiteId: transfer.toSiteId,
              fromRoomId: null,
              toRoomId: null,
              performedById: user.id,
              referenceType: "TRANSFER",
              referenceId: transfer.id,
              previousValue: { siteId: transfer.fromSiteId, status: asset.status, condition: asset.condition },
              newValue: { siteId: transfer.toSiteId, status: nextStatus, condition },
              notes: input.notes || `Received on transfer ${transfer.transferNumber}`,
            },
          });
        }

        for (const line of transfer.items) {
          const source = line.inventoryItem;
          const quantity = Number(line.quantity);
          const available = Number(source.currentQty);
          if (available < quantity) {
            throw new AppError(
              `Insufficient stock of ${source.sku} at the source site (${available} available).`,
              { code: "INSUFFICIENT_STOCK" }
            );
          }

          const destination = await resolveDestinationItem(tx, transfer, source, defaultDestinationLocation);
          const sourceBalance = available - quantity;
          const destinationBalance = Number(destination.currentQty) + quantity;

          await tx.inventoryItem.update({
            where: { id: source.id },
            data: { currentQty: sourceBalance, lastMovementAt: now },
          });
          await tx.inventoryItem.update({
            where: { id: destination.id },
            data: { currentQty: destinationBalance, lastMovementAt: now },
          });

          await tx.inventoryTransaction.createMany({
            data: [
              {
                inventoryItemId: source.id,
                type: "TRANSFER_OUT" as const,
                quantity: -quantity,
                balanceAfter: sourceBalance,
                unitCost: source.unitCost ?? null,
                fromSiteId: transfer.fromSiteId,
                toSiteId: transfer.toSiteId,
                fromLocationId: source.stockLocationId,
                toLocationId: destination.stockLocationId,
                performedById: user.id,
                referenceType: "TRANSFER",
                referenceId: transfer.id,
                notes: input.notes || `Transfer out ${transfer.transferNumber}`,
              },
              {
                inventoryItemId: destination.id,
                type: "TRANSFER_IN" as const,
                quantity,
                balanceAfter: destinationBalance,
                unitCost: destination.unitCost ?? null,
                fromSiteId: transfer.fromSiteId,
                toSiteId: transfer.toSiteId,
                fromLocationId: source.stockLocationId,
                toLocationId: destination.stockLocationId,
                performedById: user.id,
                referenceType: "TRANSFER",
                referenceId: transfer.id,
                notes: input.notes || `Transfer in ${transfer.transferNumber}`,
              },
            ],
          });

          await tx.transferItem.update({
            where: { id: line.id },
            data: { status: "RECEIVED", receivedQuantity: quantity, receivedAt: now },
          });
        }

        await tx.transfer.update({
          where: { id: transfer.id },
          data: {
            status: "RECEIVED",
            actualArrival: now,
            notes: input.notes ? appendNote(transfer.notes, input.notes) : transfer.notes,
          },
        });
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_RECEIVED",
        entityType: "Transfer",
        entityId: transfer.id,
        siteId: transfer.toSiteId,
        description: `Received transfer ${transfer.transferNumber} — ${transfer.assets.length} asset(s), ${transfer.items.length} consumable line(s)`,
        previousValue: { status: transfer.status },
        newValue: { status: "RECEIVED", assets: transfer.assets.map((a) => a.asset.assetTag) },
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([transfer.fromSiteId, transfer.toSiteId], [transfer.requestedById]),
        type: "TRANSFER_UPDATE",
        title: `${transfer.transferNumber} received`,
        body: `Assets and stock have landed at the destination site.`,
        entityType: "Transfer",
        entityId: transfer.id,
        link: `/transfers/${transfer.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath(`/transfers/${transfer.id}`);
      revalidatePath("/assets");
      revalidatePath("/inventory");
      revalidatePath("/dashboard");
      return { id: transfer.id };
    },
    { action: "receiveTransfer" }
  );
}

/** RECEIVED → COMPLETED. */
export async function completeTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_RECEIVE);
      const input = transferIdSchema.parse(raw);
      const transfer = await loadTransfer(input.id);
      assertTransferSites(user, transfer);
      assertStatus(transfer, ["RECEIVED"], "completed");

      await prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: "COMPLETED",
          notes: input.notes ? appendNote(transfer.notes, input.notes) : transfer.notes,
        },
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_COMPLETED",
        entityType: "Transfer",
        entityId: transfer.id,
        siteId: transfer.toSiteId,
        description: `Completed transfer ${transfer.transferNumber}`,
        previousValue: { status: transfer.status },
        newValue: { status: "COMPLETED" },
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([transfer.fromSiteId, transfer.toSiteId], [transfer.requestedById]),
        type: "TRANSFER_UPDATE",
        title: `${transfer.transferNumber} completed`,
        body: "All lines have been reconciled and closed.",
        entityType: "Transfer",
        entityId: transfer.id,
        link: `/transfers/${transfer.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath(`/transfers/${transfer.id}`);
      revalidatePath("/dashboard");
      return { id: transfer.id };
    },
    { action: "completeTransfer" }
  );
}

/** DRAFT / PENDING_APPROVAL / APPROVED → CANCELLED. */
export async function cancelTransfer(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.TRANSFERS_CREATE);
      const input = transferIdSchema.parse(raw);
      const transfer = await loadTransfer(input.id);
      assertTransferSites(user, transfer);
      assertStatus(transfer, ["DRAFT", "PENDING_APPROVAL", "APPROVED"], "cancelled");

      await withTx(async (tx) => {
        await tx.transfer.update({
          where: { id: transfer.id },
          data: {
            status: "CANCELLED",
            notes: appendNote(transfer.notes, input.notes || `Cancelled by ${user.name ?? user.email}`),
          },
        });
        if (transfer.assets.length) {
          await tx.transferAsset.updateMany({ where: { transferId: transfer.id }, data: { status: "CANCELLED" } });
        }
        if (transfer.items.length) {
          await tx.transferItem.updateMany({ where: { transferId: transfer.id }, data: { status: "CANCELLED" } });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "TRANSFER_REJECTED",
        entityType: "Transfer",
        entityId: transfer.id,
        siteId: transfer.fromSiteId,
        description: `Cancelled transfer ${transfer.transferNumber}`,
        previousValue: { status: transfer.status },
        newValue: { status: "CANCELLED", reason: input.notes ?? null },
        ...(await auditContext()),
      });

      await notify({
        userIds: await transferRecipients([transfer.fromSiteId, transfer.toSiteId], [transfer.requestedById]),
        type: "TRANSFER_UPDATE",
        title: `${transfer.transferNumber} cancelled`,
        body: input.notes || "The transfer was cancelled before shipping.",
        entityType: "Transfer",
        entityId: transfer.id,
        link: `/transfers/${transfer.id}`,
      });

      revalidatePath("/transfers");
      revalidatePath(`/transfers/${transfer.id}`);
      return { id: transfer.id };
    },
    { action: "cancelTransfer" }
  );
}

async function resolveDestinationItem(
  tx: Tx,
  transfer: TransferWithLines,
  source: TransferWithLines["items"][number]["inventoryItem"],
  destLocationId: string | null
) {
  if (!destLocationId) {
    throw new AppError("No stock location is configured at the destination site.", {
      code: "NO_DESTINATION_LOCATION",
    });
  }

  const existing = await tx.inventoryItem.findFirst({
    where: {
      companyId: source.companyId,
      sku: source.sku,
      siteId: transfer.toSiteId,
      stockLocationId: destLocationId,
      deletedAt: null,
    },
  });
  if (existing) return existing;

  return tx.inventoryItem.create({
    data: {
      companyId: source.companyId,
      sku: source.sku,
      name: source.name,
      description: source.description,
      categoryId: source.categoryId,
      itemTypeId: source.itemTypeId,
      siteId: transfer.toSiteId,
      stockLocationId: destLocationId,
      unit: source.unit,
      minQty: source.minQty,
      maxQty: source.maxQty,
      reorderLevel: source.reorderLevel,
      unitCost: source.unitCost,
      supplierId: source.supplierId,
      binLocation: null,
    },
  });
}

function appendNote(existing: string | null, addition: string): string {
  const trimmed = addition.trim();
  if (!trimmed) return existing ?? "";
  return existing ? `${existing}\n${trimmed}` : trimmed;
}
