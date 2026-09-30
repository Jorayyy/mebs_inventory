"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser, canAny, isGlobal } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { INVENTORY_TX_LABELS, STOCK_TX_LABELS } from "@/lib/constants";
import {
  ASSET_TX_GROUP,
  STOCK_TX_GROUP,
  TRANSACTION_GROUPS,
  TRANSACTION_GROUP_LABELS,
  resolveTypeFilter,
  type TransactionFilterOptions,
  type TransactionGroup,
  type TransactionPage,
  type TransactionQuery,
  type UnifiedTransaction,
} from "@/lib/transactions";
import type { InventoryTxType, StockTxType } from "@/generated/prisma";

const MAX_LEDGER_ROWS = 2000;

function startOfDay(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfDay(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function requireLedgerAccess() {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("You need to sign in to continue.", { status: 401, code: "UNAUTHENTICATED" });
  }
  if (!canAny(user, [PERMISSIONS.ASSETS_VIEW, PERMISSIONS.INVENTORY_VIEW])) {
    throw new AppError("You do not have permission to view inventory transactions.", {
      status: 403,
      code: "FORBIDDEN",
    });
  }
  return user;
}

/**
 * Read-only query across both immutable ledgers — the source of truth for
 * "what happened to inventory". Site-scoped and permission-checked.
 */
export async function queryInventoryTransactions(
  input: TransactionQuery = {}
): Promise<TransactionPage> {
  const user = await requireLedgerAccess();
  const global = isGlobal(user);
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(1, input.pageSize ?? 25), 100);
  const from = startOfDay(input.from);
  const to = endOfDay(input.to);
  const q = (input.q ?? "").trim();

  if (input.siteId && !global && !user.siteIds.includes(input.siteId)) {
    throw new AppError("You do not have access to that site.", { status: 403, code: "SITE_FORBIDDEN" });
  }
  if (
    input.type &&
    !TRANSACTION_GROUPS.includes(input.type as TransactionGroup) &&
    !Object.prototype.hasOwnProperty.call(INVENTORY_TX_LABELS, input.type) &&
    !Object.prototype.hasOwnProperty.call(STOCK_TX_LABELS, input.type)
  ) {
    throw new AppError("Unknown transaction type.", { code: "VALIDATION" });
  }

  // Normalise the requested action: either a headline group ("Received") or one
  // concrete ledger value ("RECEIVE"). Groups expand to every ledger value they
  // cover so a single filter works across both ledgers.
  const isGroup = !!input.type && (TRANSACTION_GROUPS as readonly string[]).includes(input.type);
  const assetTypes = resolveTypeFilter<InventoryTxType>(input.type, isGroup, ASSET_TX_GROUP);
  const stockTypes = resolveTypeFilter<StockTxType>(input.type, isGroup, STOCK_TX_GROUP);
  const wantAsset = input.ledger !== "stock";
  const wantStock = input.ledger !== "asset";

  const dateWindow = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

  const [assetRows, stockRows] = await Promise.all([
    wantAsset
      ? prisma.assetTransaction.findMany({
          where: {
            createdAt: dateWindow,
            ...(input.siteId ? { asset: { siteId: input.siteId } } : {}),
            ...(input.assetId ? { assetId: input.assetId } : {}),
            ...(assetTypes ? { type: { in: assetTypes } } : {}),
            ...(global ? {} : { asset: { siteId: { in: user.siteIds } } }),
            ...(q
              ? {
                  OR: [
                    { asset: { assetTag: { contains: q, mode: "insensitive" } } },
                    { asset: { name: { contains: q, mode: "insensitive" } } },
                    { notes: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: MAX_LEDGER_ROWS,
          select: {
            id: true,
            type: true,
            createdAt: true,
            fromStatus: true,
            toStatus: true,
            notes: true,
            referenceType: true,
            referenceId: true,
            performedBy: { select: { name: true } },
            asset: { select: { id: true, assetTag: true, name: true, status: true } },
            fromSite: { select: { name: true } },
            toSite: { select: { name: true } },
            toEmployee: { select: { firstName: true, lastName: true } },
            fromEmployee: { select: { firstName: true, lastName: true } },
          },
        })
      : Promise.resolve([]),
    wantStock
      ? prisma.inventoryTransaction.findMany({
          where: {
            createdAt: dateWindow,
            ...(input.siteId ? { inventoryItem: { siteId: input.siteId } } : {}),
            ...(input.inventoryItemId ? { inventoryItemId: input.inventoryItemId } : {}),
            ...(stockTypes ? { type: { in: stockTypes } } : {}),
            ...(global ? {} : { inventoryItem: { siteId: { in: user.siteIds } } }),
            ...(q
              ? {
                  OR: [
                    { inventoryItem: { sku: { contains: q, mode: "insensitive" } } },
                    { inventoryItem: { name: { contains: q, mode: "insensitive" } } },
                    { notes: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { createdAt: "desc" },
          take: MAX_LEDGER_ROWS,
          select: {
            id: true,
            type: true,
            quantity: true,
            balanceAfter: true,
            createdAt: true,
            notes: true,
            referenceType: true,
            referenceId: true,
            performedBy: { select: { name: true } },
            inventoryItem: { select: { id: true, sku: true, name: true, unit: true } },
            fromSite: { select: { name: true } },
            toSite: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const rows: UnifiedTransaction[] = [];

  for (const row of assetRows) {
    rows.push({
      id: `a_${row.id}`,
      ledger: "asset",
      group: ASSET_TX_GROUP[row.type],
      label: INVENTORY_TX_LABELS[row.type] ?? row.type,
      date: row.createdAt,
      subject: row.asset.assetTag,
      subjectName: row.asset.name,
      href: `/assets/${row.asset.id}`,
      quantity: null,
      from:
        row.fromSite?.name ??
        (row.fromEmployee ? `${row.fromEmployee.firstName} ${row.fromEmployee.lastName}` : null),
      to:
        row.toSite?.name ??
        (row.toEmployee ? `${row.toEmployee.firstName} ${row.toEmployee.lastName}` : null),
      performedBy: row.performedBy?.name ?? null,
      reference: row.referenceType ?? null,
      notes: row.notes,
      status: row.toStatus ?? row.fromStatus ?? null,
    });
  }

  for (const row of stockRows) {
    rows.push({
      id: `s_${row.id}`,
      ledger: "stock",
      group: STOCK_TX_GROUP[row.type],
      label: STOCK_TX_LABELS[row.type] ?? row.type,
      date: row.createdAt,
      subject: row.inventoryItem.sku,
      subjectName: row.inventoryItem.name,
      href: `/inventory/${row.inventoryItem.id}`,
      quantity: Number(row.quantity),
      from: row.fromSite?.name ?? null,
      to: row.toSite?.name ?? null,
      performedBy: row.performedBy?.name ?? null,
      reference: row.referenceType ?? null,
      notes: row.notes,
      status: `${row.balanceAfter} ${row.inventoryItem.unit.toLowerCase()}`,
    });
  }

  rows.sort((a, b) => b.date.getTime() - a.date.getTime());

  const groupFilter = new Set<string>();
  if (input.type) {
    if (TRANSACTION_GROUPS.includes(input.type as TransactionGroup)) {
      groupFilter.add(input.type);
    } else {
      const assetGroup = ASSET_TX_GROUP[input.type as InventoryTxType];
      const stockGroup = STOCK_TX_GROUP[input.type as StockTxType];
      if (assetGroup) groupFilter.add(assetGroup);
      if (stockGroup) groupFilter.add(stockGroup);
      if (groupFilter.size === 0) groupFilter.add("__unknown__");
    }
  }
  const filtered = input.type ? rows.filter((row) => groupFilter.has(row.group)) : rows;

  const start = (page - 1) * pageSize;
  return {
    rows: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

/** Filter payload for the transaction centre. */
export async function getTransactionFilterOptions(): Promise<TransactionFilterOptions> {
  const user = await requireLedgerAccess();
  const global = isGlobal(user);
  const sites = await prisma.site.findMany({
    where: { status: "ACTIVE", deletedAt: null, ...(global ? {} : { id: { in: user.siteIds } }) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return {
    sites,
    types: TRANSACTION_GROUPS.map((group) => ({
      value: group,
      label: TRANSACTION_GROUP_LABELS[group],
    })),
  };
}
