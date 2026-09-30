/**
 * Canonical transaction vocabulary and shapes shared by the inventory
 * transaction centre. Kept out of `actions/transactions.ts` so the server
 * module only ever exports async functions.
 */

import type { InventoryTxType, StockTxType } from "@/generated/prisma";

/**
 * Headline actions shown in the Inventory transaction centre. Both ledgers
 * (assets and stock) are normalised into these groups so staff see one
 * consistent set of actions regardless of what was moved.
 */
export const TRANSACTION_GROUPS = [
  "RECEIVED",
  "ASSIGNED",
  "RETURNED",
  "TRANSFERRED",
  "ISSUED",
  "CONSUMED",
  "ADJUSTED",
  "MAINTENANCE",
  "DISPOSED",
] as const;

export type TransactionGroup = (typeof TRANSACTION_GROUPS)[number];

export const TRANSACTION_GROUP_LABELS: Record<TransactionGroup, string> = {
  RECEIVED: "Received",
  ASSIGNED: "Assigned",
  RETURNED: "Returned",
  TRANSFERRED: "Transferred",
  ISSUED: "Issued",
  CONSUMED: "Consumed",
  ADJUSTED: "Adjusted",
  MAINTENANCE: "Maintenance",
  DISPOSED: "Disposed",
};

export const ASSET_TX_GROUP: Record<InventoryTxType, TransactionGroup> = {
  RECEIVE: "RECEIVED",
  ASSIGN: "ASSIGNED",
  RETURN: "RETURNED",
  TRANSFER: "TRANSFERRED",
  ADJUSTMENT: "ADJUSTED",
  WRITE_OFF: "ADJUSTED",
  REPAIR: "MAINTENANCE",
  MAINTENANCE: "MAINTENANCE",
  DISPOSAL: "DISPOSED",
  ISSUE: "ISSUED",
  CONSUMPTION: "CONSUMED",
  REPLENISHMENT: "RECEIVED",
  RESERVED: "ADJUSTED",
  RELEASED: "ADJUSTED",
};

export const STOCK_TX_GROUP: Record<StockTxType, TransactionGroup> = {
  RECEIVE: "RECEIVED",
  REPLENISHMENT: "RECEIVED",
  ISSUE: "ISSUED",
  CONSUME: "CONSUMED",
  ADJUSTMENT: "ADJUSTED",
  WRITE_OFF: "ADJUSTED",
  TRANSFER_IN: "TRANSFERRED",
  TRANSFER_OUT: "TRANSFERRED",
  RESERVE: "ADJUSTED",
  RELEASE: "ADJUSTED",
};

export type UnifiedTransaction = {
  id: string;
  ledger: "asset" | "stock";
  group: TransactionGroup;
  label: string;
  date: Date;
  subject: string;
  subjectName: string;
  href: string;
  quantity: number | null;
  from: string | null;
  to: string | null;
  performedBy: string | null;
  reference: string | null;
  notes: string | null;
  status: string | null;
};

export type TransactionQuery = {
  from?: string;
  to?: string;
  siteId?: string;
  type?: string;
  ledger?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  /** Filter to a single asset's ledger. */
  assetId?: string;
  /** Filter to a single stock item's ledger. */
  inventoryItemId?: string;
};

export type TransactionPage = {
  rows: UnifiedTransaction[];
  total: number;
  page: number;
  pageSize: number;
};

export type TransactionFilterOptions = {
  sites: { id: string; name: string }[];
  types: { value: string; label: string }[];
};

/**
 * Maps a filter value onto concrete ledger values for one ledger.
 * Returns `null` when no filter applies, or a (possibly empty) list of values
 * that must match — an empty list simply means nothing in this ledger matches.
 */
export function resolveTypeFilter<T extends string>(
  requested: string | undefined,
  isGroup: boolean,
  groupMap: Record<T, TransactionGroup>
): T[] | null {
  if (!requested) return null;
  if (isGroup) {
    return (Object.keys(groupMap) as T[]).filter((key) => groupMap[key] === requested);
  }
  return Object.prototype.hasOwnProperty.call(groupMap, requested) ? [requested as T] : [];
}
