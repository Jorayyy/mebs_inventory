import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isGlobal, getClientIp } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { toCSV, downloadFilename, formatCurrency, formatDate } from "@/lib/utils";
import type { Prisma, MaintenanceStatus } from "@/generated/prisma";

const DAY = 86_400_000;
const OPEN_STATUSES: MaintenanceStatus[] = ["REPORTED", "DIAGNOSED", "IN_REPAIR", "AWAITING_PARTS"];
const CLOSED_STATUSES: MaintenanceStatus[] = ["COMPLETED", "RETURNED_TO_SERVICE", "CANCELLED"];

function priorityWhere(priority: string): Prisma.MaintenanceRecordWhereInput {
  switch (priority) {
    case "URGENT":
      return { status: { in: OPEN_STATUSES }, reportedAt: { lte: new Date(Date.now() - 7 * DAY) } };
    case "DUE":
      return {
        status: { in: OPEN_STATUSES },
        reportedAt: { gt: new Date(Date.now() - 7 * DAY), lte: new Date(Date.now() - 3 * DAY) },
      };
    case "NEW":
      return { status: { in: OPEN_STATUSES }, reportedAt: { gt: new Date(Date.now() - 3 * DAY) } };
    case "CLOSED":
      return { status: { in: CLOSED_STATUSES } };
    default:
      return {};
  }
}

function priorityOf(status: MaintenanceStatus, reportedAt: Date): string {
  if (CLOSED_STATUSES.includes(status)) return "CLOSED";
  const age = Date.now() - reportedAt.getTime();
  if (age >= 7 * DAY) return "URGENT";
  if (age >= 3 * DAY) return "DUE";
  return "NEW";
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!user.permissions.includes(PERMISSIONS.REPORTS_EXPORT)) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Export",
      entityId: "maintenance",
      description: "Denied maintenance export",
      ip: await getClientIp(),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const get = (key: string) => params.get(key) ?? undefined;

  const assetWhere: Prisma.AssetWhereInput = {
    ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
    ...(get("site") ? { siteId: get("site") } : {}),
  };

  const where: Prisma.MaintenanceRecordWhereInput = {
    ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {}),
    ...(get("status") ? { status: get("status") as never } : {}),
    ...(get("technician") ? { technicianId: get("technician") } : {}),
    ...(get("priority") ? priorityWhere(get("priority")!) : {}),
    ...(get("q")
      ? {
          OR: [
            { referenceNo: { contains: get("q")!, mode: "insensitive" } },
            { issue: { contains: get("q")!, mode: "insensitive" } },
            { diagnosis: { contains: get("q")!, mode: "insensitive" } },
            { asset: { assetTag: { contains: get("q")!, mode: "insensitive" } } },
            { asset: { name: { contains: get("q")!, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(get("from") || get("to")
      ? {
          reportedAt: {
            ...(get("from") ? { gte: new Date(get("from")!) } : {}),
            ...(get("to") ? { lte: new Date(`${get("to")}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const records = await prisma.maintenanceRecord.findMany({
    where,
    orderBy: { reportedAt: "desc" },
    include: {
      asset: { select: { assetTag: true, name: true, serialNumber: true, site: { select: { name: true } } } },
      reportedBy: { select: { name: true } },
      technician: { select: { name: true } },
      vendor: { select: { name: true } },
    },
    take: 50_000,
  });

  const header = [
    "Reference",
    "Status",
    "Priority",
    "Asset Tag",
    "Asset",
    "Serial Number",
    "Site",
    "Issue",
    "Diagnosis",
    "Repair Action",
    "Parts Used",
    "Reported By",
    "Technician",
    "Vendor",
    "Reported At",
    "Started At",
    "Completed At",
    "Returned At",
    "Cost",
    "Notes",
  ];

  const rows = records.map((record) => [
    record.referenceNo,
    record.status,
    priorityOf(record.status, record.reportedAt),
    record.asset.assetTag,
    record.asset.name,
    record.asset.serialNumber ?? "",
    record.asset.site?.name ?? "",
    record.issue,
    record.diagnosis ?? "",
    record.repairAction ?? "",
    record.partsUsed ?? "",
    record.reportedBy.name,
    record.technician?.name ?? "",
    record.vendor?.name ?? "",
    formatDate(record.reportedAt, true),
    record.startedAt ? formatDate(record.startedAt, true) : "",
    record.completedAt ? formatDate(record.completedAt, true) : "",
    record.returnedAt ? formatDate(record.returnedAt, true) : "",
    formatCurrency(Number(record.cost)),
    record.notes ?? "",
  ]);

  await recordAudit({
    userId: user.id,
    action: "EXPORT_GENERATED",
    entityType: "MaintenanceRecord",
    description: `Exported ${records.length} maintenance ticket(s) to CSV`,
    newValue: { count: records.length, filters: Object.fromEntries(params) },
    ip: await getClientIp(),
  });

  return new NextResponse(toCSV([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename("maintenance")}"`,
      "Cache-Control": "no-store",
    },
  });
}
