import { prisma } from "@/lib/prisma";
import { isGlobal, type SessionUser } from "@/lib/session";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/permissions";
import { formatCurrency, formatNumber, daysUntil } from "@/lib/utils";
import type { ReportParams } from "@/lib/validations/report";
import type {
  AssetStatus,
  AssignmentStatus,
  AuditAction,
  MaintenanceStatus,
  Prisma,
  StockTxType,
  TransferStatus,
} from "@/generated/prisma";
import type {
  ReportDefinition,
  ReportParamDef,
  ReportRow,
  ReportRunResult,
  ReportScope,
  ReportSummaryMetric,
} from "./types";
import { formatCellText } from "./format";

// ------------------------------------------------------------------------------
// Scope helpers — every report is restricted to the sites its user may see.
// ------------------------------------------------------------------------------

export function buildScope(user: SessionUser, params: { site?: string }): ReportScope {
  const siteIds = isGlobal(user) ? null : user.siteIds;
  const siteId = params.site ?? null;
  if (siteId && siteIds && !siteIds.includes(siteId)) {
    throw new AppError("You do not have access to that site.", { status: 403, code: "SITE_FORBIDDEN" });
  }
  return { user, siteIds, siteId };
}

function scopeIds(scope: ReportScope): string[] | null {
  return scope.siteId ? [scope.siteId] : scope.siteIds;
}

function assetScope(scope: ReportScope): Prisma.AssetWhereInput {
  const ids = scopeIds(scope);
  return ids ? { siteId: { in: ids } } : {};
}

function itemScope(scope: ReportScope): Prisma.InventoryItemWhereInput {
  const ids = scopeIds(scope);
  return ids ? { siteId: { in: ids } } : {};
}

function transferScope(scope: ReportScope): Prisma.TransferWhereInput {
  const ids = scopeIds(scope);
  return ids ? { OR: [{ fromSiteId: { in: ids } }, { toSiteId: { in: ids } }] } : {};
}

function assignmentScope(scope: ReportScope): Prisma.AssetAssignmentWhereInput {
  const ids = scopeIds(scope);
  return ids ? { asset: { siteId: { in: ids } } } : {};
}

function maintenanceScope(scope: ReportScope): Prisma.MaintenanceRecordWhereInput {
  const ids = scopeIds(scope);
  return ids ? { asset: { siteId: { in: ids } } } : {};
}

function auditScope(scope: ReportScope): Prisma.AuditLogWhereInput {
  const ids = scopeIds(scope);
  return ids ? { OR: [{ siteId: { in: ids } }, { siteId: null }] } : {};
}

function stockTxScope(scope: ReportScope): Prisma.InventoryTransactionWhereInput {
  const ids = scopeIds(scope);
  return ids ? { inventoryItem: { siteId: { in: ids } } } : {};
}

// ------------------------------------------------------------------------------
// Query helpers
// ------------------------------------------------------------------------------

function paging(params: ReportParams) {
  const pageSize = Math.min(Math.max(params.pageSize, 1), 50_000);
  const page = Math.max(1, params.page);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

type SortMap = Record<string, string | [string, string]>;

function buildOrderBy(params: ReportParams, map: SortMap, fallback: string, fallbackDir: "asc" | "desc" = "asc") {
  const requested = params.sort && map[params.sort] ? map[params.sort] : null;
  const target = requested ?? map[fallback];
  const dir: "asc" | "desc" = requested ? params.dir : fallbackDir;
  if (Array.isArray(target)) return { [target[0]]: { [target[1]]: dir } } as never;
  return { [target]: dir } as never;
}

function rangeFilter(params: ReportParams): Prisma.DateTimeFilter | undefined {
  if (!params.from && !params.to) return undefined;
  return {
    ...(params.from ? { gte: new Date(`${params.from}T00:00:00`) } : {}),
    ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999`) } : {}),
  };
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function isLowStock(item: { currentQty: unknown; reorderLevel: unknown; minQty: unknown }): boolean {
  return Number(item.currentQty) <= Math.max(Number(item.reorderLevel), Number(item.minQty));
}

function metric(label: string, value: number, format: "currency" | "number" = "number", hint?: string): ReportSummaryMetric {
  return { label, value: format === "currency" ? formatCurrency(value) : formatNumber(value), hint };
}

function searchOr(q: string | undefined, fields: string[]): Prisma.AssetWhereInput["OR"] | undefined {
  if (!q) return undefined;
  return fields.map((field) => ({ [field]: { contains: q, mode: "insensitive" } })) as Prisma.AssetWhereInput["OR"];
}

// ------------------------------------------------------------------------------
// Reports
// ------------------------------------------------------------------------------

const assetRegister: ReportDefinition = {
  slug: "asset-register",
  title: "Asset register",
  description: "Every tracked asset with ownership, location, condition, purchase value and warranty details.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: true,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "status", label: "Status", type: "status", optionsKey: "ASSET_STATUS" },
    { key: "categoryId", label: "Category", type: "category" },
    { key: "q", label: "Tag, serial, model…", type: "text" },
    { key: "from", label: "Added from", type: "date" },
    { key: "to", label: "Added to", type: "date" },
  ],
  columns: [
    { key: "assetTag", header: "Asset Tag", kind: "mono", sortable: true },
    { key: "name", header: "Name", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "site", header: "Site", sortable: true },
    { key: "status", header: "Status", kind: "badge", badge: "ASSET_STATUS", sortable: true },
    { key: "condition", header: "Condition", kind: "badge", badge: "ASSET_CONDITION" },
    { key: "serialNumber", header: "Serial", kind: "mono" },
    { key: "assignedTo", header: "Assigned To" },
    { key: "purchasePrice", header: "Value", kind: "currency", align: "right", sortable: true },
    { key: "warrantyEnd", header: "Warranty End", kind: "date", sortable: true },
    { key: "createdAt", header: "Added", kind: "date", sortable: true },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const q = params.q;
    const createdAt = rangeFilter(params);
    const where: Prisma.AssetWhereInput = {
      ...assetScope(scope),
      deletedAt: null,
      ...(params.status ? { status: params.status as AssetStatus } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(q
        ? {
            OR: searchOr(q, ["assetTag", "serialNumber", "name", "model", "brand"]) ?? [],
          }
        : {}),
    };
    const { skip, take } = paging(params);
    const [total, value, assigned, items] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.aggregate({ where, _sum: { purchasePrice: true } }),
      prisma.asset.count({ where: { ...where, assignedEmployeeId: { not: null } } }),
      prisma.asset.findMany({
        where,
        orderBy: buildOrderBy(
          params,
          {
            assetTag: "assetTag",
            name: "name",
            category: ["category", "name"],
            site: ["site", "name"],
            status: "status",
            purchasePrice: "purchasePrice",
            warrantyEnd: "warrantyEnd",
            createdAt: "createdAt",
          },
          "createdAt",
          "desc"
        ),
        skip,
        take,
        include: {
          site: { select: { name: true } },
          category: { select: { name: true } },
          assignedEmployee: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    const rows: ReportRow[] = items.map((asset) => ({
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category.name,
      site: asset.site.name,
      status: asset.status,
      condition: asset.condition,
      serialNumber: asset.serialNumber ?? null,
      assignedTo: asset.assignedEmployee
        ? `${asset.assignedEmployee.firstName} ${asset.assignedEmployee.lastName}`
        : null,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
      warrantyEnd: asset.warrantyEnd,
      createdAt: asset.createdAt,
    }));

    return {
      rows,
      total,
      summary: [
        metric("Assets", total),
        metric("Acquisition value", Number(value._sum.purchasePrice ?? 0), "currency"),
        metric("Assigned", assigned),
      ],
    };
  },
};

const assetByStatus: ReportDefinition = {
  slug: "asset-by-status",
  title: "Assets by status",
  description: "Asset counts and acquisition value broken down by lifecycle status.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: false,
  params: [{ key: "site", label: "Site", type: "site" }],
  columns: [
    { key: "status", header: "Status", kind: "badge", badge: "ASSET_STATUS", sortable: true },
    { key: "assets", header: "Assets", kind: "number", align: "right", sortable: true },
    { key: "value", header: "Acquisition value", kind: "currency", align: "right", sortable: true },
    { key: "share", header: "Share", kind: "percent", align: "right", sortable: true },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const where: Prisma.AssetWhereInput = { ...assetScope(scope), deletedAt: null };
    const [groups, totals] = await Promise.all([
      prisma.asset.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
        _sum: { purchasePrice: true },
      }),
      prisma.asset.aggregate({ where, _sum: { purchasePrice: true } }),
    ]);

    const grandTotal = groups.reduce((sum, group) => sum + group._count._all, 0);
    const rows: ReportRow[] = groups
      .map((group) => ({
        status: group.status,
        assets: group._count._all,
        value: Number(group._sum.purchasePrice ?? 0),
        share: grandTotal ? (group._count._all / grandTotal) * 100 : 0,
      }))
      .sort((a, b) => b.assets - a.assets);

    return {
      rows,
      total: rows.length,
      summary: [
        metric("Assets", grandTotal),
        metric("Statuses in use", rows.length),
        metric("Acquisition value", Number(totals._sum.purchasePrice ?? 0), "currency"),
      ],
    };
  },
};

const assetBySite: ReportDefinition = {
  slug: "asset-by-site",
  title: "Assets by site",
  description: "Asset distribution across sites with assigned, available and valuation figures.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: false,
  params: [{ key: "site", label: "Site", type: "site" }],
  columns: [
    { key: "site", header: "Site", sortable: true },
    { key: "code", header: "Code", kind: "mono", sortable: true },
    { key: "assets", header: "Assets", kind: "number", align: "right", sortable: true },
    { key: "assigned", header: "Assigned", kind: "number", align: "right", sortable: true },
    { key: "available", header: "Available", kind: "number", align: "right", sortable: true },
    { key: "value", header: "Acquisition value", kind: "currency", align: "right", sortable: true },
    { key: "share", header: "Share", kind: "percent", align: "right", sortable: true },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const where: Prisma.AssetWhereInput = { ...assetScope(scope), deletedAt: null };
    const [groups, sites] = await Promise.all([
      prisma.asset.groupBy({
        by: ["siteId", "status"],
        where,
        _count: { _all: true },
        _sum: { purchasePrice: true },
      }),
      prisma.site.findMany({
        where: { deletedAt: null, ...(scope.siteIds ? { id: { in: scope.siteIds } } : {}) },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const bySite = new Map<
      string,
      { assets: number; assigned: number; available: number; value: number }
    >();
    for (const group of groups) {
      const entry = bySite.get(group.siteId) ?? { assets: 0, assigned: 0, available: 0, value: 0 };
      entry.assets += group._count._all;
      if (group.status === "ASSIGNED") entry.assigned += group._count._all;
      if (group.status === "AVAILABLE") entry.available += group._count._all;
      entry.value += Number(group._sum.purchasePrice ?? 0);
      bySite.set(group.siteId, entry);
    }

    const grandTotal = Array.from(bySite.values()).reduce((sum, entry) => sum + entry.assets, 0);
    const rows: ReportRow[] = sites
      .map((site) => {
        const entry = bySite.get(site.id) ?? { assets: 0, assigned: 0, available: 0, value: 0 };
        return {
          site: site.name,
          code: site.code,
          assets: entry.assets,
          assigned: entry.assigned,
          available: entry.available,
          value: entry.value,
          share: grandTotal ? (entry.assets / grandTotal) * 100 : 0,
        };
      })
      .sort((a, b) => b.assets - a.assets);

    return {
      rows,
      total: rows.length,
      summary: [
        metric("Sites", rows.length),
        metric("Assets", grandTotal),
        metric(
          "Acquisition value",
          rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0),
          "currency"
        ),
      ],
    };
  },
};

const warrantyExpiry: ReportDefinition = {
  slug: "warranty-expiry",
  title: "Warranty expiry",
  description: "Assets whose warranty expires in the selected window (defaults to the next 90 days).",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: true,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "from", label: "Expires from", type: "date" },
    { key: "to", label: "Expires to", type: "date" },
    { key: "q", label: "Tag, name…", type: "text" },
  ],
  columns: [
    { key: "assetTag", header: "Asset Tag", kind: "mono", sortable: true },
    { key: "name", header: "Name", sortable: true },
    { key: "site", header: "Site", sortable: true },
    { key: "status", header: "Status", kind: "badge", badge: "ASSET_STATUS", sortable: true },
    { key: "serialNumber", header: "Serial", kind: "mono" },
    { key: "warrantyEnd", header: "Warranty End", kind: "date", sortable: true },
    { key: "daysLeft", header: "Days left", kind: "number", align: "right" },
    { key: "purchasePrice", header: "Value", kind: "currency", align: "right", sortable: true },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const q = params.q;
    const today = new Date();
    const from = params.from ?? isoDay(today);
    const to = params.to ?? isoDay(new Date(today.getTime() + (params.days ?? 90) * 86_400_000));
    const where: Prisma.AssetWhereInput = {
      ...assetScope(scope),
      deletedAt: null,
      warrantyEnd: { not: null, gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) },
      status: { notIn: ["RETIRED", "DISPOSED"] as AssetStatus[] },
      ...(q
        ? { OR: searchOr(q, ["assetTag", "name", "serialNumber"]) ?? [] }
        : {}),
    };
    const { skip, take } = paging(params);
    const [total, value, items] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.aggregate({ where, _sum: { purchasePrice: true } }),
      prisma.asset.findMany({
        where,
        orderBy: buildOrderBy(
          params,
          {
            assetTag: "assetTag",
            name: "name",
            site: ["site", "name"],
            status: "status",
            warrantyEnd: "warrantyEnd",
            purchasePrice: "purchasePrice",
          },
          "warrantyEnd",
          "asc"
        ),
        skip,
        take,
        include: { site: { select: { name: true } } },
      }),
    ]);

    const rows: ReportRow[] = items.map((asset) => ({
      assetTag: asset.assetTag,
      name: asset.name,
      site: asset.site.name,
      status: asset.status,
      serialNumber: asset.serialNumber ?? null,
      warrantyEnd: asset.warrantyEnd,
      daysLeft: daysUntil(asset.warrantyEnd) ?? 0,
      purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
    }));

    return {
      rows,
      total,
      summary: [
        metric("Expiring assets", total),
        metric("Value at risk", Number(value._sum.purchasePrice ?? 0), "currency"),
        { label: "Window", value: `${from} → ${to}` },
      ],
    };
  },
};

const stockOnHand: ReportDefinition = {
  slug: "stock-on-hand",
  title: "Stock on hand",
  description: "Current consumable balances, reorder levels and stock value per item and location.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: true,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "categoryId", label: "Category", type: "category" },
    { key: "q", label: "SKU or item name…", type: "text" },
  ],
  columns: [
    { key: "sku", header: "SKU", kind: "mono", sortable: true },
    { key: "name", header: "Item", sortable: true },
    { key: "category", header: "Category", sortable: true },
    { key: "site", header: "Site", sortable: true },
    { key: "location", header: "Location" },
    { key: "unit", header: "Unit", kind: "mono" },
    { key: "currentQty", header: "On hand", kind: "number", align: "right", sortable: true },
    { key: "reorderLevel", header: "Reorder at", kind: "number", align: "right" },
    { key: "unitCost", header: "Unit cost", kind: "currency", align: "right" },
    { key: "stockValue", header: "Stock value", kind: "currency", align: "right" },
    { key: "stockLevel", header: "Level", kind: "badge", badge: "STOCK_LEVEL" },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const q = params.q;
    const where: Prisma.InventoryItemWhereInput = {
      ...itemScope(scope),
      isActive: true,
      deletedAt: null,
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
      ...(q
        ? { OR: [{ sku: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] }
        : {}),
    };
    const { skip, take } = paging(params);
    const [total, balances, items] = await Promise.all([
      prisma.inventoryItem.count({ where }),
      prisma.inventoryItem.findMany({
        where,
        select: { currentQty: true, unitCost: true, reorderLevel: true, minQty: true },
      }),
      prisma.inventoryItem.findMany({
        where,
        orderBy: buildOrderBy(
          params,
          { sku: "sku", name: "name", category: ["category", "name"], site: ["site", "name"], currentQty: "currentQty" },
          "name",
          "asc"
        ),
        skip,
        take,
        include: {
          category: { select: { name: true } },
          site: { select: { name: true } },
          stockLocation: { select: { name: true } },
        },
      }),
    ]);

    const rows: ReportRow[] = items.map((item) => {
      const qty = Number(item.currentQty);
      const unitCost = Number(item.unitCost);
      const low = isLowStock(item);
      const over = Boolean(item.maxQty) && qty > Number(item.maxQty);
      return {
        sku: item.sku,
        name: item.name,
        category: item.category.name,
        site: item.site.name,
        location: item.stockLocation.name,
        unit: item.unit,
        currentQty: qty,
        reorderLevel: Number(item.reorderLevel),
        unitCost,
        stockValue: qty * unitCost,
        stockLevel: low ? "LOW" : over ? "OVERSTOCK" : "OK",
      };
    });

    const stockValue = balances.reduce((sum, row) => sum + Number(row.currentQty) * Number(row.unitCost), 0);
    const lowCount = balances.filter(isLowStock).length;

    return {
      rows,
      total,
      summary: [
        metric("Items", total),
        metric("Stock value", stockValue, "currency"),
        metric("Below reorder level", lowCount),
      ],
    };
  },
};

const stockMovements: ReportDefinition = {
  slug: "stock-movements",
  title: "Stock movements",
  description: "Immutable stock ledger: receipts, issues, adjustments and transfers with running balances.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: true,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "status", label: "Movement type", type: "status", optionsKey: "STOCK_TX" },
    { key: "from", label: "From", type: "date" },
    { key: "to", label: "To", type: "date" },
    { key: "q", label: "Item or reference…", type: "text" },
  ],
  columns: [
    { key: "createdAt", header: "Date", kind: "datetime", sortable: true },
    { key: "item", header: "Item", sortable: true },
    { key: "sku", header: "SKU", kind: "mono" },
    { key: "type", header: "Type", kind: "badge", badge: "STOCK_TX", sortable: true },
    { key: "quantity", header: "Qty", kind: "number", align: "right", sortable: true },
    { key: "balanceAfter", header: "Balance", kind: "number", align: "right", sortable: true },
    { key: "fromSite", header: "From site" },
    { key: "toSite", header: "To site" },
    { key: "performedBy", header: "By" },
    { key: "reference", header: "Reference", kind: "mono" },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const q = params.q;
    const createdAt = rangeFilter(params);
    const where: Prisma.InventoryTransactionWhereInput = {
      ...stockTxScope(scope),
      ...(createdAt ? { createdAt } : {}),
      ...(params.status ? { type: params.status as StockTxType } : {}),
      ...(q
        ? {
            OR: [
              { inventoryItem: { name: { contains: q, mode: "insensitive" } } },
              { inventoryItem: { sku: { contains: q, mode: "insensitive" } } },
              { referenceId: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const { skip, take } = paging(params);
    const [total, totals, items] = await Promise.all([
      prisma.inventoryTransaction.count({ where }),
      prisma.inventoryTransaction.aggregate({ where, _sum: { quantity: true } }),
      prisma.inventoryTransaction.findMany({
        where,
        orderBy: buildOrderBy(
          params,
          { createdAt: "createdAt", type: "type", quantity: "quantity", balanceAfter: "balanceAfter", item: ["inventoryItem", "name"] },
          "createdAt",
          "desc"
        ),
        skip,
        take,
        include: {
          inventoryItem: { select: { sku: true, name: true } },
          performedBy: { select: { name: true } },
          fromSite: { select: { name: true } },
          toSite: { select: { name: true } },
        },
      }),
    ]);

    const rows: ReportRow[] = items.map((tx) => ({
      createdAt: tx.createdAt,
      item: tx.inventoryItem.name,
      sku: tx.inventoryItem.sku,
      type: tx.type,
      quantity: Number(tx.quantity),
      balanceAfter: Number(tx.balanceAfter),
      fromSite: tx.fromSite?.name ?? null,
      toSite: tx.toSite?.name ?? null,
      performedBy: tx.performedBy?.name ?? null,
      reference: tx.referenceId ?? tx.referenceType ?? null,
    }));

    return {
      rows,
      total,
      summary: [
        metric("Movements", total),
        metric("Net quantity", Number(totals._sum.quantity ?? 0)),
        metric("Types in range", new Set(rows.map((row) => String(row.type))).size),
      ],
    };
  },
};

const assignmentRegister: ReportDefinition = {
  slug: "assignment-register",
  title: "Assignment register",
  description: "Every custody assignment with employee, dates, expected returns and condition history.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: true,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "status", label: "Status", type: "status", optionsKey: "ASSIGNMENT_STATUS" },
    { key: "from", label: "Assigned from", type: "date" },
    { key: "to", label: "Assigned to", type: "date" },
    { key: "q", label: "Tag or employee…", type: "text" },
  ],
  columns: [
    { key: "assetTag", header: "Asset Tag", kind: "mono", sortable: true },
    { key: "assetName", header: "Asset" },
    { key: "employee", header: "Employee", sortable: true },
    { key: "site", header: "Site", sortable: true },
    { key: "status", header: "Status", kind: "badge", badge: "ASSIGNMENT_STATUS", sortable: true },
    { key: "assignedAt", header: "Assigned", kind: "datetime", sortable: true },
    { key: "expectedReturnAt", header: "Due back", kind: "date", sortable: true },
    { key: "returnedAt", header: "Returned", kind: "date", sortable: true },
    { key: "condition", header: "Condition at hand-over", kind: "badge", badge: "ASSET_CONDITION" },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const q = params.q;
    const assignedAt = rangeFilter(params);
    const where: Prisma.AssetAssignmentWhereInput = {
      ...assignmentScope(scope),
      ...(params.status ? { status: params.status as AssignmentStatus } : {}),
      ...(assignedAt ? { assignedAt } : {}),
      ...(q
        ? {
            OR: [
              { asset: { assetTag: { contains: q, mode: "insensitive" } } },
              { asset: { name: { contains: q, mode: "insensitive" } } },
              { employee: { lastName: { contains: q, mode: "insensitive" } } },
              { employee: { employeeNo: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const { skip, take } = paging(params);
    const now = new Date();
    const [total, active, overdue, items] = await Promise.all([
      prisma.assetAssignment.count({ where }),
      prisma.assetAssignment.count({ where: { ...where, status: { in: ["ACTIVE", "RETURN_PENDING"] as AssignmentStatus[] } } }),
      prisma.assetAssignment.count({
        where: {
          ...where,
          status: { in: ["ACTIVE", "RETURN_PENDING"] as AssignmentStatus[] },
          expectedReturnAt: { lt: now },
        },
      }),
      prisma.assetAssignment.findMany({
        where,
        orderBy: buildOrderBy(
          params,
          {
            assetTag: ["asset", "assetTag"],
            employee: ["employee", "lastName"],
            site: ["asset", "site"],
            status: "status",
            assignedAt: "assignedAt",
            expectedReturnAt: "expectedReturnAt",
            returnedAt: "returnedAt",
          },
          "assignedAt",
          "desc"
        ),
        skip,
        take,
        include: {
          asset: { select: { assetTag: true, name: true, site: { select: { name: true } } } },
          employee: { select: { firstName: true, lastName: true, employeeNo: true } },
        },
      }),
    ]);

    const rows: ReportRow[] = items.map((assignment) => ({
      assetTag: assignment.asset.assetTag,
      assetName: assignment.asset.name,
      employee: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
      site: assignment.asset.site.name,
      status: assignment.status,
      assignedAt: assignment.assignedAt,
      expectedReturnAt: assignment.expectedReturnAt,
      returnedAt: assignment.returnedAt,
      condition: assignment.conditionAtAssignment,
    }));

    return {
      rows,
      total,
      summary: [
        metric("Assignments", total),
        metric("Open", active),
        metric("Overdue returns", overdue),
      ],
    };
  },
};

const transferHistory: ReportDefinition = {
  slug: "transfer-history",
  title: "Transfer history",
  description: "Inter-site transfers with approval, shipping and receipt milestones.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: true,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "status", label: "Status", type: "status", optionsKey: "TRANSFER_STATUS" },
    { key: "from", label: "Requested from", type: "date" },
    { key: "to", label: "Requested to", type: "date" },
    { key: "q", label: "Transfer number…", type: "text" },
  ],
  columns: [
    { key: "transferNumber", header: "Transfer No.", kind: "mono", sortable: true },
    { key: "fromSite", header: "From", sortable: true },
    { key: "toSite", header: "To", sortable: true },
    { key: "status", header: "Status", kind: "badge", badge: "TRANSFER_STATUS", sortable: true },
    { key: "requestedBy", header: "Requested By" },
    { key: "requestedAt", header: "Requested", kind: "date", sortable: true },
    { key: "shippedAt", header: "Shipped", kind: "date", sortable: true },
    { key: "actualArrival", header: "Received", kind: "date", sortable: true },
    { key: "lines", header: "Lines", kind: "number", align: "right" },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const q = params.q;
    const requestedAt = rangeFilter(params);
    const where: Prisma.TransferWhereInput = {
      ...transferScope(scope),
      ...(params.status ? { status: params.status as TransferStatus } : {}),
      ...(requestedAt ? { requestedAt } : {}),
      ...(q ? { transferNumber: { contains: q, mode: "insensitive" } } : {}),
    };
    const { skip, take } = paging(params);
    const [total, statusGroups, items] = await Promise.all([
      prisma.transfer.count({ where }),
      prisma.transfer.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.transfer.findMany({
        where,
        orderBy: buildOrderBy(
          params,
          {
            transferNumber: "transferNumber",
            fromSite: ["fromSite", "name"],
            toSite: ["toSite", "name"],
            status: "status",
            requestedAt: "requestedAt",
            shippedAt: "shippedAt",
            actualArrival: "actualArrival",
          },
          "requestedAt",
          "desc"
        ),
        skip,
        take,
        include: {
          fromSite: { select: { name: true } },
          toSite: { select: { name: true } },
          requestedBy: { select: { name: true } },
          _count: { select: { assets: true, items: true } },
        },
      }),
    ]);

    const rows: ReportRow[] = items.map((transfer) => ({
      transferNumber: transfer.transferNumber,
      fromSite: transfer.fromSite.name,
      toSite: transfer.toSite.name,
      status: transfer.status,
      requestedBy: transfer.requestedBy.name,
      requestedAt: transfer.requestedAt,
      shippedAt: transfer.shippedAt,
      actualArrival: transfer.actualArrival,
      lines: transfer._count.assets + transfer._count.items,
    }));

    const countFor = (status: TransferStatus) =>
      statusGroups.find((group) => group.status === status)?._count._all ?? 0;

    return {
      rows,
      total,
      summary: [
        metric("Transfers", total),
        metric("Pending approval", countFor("PENDING_APPROVAL")),
        metric("In transit", countFor("IN_TRANSIT")),
        metric("Completed", countFor("COMPLETED")),
      ],
    };
  },
};

const maintenanceHistory: ReportDefinition = {
  slug: "maintenance-history",
  title: "Maintenance history",
  description: "Repair and maintenance tickets with technician, cost and turnaround details.",
  permission: PERMISSIONS.REPORTS_VIEW,
  serverPaging: true,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "status", label: "Status", type: "status", optionsKey: "MAINTENANCE_STATUS" },
    { key: "from", label: "Reported from", type: "date" },
    { key: "to", label: "Reported to", type: "date" },
    { key: "q", label: "Issue or reference…", type: "text" },
  ],
  columns: [
    { key: "referenceNo", header: "Reference", kind: "mono", sortable: true },
    { key: "assetTag", header: "Asset Tag", kind: "mono", sortable: true },
    { key: "issue", header: "Issue", sortable: true },
    { key: "status", header: "Status", kind: "badge", badge: "MAINTENANCE_STATUS", sortable: true },
    { key: "reportedBy", header: "Reported By" },
    { key: "technician", header: "Technician" },
    { key: "reportedAt", header: "Reported", kind: "date", sortable: true },
    { key: "completedAt", header: "Completed", kind: "date", sortable: true },
    { key: "cost", header: "Cost", kind: "currency", align: "right", sortable: true },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const q = params.q;
    const reportedAt = rangeFilter(params);
    const where: Prisma.MaintenanceRecordWhereInput = {
      ...maintenanceScope(scope),
      ...(params.status ? { status: params.status as MaintenanceStatus } : {}),
      ...(reportedAt ? { reportedAt } : {}),
      ...(q
        ? {
            OR: [
              { issue: { contains: q, mode: "insensitive" } },
              { referenceNo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const { skip, take } = paging(params);
    const [total, open, cost, items] = await Promise.all([
      prisma.maintenanceRecord.count({ where }),
      prisma.maintenanceRecord.count({
        where: { ...where, status: { notIn: ["COMPLETED", "RETURNED_TO_SERVICE", "CANCELLED"] as MaintenanceStatus[] } },
      }),
      prisma.maintenanceRecord.aggregate({ where, _sum: { cost: true } }),
      prisma.maintenanceRecord.findMany({
        where,
        orderBy: buildOrderBy(
          params,
          {
            referenceNo: "referenceNo",
            assetTag: ["asset", "assetTag"],
            issue: "issue",
            status: "status",
            reportedAt: "reportedAt",
            completedAt: "completedAt",
            cost: "cost",
          },
          "reportedAt",
          "desc"
        ),
        skip,
        take,
        include: {
          asset: { select: { assetTag: true } },
          reportedBy: { select: { name: true } },
          technician: { select: { name: true } },
        },
      }),
    ]);

    const rows: ReportRow[] = items.map((record) => ({
      referenceNo: record.referenceNo,
      assetTag: record.asset.assetTag,
      issue: record.issue,
      status: record.status,
      reportedBy: record.reportedBy.name,
      technician: record.technician?.name ?? null,
      reportedAt: record.reportedAt,
      completedAt: record.completedAt,
      cost: Number(record.cost),
    }));

    return {
      rows,
      total,
      summary: [
        metric("Tickets", total),
        metric("Open tickets", open),
        metric("Total cost", Number(cost._sum.cost ?? 0), "currency"),
      ],
    };
  },
};

const auditSummary: ReportDefinition = {
  slug: "audit-summary",
  title: "Audit summary",
  description: "Activity volume per audit action within the selected period, with last occurrence.",
  permission: PERMISSIONS.AUDIT_VIEW,
  serverPaging: false,
  params: [
    { key: "site", label: "Site", type: "site" },
    { key: "from", label: "From", type: "date" },
    { key: "to", label: "To", type: "date" },
  ],
  columns: [
    { key: "action", header: "Action", kind: "badge", badge: "AUDIT_ACTION", sortable: true },
    { key: "entries", header: "Entries", kind: "number", align: "right", sortable: true },
    { key: "share", header: "Share", kind: "percent", align: "right", sortable: true },
    { key: "lastActivity", header: "Last seen", kind: "datetime", sortable: true },
  ],
  run: async (params, scope): Promise<ReportRunResult> => {
    const createdAt = rangeFilter(params);
    const where: Prisma.AuditLogWhereInput = {
      ...auditScope(scope),
      ...(createdAt ? { createdAt } : {}),
    };
    const [groups, contributors] = await Promise.all([
      prisma.auditLog.groupBy({
        by: ["action"],
        where,
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      prisma.auditLog.groupBy({ by: ["userId"], where, _count: { _all: true } }),
    ]);

    const grandTotal = groups.reduce((sum, group) => sum + group._count._all, 0);
    const rows: ReportRow[] = groups
      .map((group) => ({
        action: group.action as string,
        entries: group._count._all,
        share: grandTotal ? (group._count._all / grandTotal) * 100 : 0,
        lastActivity: group._max.createdAt,
      }))
      .sort((a, b) => b.entries - a.entries);

    return {
      rows,
      total: rows.length,
      summary: [
        metric("Entries", grandTotal),
        metric("Actions recorded", rows.length),
        metric("Contributors", contributors.filter((entry) => entry.userId).length),
      ],
    };
  },
};

export const REPORTS: ReportDefinition[] = [
  assetRegister,
  assetByStatus,
  assetBySite,
  warrantyExpiry,
  stockOnHand,
  stockMovements,
  assignmentRegister,
  transferHistory,
  maintenanceHistory,
  auditSummary,
];

export const REPORT_BY_SLUG: Record<string, ReportDefinition> = Object.fromEntries(
  REPORTS.map((report) => [report.slug, report])
);

export function getReport(slug: string): ReportDefinition | undefined {
  return REPORT_BY_SLUG[slug];
}

/** CSV body (header + rows) for a report — shared by `/api/export/report`. */
export function reportCsvRows(def: ReportDefinition, rows: ReportRow[]): (string | number)[][] {
  const header = def.columns.map((column) => column.header);
  const body = rows.map((row) =>
    def.columns.map((column) => formatCellText(row[column.key], column.kind, ""))
  );
  return [header, ...body];
}
