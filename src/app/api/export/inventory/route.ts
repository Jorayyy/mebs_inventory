import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isGlobal, getClientIp } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { toCSV, downloadFilename, formatCurrency, formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!user.permissions.includes(PERMISSIONS.INVENTORY_EXPORT)) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Export",
      entityId: "inventory",
      description: "Denied inventory export",
      ip: await getClientIp(),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const get = (key: string) => params.get(key) ?? undefined;

  const scope: Prisma.InventoryItemWhereInput = isGlobal(user)
    ? {}
    : { siteId: { in: user.siteIds } };

  const where: Prisma.InventoryItemWhereInput = {
    ...scope,
    deletedAt: null,
    ...(get("site") ? { siteId: get("site") } : {}),
    ...(get("categoryId") ? { categoryId: get("categoryId") } : {}),
    ...(get("location") ? { stockLocationId: get("location") } : {}),
    ...(get("status") === "active"
      ? { isActive: true }
      : get("status") === "inactive"
        ? { isActive: false }
        : {}),
    ...(get("q")
      ? {
          OR: [
            { sku: { contains: get("q")!, mode: "insensitive" } },
            { name: { contains: get("q")!, mode: "insensitive" } },
            { description: { contains: get("q")!, mode: "insensitive" } },
            { binLocation: { contains: get("q")!, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const items = await prisma.inventoryItem.findMany({
    where,
    orderBy: { sku: "asc" },
    include: {
      site: true,
      category: true,
      itemType: true,
      stockLocation: true,
      supplier: true,
    },
    take: 50_000,
  });

  const lowOnly = get("low") === "yes";
  const exported = lowOnly
    ? items.filter((item) => Number(item.currentQty) <= Number(item.reorderLevel))
    : items;

  const header = [
    "SKU",
    "Name",
    "Description",
    "Category",
    "Item Type",
    "Unit",
    "On Hand",
    "Reserved",
    "Available",
    "Min Qty",
    "Max Qty",
    "Reorder Level",
    "Unit Cost",
    "Stock Value",
    "Low Stock",
    "Bin",
    "Site",
    "Stock Location",
    "Supplier",
    "Active",
    "Last Updated",
  ];

  const rows = exported.map((item) => {
    const currentQty = Number(item.currentQty);
    const reservedQty = Number(item.reservedQty);
    const unitCost = Number(item.unitCost);
    const reorderLevel = Number(item.reorderLevel);
    return [
      item.sku,
      item.name,
      item.description ?? "",
      item.category.name,
      item.itemType?.name ?? "",
      item.unit,
      String(currentQty),
      String(reservedQty),
      String(currentQty - reservedQty),
      String(Number(item.minQty)),
      item.maxQty === null ? "" : String(Number(item.maxQty)),
      String(reorderLevel),
      formatCurrency(unitCost),
      formatCurrency(currentQty * unitCost),
      currentQty <= reorderLevel ? "YES" : "NO",
      item.binLocation ?? "",
      `${item.site.name} (${item.site.code})`,
      `${item.stockLocation.name} (${item.stockLocation.code})`,
      item.supplier?.name ?? "",
      item.isActive ? "YES" : "NO",
      formatDate(item.updatedAt),
    ];
  });

  await recordAudit({
    userId: user.id,
    action: "EXPORT_GENERATED",
    entityType: "InventoryItem",
    description: `Exported ${rows.length} inventory item(s) to CSV`,
    newValue: { count: rows.length, filters: Object.fromEntries(params) },
    ip: await getClientIp(),
  });

  return new NextResponse(toCSV([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename("inventory")}"`,
      "Cache-Control": "no-store",
    },
  });
}
