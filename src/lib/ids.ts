import type { Prisma, PrismaClient } from "@/generated/prisma";

type Db = Prisma.TransactionClient | PrismaClient;

function maxSequence(values: string[], suffixLength = 5): number {
  let max = 0;
  for (const value of values) {
    const match = value.match(/(\d+)\s*$/);
    if (!match) continue;
    const digits = match[1].slice(-suffixLength);
    const n = parseInt(digits, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * `MON-MNL-00001` style asset tag: {category prefix}-{site code}-{sequence}.
 * Concurrency-safe: callers must retry on unique-constraint violations (see createAsset).
 */
export async function nextAssetTag(
  db: Db,
  companyId: string,
  prefix: string,
  siteCode: string
): Promise<string> {
  const existing = await db.asset.findMany({
    where: { companyId, assetTag: { startsWith: `${prefix}-${siteCode}-` } },
    select: { assetTag: true },
    orderBy: { assetTag: "desc" },
    take: 100,
  });
  const seq = maxSequence(existing.map((a) => a.assetTag)) + 1;
  return `${prefix}-${siteCode}-${String(seq).padStart(5, "0")}`;
}

export async function nextReceiptNumber(db: Db, siteCode: string): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 7).replace("-", "");
  const prefix = `RCV-${siteCode}-${stamp}-`;
  const existing = await db.receiving.findMany({
    where: { receiptNumber: { startsWith: prefix } },
    select: { receiptNumber: true },
    orderBy: { receiptNumber: "desc" },
    take: 50,
  });
  const seq = maxSequence(existing.map((r) => r.receiptNumber), 4) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function nextTransferNumber(db: Db, fromCode: string, toCode: string): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 7).replace("-", "");
  const prefix = `TRF-${fromCode}-${toCode}-${stamp}-`;
  const existing = await db.transfer.findMany({
    where: { transferNumber: { startsWith: prefix } },
    select: { transferNumber: true },
    orderBy: { transferNumber: "desc" },
    take: 50,
  });
  const seq = maxSequence(existing.map((t) => t.transferNumber), 4) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function nextMaintenanceRef(db: Db): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 7).replace("-", "");
  const prefix = `MNT-${stamp}-`;
  const existing = await db.maintenanceRecord.findMany({
    where: { referenceNo: { startsWith: prefix } },
    select: { referenceNo: true },
    orderBy: { referenceNo: "desc" },
    take: 50,
  });
  const seq = maxSequence(existing.map((m) => m.referenceNo), 4) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function nextPurchaseOrderNumber(db: Db, siteCode: string): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 7).replace("-", "");
  const prefix = `PO-${siteCode}-${stamp}-`;
  const existing = await db.purchaseOrder.findMany({
    where: { poNumber: { startsWith: prefix } },
    select: { poNumber: true },
    orderBy: { poNumber: "desc" },
    take: 50,
  });
  const seq = maxSequence(existing.map((p) => p.poNumber), 4) + 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/** Generates a batch of consecutive tags (used by bulk receiving). */
export async function nextAssetTagBatch(
  db: Db,
  companyId: string,
  prefix: string,
  siteCode: string,
  count: number
): Promise<string[]> {
  const base = await nextAssetTag(db, companyId, prefix, siteCode);
  const start = parseInt(base.split("-").pop() ?? "1", 10);
  return Array.from({ length: count }, (_, i) =>
    `${prefix}-${siteCode}-${String(start + i).padStart(5, "0")}`
  );
}
