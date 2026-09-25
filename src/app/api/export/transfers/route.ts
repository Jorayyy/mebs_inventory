import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isGlobal, getClientIp } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { toCSV, downloadFilename, formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!user.permissions.includes(PERMISSIONS.REPORTS_EXPORT)) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Export",
      entityId: "transfers",
      description: "Denied transfer export",
      ip: await getClientIp(),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const get = (key: string) => params.get(key) ?? undefined;

  const scope: Prisma.TransferWhereInput = isGlobal(user)
    ? {}
    : { OR: [{ fromSiteId: { in: user.siteIds } }, { toSiteId: { in: user.siteIds } }] };

  const where: Prisma.TransferWhereInput = {
    ...scope,
    ...(get("id") ? { id: get("id") } : {}),
    ...(get("status") ? { status: get("status") as never } : {}),
    ...(get("fromSite") ? { fromSiteId: get("fromSite") } : {}),
    ...(get("toSite") ? { toSiteId: get("toSite") } : {}),
    ...(get("from") || get("to")
      ? {
          requestedAt: {
            ...(get("from") ? { gte: new Date(get("from")!) } : {}),
            ...(get("to") ? { lte: new Date(`${get("to")}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(get("q")
      ? {
          OR: [
            { transferNumber: { contains: get("q")!, mode: "insensitive" } },
            { courier: { contains: get("q")!, mode: "insensitive" } },
            { referenceNumber: { contains: get("q")!, mode: "insensitive" } },
            { assets: { some: { asset: { assetTag: { contains: get("q")!, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  const transfers = await prisma.transfer.findMany({
    where,
    orderBy: { requestedAt: "desc" },
    include: {
      fromSite: { select: { name: true, code: true } },
      toSite: { select: { name: true, code: true } },
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      _count: { select: { assets: true, items: true } },
    },
    take: 50_000,
  });

  const header = [
    "Transfer Number",
    "Status",
    "From Site",
    "To Site",
    "Requested By",
    "Requested At",
    "Approved By",
    "Approved At",
    "Shipped At",
    "Expected Arrival",
    "Actual Arrival",
    "Courier",
    "Reference",
    "Asset Lines",
    "Consumable Lines",
    "Notes",
  ];

  const rows = transfers.map((transfer) => [
    transfer.transferNumber,
    transfer.status,
    `${transfer.fromSite.name} (${transfer.fromSite.code})`,
    `${transfer.toSite.name} (${transfer.toSite.code})`,
    transfer.requestedBy.name,
    formatDate(transfer.requestedAt, true),
    transfer.approvedBy?.name ?? "",
    transfer.approvedAt ? formatDate(transfer.approvedAt, true) : "",
    transfer.shippedAt ? formatDate(transfer.shippedAt, true) : "",
    transfer.expectedArrival ? formatDate(transfer.expectedArrival) : "",
    transfer.actualArrival ? formatDate(transfer.actualArrival, true) : "",
    transfer.courier ?? "",
    transfer.referenceNumber ?? "",
    transfer._count.assets,
    transfer._count.items,
    transfer.notes ?? "",
  ]);

  await recordAudit({
    userId: user.id,
    action: "EXPORT_GENERATED",
    entityType: "Transfer",
    description: `Exported ${transfers.length} transfer(s) to CSV`,
    newValue: { count: transfers.length, filters: Object.fromEntries(params) },
    ip: await getClientIp(),
  });

  return new NextResponse(toCSV([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename("transfers")}"`,
      "Cache-Control": "no-store",
    },
  });
}
