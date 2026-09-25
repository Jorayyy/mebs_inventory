import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Upload, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, isGlobal, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str, parseTableQuery } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { UrlDataTable } from "@/components/transfers/url-data-table";
import { Button } from "@/components/ui/button";
import { inventoryColumns, type InventoryRow } from "@/components/inventory/inventory-columns";
import {
  InventoryStats,
  LowStockPanel,
  type LowStockItem,
} from "@/components/inventory/low-stock-panel";
import { NewInventoryItemButton } from "@/components/inventory/inventory-form";
import { NewReceiptButton } from "@/components/inventory/receipt-form";
import type { Prisma } from "@/generated/prisma";

export const metadata: Metadata = { title: "Inventory" };

/** `currentQty <= reorderLevel` cannot be expressed in a Prisma where clause, so the
 *  matching rows are loaded once (capped), computed, filtered, sorted and paginated here. */
const MAX_ROWS = 50000;

const SORTABLE: Record<string, (row: InventoryRow) => string | number> = {
  sku: (row) => row.sku.toLowerCase(),
  name: (row) => row.name.toLowerCase(),
  unit: (row) => row.unit.toLowerCase(),
  currentQty: (row) => row.currentQty,
  reservedQty: (row) => row.reservedQty,
  available: (row) => row.available,
  reorderLevel: (row) => row.reorderLevel,
  unitCost: (row) => row.unitCost,
  value: (row) => row.value,
  category: (row) => row.category.name.toLowerCase(),
  site: (row) => row.site.name.toLowerCase(),
  status: (row) => (row.isActive ? 1 : 0),
  updated: (row) => row.updatedAt.getTime(),
};

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.INVENTORY_VIEW);
  const query = parseTableQuery(searchParams);

  const siteId = str(searchParams, "site");
  const categoryId = str(searchParams, "category");
  const locationId = str(searchParams, "location");
  const status = str(searchParams, "status");
  const lowOnly = str(searchParams, "low") === "yes";

  const scope: Prisma.InventoryItemWhereInput = isGlobal(user)
    ? {}
    : { siteId: { in: user.siteIds } };

  const canIssue = can(user, PERMISSIONS.INVENTORY_ISSUE);
  const canAdjust = can(user, PERMISSIONS.INVENTORY_ADJUST);
  const canReceive = can(user, PERMISSIONS.INVENTORY_RECEIVE);
  const rowFlags = { issue: canIssue, adjust: canAdjust, receive: canReceive };

  const where: Prisma.InventoryItemWhereInput = {
    ...scope,
    deletedAt: null,
    ...(siteId ? { siteId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(locationId ? { stockLocationId: locationId } : {}),
    ...(status === "active" ? { isActive: true } : status === "inactive" ? { isActive: false } : {}),
    ...(query.q
      ? {
          OR: [
            { sku: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
            { binLocation: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, sites, categories, locations] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        binLocation: true,
        unit: true,
        minQty: true,
        maxQty: true,
        reorderLevel: true,
        currentQty: true,
        reservedQty: true,
        unitCost: true,
        isActive: true,
        updatedAt: true,
        siteId: true,
        stockLocationId: true,
        site: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        stockLocation: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      take: MAX_ROWS,
      orderBy: { sku: "asc" },
    }),
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.stockLocation.findMany({
      where: {
        isActive: true,
        ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
        ...(siteId ? { siteId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const all: InventoryRow[] = items.map((item) => {
    const currentQty = Number(item.currentQty);
    const reservedQty = Number(item.reservedQty);
    const unitCost = Number(item.unitCost);
    const reorderLevel = Number(item.reorderLevel);
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      binLocation: item.binLocation,
      unit: item.unit,
      currentQty,
      reservedQty,
      available: currentQty - reservedQty,
      unitCost,
      reorderLevel,
      minQty: Number(item.minQty),
      maxQty: item.maxQty === null ? null : Number(item.maxQty),
      value: currentQty * unitCost,
      lowStock: currentQty <= reorderLevel,
      isActive: item.isActive,
      updatedAt: item.updatedAt,
      siteId: item.siteId,
      stockLocationId: item.stockLocationId,
      site: item.site,
      category: item.category,
      stockLocation: item.stockLocation,
      supplier: item.supplier,
      can: rowFlags,
    };
  });

  const summary = {
    itemCount: all.length,
    totalValue: all.reduce((sum, row) => sum + row.value, 0),
    lowCount: all.filter((row) => row.lowStock && row.isActive).length,
  };

  const lowItems: LowStockItem[] = all
    .filter((row) => row.lowStock && row.isActive)
    .sort((a, b) => a.currentQty / (a.reorderLevel || 1) - b.currentQty / (b.reorderLevel || 1))
    .slice(0, 5)
    .map((row) => ({
      id: row.id,
      sku: row.sku,
      name: row.name,
      unit: row.unit,
      currentQty: row.currentQty,
      reorderLevel: row.reorderLevel,
      siteName: row.site.name,
      locationName: row.stockLocation.name,
    }));

  const filtered = lowOnly ? all.filter((row) => row.lowStock) : all;

  const accessor = SORTABLE[query.sort];
  const dir = query.dir === "desc" ? -1 : 1;
  const sorted = accessor
    ? [...filtered].sort((a, b) => {
        const left = accessor(a);
        const right = accessor(b);
        if (left < right) return -1 * dir;
        if (left > right) return 1 * dir;
        return 0;
      })
    : filtered;

  const start = (query.page - 1) * query.pageSize;
  const rows = sorted.slice(start, start + query.pageSize);

  const showExport = can(user, PERMISSIONS.INVENTORY_EXPORT);

  const exportHref = `/api/export/inventory?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(searchParams)
        .map(([key, value]) => [key, Array.isArray(value) ? value[0] : (value ?? "")])
        .filter(([, value]) => value !== "")
    )
  ).toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        description={
          items.length >= MAX_ROWS
            ? `Showing the first ${MAX_ROWS.toLocaleString()} matching items — narrow the filters to see everything.`
            : `${filtered.length.toLocaleString()} item${filtered.length === 1 ? "" : "s"} matching the current filters.`
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory/receive">
                <Inbox /> Receiving
              </Link>
            </Button>
            {showExport && (
              <Button variant="outline" size="sm" asChild>
                <a href={exportHref}>
                  <Upload /> Export CSV
                </a>
              </Button>
            )}
            {canReceive && <NewReceiptButton />}
            {canAdjust && <NewInventoryItemButton />}
          </>
        }
      />

      <InventoryStats summary={summary} />

      {!lowOnly && <LowStockPanel items={lowItems} total={summary.lowCount} />}

      <FilterBar>
        <SearchInput placeholder="SKU, name, bin location…" defaultValue={query.q} />
        <FilterSelect
          param="site"
          label="Site"
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
        />
        <FilterSelect
          param="categoryId"
          label="Category"
          options={categories.map((category) => ({ value: category.id, label: category.name }))}
        />
        <FilterSelect
          param="location"
          label="Location"
          options={locations.map((location) => ({ value: location.id, label: location.name }))}
        />
        <FilterSelect
          param="status"
          label="Status"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
        <FilterSelect
          param="low"
          label="Stock"
          allLabel="Any stock level"
          options={[{ value: "yes", label: "Low stock" }]}
        />
      </FilterBar>

      <UrlDataTable
        columns={inventoryColumns}
        data={rows}
        total={sorted.length}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort || "sku"}
        dir={query.dir}
        emptyState={
          <EmptyState
            icon={<Boxes className="h-8 w-8" />}
            title="No inventory items match your filters"
            description="Clear the filters, or register a consumable item to start tracking stock."
            action={
              canAdjust ? (
                <NewInventoryItemButton label="New item" />
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
