"use server";

import { requirePermission, can, isGlobal } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { AssignmentStatus, AssetStatus, MaintenanceStatus, Prisma, TransferStatus } from "@/generated/prisma";

export type DashboardStats = {
  totalAssets: number;
  acquisitionValue: number;
  assignedAssets: number;
  availableAssets: number;
  openTransfers: number;
  openMaintenance: number;
  lowStockItems: number;
  overdueReturns: number;
};

export type ChartPoint = { key?: string; label: string; value: number };

export type WarrantyExpiring = {
  id: string;
  assetTag: string;
  name: string;
  warrantyEnd: Date;
  daysLeft: number;
  status: string;
  siteName: string;
};

export type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  siteName: string;
  currentQty: number;
  threshold: number;
  unit: string;
};

export type PendingApproval = {
  id: string;
  transferNumber: string;
  fromSite: string;
  toSite: string;
  requestedBy: string;
  requestedAt: Date;
  lines: number;
};

export type RecentActivity = {
  id: string;
  action: string;
  entityType: string;
  description: string | null;
  userName: string | null;
  createdAt: Date;
};

export type SiteSummary = {
  siteId: string;
  siteName: string;
  siteCode: string;
  assets: number;
  assigned: number;
  available: number;
  items: number;
  lowStock: number;
};

export type DashboardData = {
  stats: DashboardStats;
  assetsByStatus: ChartPoint[];
  assetsBySite: ChartPoint[];
  topCategories: ChartPoint[];
  monthlyAdditions: ChartPoint[];
  stockValueByCategory: ChartPoint[];
  transferVolume: ChartPoint[];
  warrantyExpiring: WarrantyExpiring[];
  lowStockItems: LowStockItem[];
  pendingApprovals: PendingApproval[];
  recentActivity: RecentActivity[];
  siteSummary: SiteSummary[];
  generatedAt: Date;
};

const MONTH_FORMAT = new Intl.DateTimeFormat("en-PH", { month: "short", year: "2-digit" });

function monthBuckets(count: number): { key: string; label: string }[] {
  const now = new Date();
  const buckets: { key: string; label: string }[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: MONTH_FORMAT.format(date),
    });
  }
  return buckets;
}

function bucketize(dates: Date[], buckets: { key: string; label: string }[]): ChartPoint[] {
  const counts = new Map<string, number>(buckets.map((bucket) => [bucket.key, 0]));
  for (const date of dates) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return buckets.map((bucket) => ({ label: bucket.label, value: counts.get(bucket.key) ?? 0 }));
}

/** Aggregated dashboard figures for the signed-in user, computed entirely server-side. */
export async function getDashboardData(): Promise<DashboardData> {
  const user = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const ids = isGlobal(user) ? null : user.siteIds;

  const assetWhere: Prisma.AssetWhereInput = {
    ...(ids ? { siteId: { in: ids } } : {}),
    deletedAt: null,
  };
  const transferWhere: Prisma.TransferWhereInput = ids
    ? { OR: [{ fromSiteId: { in: ids } }, { toSiteId: { in: ids } }] }
    : {};
  const itemWhere: Prisma.InventoryItemWhereInput = {
    ...(ids ? { siteId: { in: ids } } : {}),
    isActive: true,
    deletedAt: null,
  };
  const maintenanceWhere: Prisma.MaintenanceRecordWhereInput = ids
    ? { asset: { siteId: { in: ids } } }
    : {};
  const assignmentWhere: Prisma.AssetAssignmentWhereInput = ids
    ? { OR: [{ siteId: { in: ids } }, { siteId: null, asset: { siteId: { in: ids } } }] }
    : {};
  const auditWhere: Prisma.AuditLogWhereInput = ids
    ? { OR: [{ siteId: { in: ids } }, { siteId: null }] }
    : {};

  const now = new Date();
  const warrantyHorizon = new Date(now.getTime() + 90 * 86_400_000);
  const buckets = monthBuckets(12);
  const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    assetAgg,
    statusGroups,
    categoryGroups,
    siteStatusGroups,
    openTransfers,
    openMaintenance,
    overdueReturns,
    creationDates,
    transferDates,
    sites,
    categories,
    warrantyRows,
    itemRows,
    pendingRows,
    activityRows,
  ] = await Promise.all([
    prisma.asset.aggregate({ where: assetWhere, _count: { _all: true }, _sum: { purchasePrice: true } }),
    prisma.asset.groupBy({ by: ["status"], where: assetWhere, _count: { _all: true } }),
    prisma.asset.groupBy({ by: ["categoryId"], where: assetWhere, _count: { _all: true } }),
    prisma.asset.groupBy({
      by: ["siteId", "status"],
      where: assetWhere,
      _count: { _all: true },
    }),
    prisma.transfer.count({
      where: { ...transferWhere, status: { in: ["PENDING_APPROVAL", "IN_TRANSIT"] as TransferStatus[] } },
    }),
    prisma.maintenanceRecord.count({
      where: {
        ...maintenanceWhere,
        status: { notIn: ["COMPLETED", "RETURNED_TO_SERVICE", "CANCELLED"] as MaintenanceStatus[] },
      },
    }),
    prisma.assetAssignment.count({
      where: {
        ...assignmentWhere,
        status: { in: ["ACTIVE", "RETURN_PENDING"] as AssignmentStatus[] },
        expectedReturnAt: { lt: now },
      },
    }),
    prisma.asset.findMany({ where: { ...assetWhere, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.transfer.findMany({ where: { ...transferWhere, requestedAt: { gte: since } }, select: { requestedAt: true } }),
    prisma.site.findMany({
      where: { deletedAt: null, ...(ids ? { id: { in: ids } } : {}) },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.asset.findMany({
      where: {
        ...assetWhere,
        warrantyEnd: { gte: now, lte: warrantyHorizon },
        status: { notIn: ["RETIRED", "DISPOSED"] as AssetStatus[] },
      },
      orderBy: { warrantyEnd: "asc" },
      take: 6,
      select: {
        id: true,
        assetTag: true,
        name: true,
        warrantyEnd: true,
        status: true,
        site: { select: { name: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      where: itemWhere,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        siteId: true,
        categoryId: true,
        currentQty: true,
        reorderLevel: true,
        minQty: true,
        unitCost: true,
        site: { select: { name: true } },
      },
    }),
    prisma.transfer.findMany({
      where: { ...transferWhere, status: "PENDING_APPROVAL" },
      orderBy: { requestedAt: "desc" },
      take: 6,
      select: {
        id: true,
        transferNumber: true,
        requestedAt: true,
        fromSite: { select: { name: true } },
        toSite: { select: { name: true } },
        requestedBy: { select: { name: true } },
        _count: { select: { assets: true, items: true } },
      },
    }),
    can(user, PERMISSIONS.AUDIT_VIEW)
      ? prisma.auditLog.findMany({
          where: auditWhere,
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            action: true,
            entityType: true,
            description: true,
            createdAt: true,
            user: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  const assetsByStatus: ChartPoint[] = statusGroups
    .map((group) => ({ key: group.status, label: group.status, value: group._count._all }))
    .filter((point) => point.value > 0)
    .sort((a, b) => b.value - a.value);

  const siteSummary: SiteSummary[] = sites.map((site) => ({
    siteId: site.id,
    siteName: site.name,
    siteCode: site.code,
    assets: 0,
    assigned: 0,
    available: 0,
    items: 0,
    lowStock: 0,
  }));
  const summaryById = new Map(siteSummary.map((entry) => [entry.siteId, entry]));

  for (const group of siteStatusGroups) {
    const entry = summaryById.get(group.siteId);
    if (!entry) continue;
    entry.assets += group._count._all;
    if (group.status === "ASSIGNED") entry.assigned += group._count._all;
    if (group.status === "AVAILABLE") entry.available += group._count._all;
  }

  const lowItems = itemRows.filter(
    (item) => Number(item.currentQty) <= Math.max(Number(item.reorderLevel), Number(item.minQty))
  );
  const lowItemIds = new Set(lowItems.map((item) => item.id));

  const valueByCategory = new Map<string, number>();
  const stockBySite = new Map<string, { items: number; low: number }>();
  for (const item of itemRows) {
    valueByCategory.set(
      item.categoryId,
      (valueByCategory.get(item.categoryId) ?? 0) + Number(item.currentQty) * Number(item.unitCost)
    );
    const entry = stockBySite.get(item.siteId) ?? { items: 0, low: 0 };
    entry.items += 1;
    if (lowItemIds.has(item.id)) entry.low += 1;
    stockBySite.set(item.siteId, entry);
  }
  for (const entry of siteSummary) {
    const stock = stockBySite.get(entry.siteId);
    if (stock) {
      entry.items = stock.items;
      entry.lowStock = stock.low;
    }
  }

  const topCategories: ChartPoint[] = categoryGroups
    .map((group) => ({
      label: categoryNameById.get(group.categoryId) ?? "Uncategorised",
      value: group._count._all,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const stockValueByCategory: ChartPoint[] = Array.from(valueByCategory.entries())
    .map(([categoryId, value]) => ({ label: categoryNameById.get(categoryId) ?? "Uncategorised", value }))
    .filter((point) => point.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const assignedAssets = statusGroups.find((group) => group.status === "ASSIGNED")?._count._all ?? 0;
  const availableAssets = statusGroups.find((group) => group.status === "AVAILABLE")?._count._all ?? 0;

  return {
    stats: {
      totalAssets: assetAgg._count._all,
      acquisitionValue: Number(assetAgg._sum.purchasePrice ?? 0),
      assignedAssets,
      availableAssets,
      openTransfers,
      openMaintenance,
      lowStockItems: lowItems.length,
      overdueReturns,
    },
    assetsByStatus,
    assetsBySite: siteSummary
      .map((entry) => ({ key: entry.siteId, label: entry.siteName, value: entry.assets }))
      .filter((point) => point.value > 0),
    topCategories,
    monthlyAdditions: bucketize(
      creationDates.map((row) => row.createdAt),
      buckets
    ),
    stockValueByCategory,
    transferVolume: bucketize(
      transferDates.map((row) => row.requestedAt),
      buckets
    ),
    warrantyExpiring: warrantyRows.map((asset) => ({
      id: asset.id,
      assetTag: asset.assetTag,
      name: asset.name,
      warrantyEnd: asset.warrantyEnd!,
      daysLeft: Math.ceil((asset.warrantyEnd!.getTime() - now.getTime()) / 86_400_000),
      status: asset.status,
      siteName: asset.site.name,
    })),
    lowStockItems: lowItems
      .map((item) => ({
        id: item.id,
        sku: item.sku,
        name: item.name,
        siteName: item.site.name,
        currentQty: Number(item.currentQty),
        threshold: Math.max(Number(item.reorderLevel), Number(item.minQty)),
        unit: item.unit,
      }))
      .sort((a, b) => a.currentQty / (a.threshold || 1) - b.currentQty / (b.threshold || 1))
      .slice(0, 6),
    pendingApprovals: can(user, PERMISSIONS.TRANSFERS_VIEW)
      ? pendingRows.map((transfer) => ({
          id: transfer.id,
          transferNumber: transfer.transferNumber,
          fromSite: transfer.fromSite.name,
          toSite: transfer.toSite.name,
          requestedBy: transfer.requestedBy.name,
          requestedAt: transfer.requestedAt,
          lines: transfer._count.assets + transfer._count.items,
        }))
      : [],
    recentActivity: activityRows.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      description: entry.description,
      userName: entry.user?.name ?? null,
      createdAt: entry.createdAt,
    })),
    siteSummary,
    generatedAt: now,
  };
}
