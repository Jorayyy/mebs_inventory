import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, assertSiteAccess, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { InventoryDetail, type InventoryDetailData } from "@/components/inventory/inventory-detail";

export const metadata: Metadata = { title: "Inventory item" };

export default async function InventoryItemPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.INVENTORY_VIEW);

  const item = await prisma.inventoryItem.findUnique({
    where: { id: params.id },
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
      unitCost: true,
      currentQty: true,
      reservedQty: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastMovementAt: true,
      deletedAt: true,
      siteId: true,
      stockLocationId: true,
      category: { select: { id: true, name: true } },
      itemType: { select: { id: true, name: true } },
      site: { select: { id: true, name: true, code: true } },
      stockLocation: { select: { id: true, name: true, code: true } },
      supplier: { select: { id: true, name: true } },
    },
  });

  if (!item || item.deletedAt) notFound();
  assertSiteAccess(user, item.siteId);

  const ledger = await prisma.inventoryTransaction.findMany({
    where: { inventoryItemId: item.id },
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true,
      type: true,
      quantity: true,
      balanceAfter: true,
      unitCost: true,
      notes: true,
      referenceType: true,
      referenceId: true,
      createdAt: true,
      fromLocationId: true,
      toLocationId: true,
      performedBy: { select: { name: true } },
      fromLocation: { select: { id: true, name: true } },
      toLocation: { select: { id: true, name: true } },
    },
  });

  const locationIds = new Set<string>();
  for (const tx of ledger) {
    if (tx.toLocationId) locationIds.add(tx.toLocationId);
    if (tx.fromLocationId) locationIds.add(tx.fromLocationId);
  }

  const balances = new Map<
    string,
    { balance: number; movements: number; lastAt: Date | null }
  >();
  for (const locationId of locationIds) {
    balances.set(locationId, { balance: 0, movements: 0, lastAt: null });
  }

  for (const tx of [...ledger].reverse()) {
    const quantity = Number(tx.quantity);
    if (tx.toLocationId && tx.fromLocationId && tx.toLocationId !== tx.fromLocationId) {
      const moved = Math.abs(quantity);
      const from = balances.get(tx.fromLocationId);
      const to = balances.get(tx.toLocationId);
      if (from) {
        from.balance -= moved;
        from.movements += 1;
        from.lastAt = tx.createdAt;
      }
      if (to) {
        to.balance += moved;
        to.movements += 1;
        to.lastAt = tx.createdAt;
      }
      continue;
    }
    const locationId = tx.toLocationId ?? tx.fromLocationId;
    if (!locationId) continue;
    const bucket = balances.get(locationId);
    if (!bucket) continue;
    bucket.balance += quantity;
    bucket.movements += 1;
    bucket.lastAt = tx.createdAt;
  }

  const locations: InventoryDetailData["locations"] = [];
  for (const [locationId, bucket] of balances) {
    const name =
      locationId === item.stockLocationId
        ? item.stockLocation.name
        : ledger.find((tx) => tx.toLocation?.id === locationId)?.toLocation?.name ??
          ledger.find((tx) => tx.fromLocation?.id === locationId)?.fromLocation?.name ??
          "Unknown location";
    locations.push({
      locationId,
      name,
      code: null,
      balance: bucket.balance,
      movements: bucket.movements,
      lastAt: bucket.lastAt,
      isHome: locationId === item.stockLocationId,
    });
  }
  locations.sort((a, b) => Number(b.isHome) - Number(a.isHome) || b.balance - a.balance);

  const currentQty = Number(item.currentQty);
  const reservedQty = Number(item.reservedQty);
  const unitCost = Number(item.unitCost);
  const reorderLevel = Number(item.reorderLevel);

  const data: InventoryDetailData = {
    item: {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      binLocation: item.binLocation,
      unit: item.unit,
      minQty: Number(item.minQty),
      maxQty: item.maxQty === null ? null : Number(item.maxQty),
      reorderLevel,
      unitCost,
      currentQty,
      reservedQty,
      available: currentQty - reservedQty,
      value: currentQty * unitCost,
      lowStock: currentQty <= reorderLevel,
      isActive: item.isActive,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lastMovementAt: item.lastMovementAt,
      category: item.category,
      itemType: item.itemType,
      site: item.site,
      stockLocation: item.stockLocation,
      supplier: item.supplier,
    },
    locations,
    transactions: ledger.slice(0, 100).map((tx) => ({
      id: tx.id,
      type: tx.type,
      quantity: Number(tx.quantity),
      balanceAfter: Number(tx.balanceAfter),
      unitCost: tx.unitCost ? Number(tx.unitCost) : null,
      notes: tx.notes,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      createdAt: tx.createdAt,
      performedBy: tx.performedBy ? { name: tx.performedBy.name } : null,
      fromLocation: tx.fromLocation ? { name: tx.fromLocation.name } : null,
      toLocation: tx.toLocation ? { name: tx.toLocation.name } : null,
    })),
    permissions: {
      issue: can(user, PERMISSIONS.INVENTORY_ISSUE),
      adjust: can(user, PERMISSIONS.INVENTORY_ADJUST),
      receive: can(user, PERMISSIONS.INVENTORY_RECEIVE),
    },
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Inventory
          </Link>
        }
        title={item.name}
        description={`${item.sku} · ${item.category.name} · ${item.site.name}`}
      />
      <InventoryDetail data={data} />
    </div>
  );
}
