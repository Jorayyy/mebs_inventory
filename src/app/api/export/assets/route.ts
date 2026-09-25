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
  if (!user.permissions.includes(PERMISSIONS.ASSETS_EXPORT)) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Export",
      entityId: "assets",
      description: "Denied asset export",
      ip: await getClientIp(),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const get = (key: string) => params.get(key) ?? undefined;

  const scope: Prisma.AssetWhereInput = isGlobal(user) ? {} : { siteId: { in: user.siteIds } };

  const where: Prisma.AssetWhereInput = {
    ...scope,
    deletedAt: null,
    ...(get("site") ? { siteId: get("site") } : {}),
    ...(get("category") ? { categoryId: get("category") } : {}),
    ...(get("status") ? { status: get("status") as never } : {}),
    ...(get("condition") ? { condition: get("condition") as never } : {}),
    ...(get("department") ? { departmentId: get("department") } : {}),
    ...(get("q")
      ? {
          OR: [
            { assetTag: { contains: get("q")!, mode: "insensitive" } },
            { serialNumber: { contains: get("q")!, mode: "insensitive" } },
            { name: { contains: get("q")!, mode: "insensitive" } },
            { model: { contains: get("q")!, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { assetTag: "asc" },
    include: {
      site: true,
      category: true,
      department: true,
      assignedEmployee: true,
      room: { include: { floor: { include: { building: true } } } },
      stockLocation: true,
      supplier: true,
    },
    take: 50_000,
  });

  const header = [
    "Asset Tag",
    "Name",
    "Category",
    "Brand",
    "Model",
    "Serial Number",
    "Status",
    "Condition",
    "Site",
    "Location",
    "Department",
    "Assigned To",
    "Employee No",
    "Supplier",
    "Purchase Date",
    "Purchase Price",
    "Warranty End",
    "Created",
  ];

  const rows = assets.map((asset) => [
    asset.assetTag,
    asset.name,
    asset.category.name,
    asset.brand ?? "",
    asset.model ?? "",
    asset.serialNumber ?? "",
    asset.status,
    asset.condition,
    asset.site.name,
    asset.room?.name ?? asset.stockLocation?.name ?? "",
    asset.department?.name ?? "",
    asset.assignedEmployee
      ? `${asset.assignedEmployee.firstName} ${asset.assignedEmployee.lastName}`
      : "",
    asset.assignedEmployee?.employeeNo ?? "",
    asset.supplier?.name ?? "",
    asset.purchaseDate ? formatDate(asset.purchaseDate) : "",
    asset.purchasePrice ? formatCurrency(Number(asset.purchasePrice)) : "",
    asset.warrantyEnd ? formatDate(asset.warrantyEnd) : "",
    formatDate(asset.createdAt),
  ]);

  await recordAudit({
    userId: user.id,
    action: "EXPORT_GENERATED",
    entityType: "Asset",
    description: `Exported ${assets.length} asset(s) to CSV`,
    newValue: { count: assets.length, filters: Object.fromEntries(params) },
    ip: await getClientIp(),
  });

  return new NextResponse(toCSV([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename("assets")}"`,
      "Cache-Control": "no-store",
    },
  });
}
