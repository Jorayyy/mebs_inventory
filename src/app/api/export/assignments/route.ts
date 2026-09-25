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
      entityId: "assignments",
      description: "Denied assignment export",
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

  const employeeWhere: Prisma.EmployeeWhereInput = {
    ...(get("department") ? { departmentId: get("department") } : {}),
  };

  const where: Prisma.AssetAssignmentWhereInput = {
    ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {}),
    ...(Object.keys(employeeWhere).length ? { employee: employeeWhere } : {}),
    ...(get("status") ? { status: get("status") as never } : {}),
    ...(get("q")
      ? {
          OR: [
            { asset: { assetTag: { contains: get("q")!, mode: "insensitive" } } },
            { asset: { name: { contains: get("q")!, mode: "insensitive" } } },
            { asset: { serialNumber: { contains: get("q")!, mode: "insensitive" } } },
            { employee: { firstName: { contains: get("q")!, mode: "insensitive" } } },
            { employee: { lastName: { contains: get("q")!, mode: "insensitive" } } },
            { employee: { employeeNo: { contains: get("q")!, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(get("from") || get("to")
      ? {
          assignedAt: {
            ...(get("from") ? { gte: new Date(get("from")!) } : {}),
            ...(get("to") ? { lte: new Date(`${get("to")}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const assignments = await prisma.assetAssignment.findMany({
    where,
    orderBy: { assignedAt: "desc" },
    include: {
      asset: {
        select: {
          assetTag: true,
          name: true,
          serialNumber: true,
          status: true,
          condition: true,
          site: { select: { name: true } },
        },
      },
      employee: {
        select: {
          employeeNo: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          department: { select: { name: true } },
        },
      },
      assignedBy: { select: { name: true } },
      returnedBy: { select: { name: true } },
    },
    take: 50_000,
  });

  const header = [
    "Employee",
    "Employee No",
    "Department",
    "Job Title",
    "Asset Tag",
    "Asset",
    "Serial Number",
    "Assignment Status",
    "Asset Status",
    "Asset Condition",
    "Site",
    "Condition At Assignment",
    "Assigned At",
    "Assigned By",
    "Expected Return",
    "Acknowledged At",
    "Returned At",
    "Returned By",
    "Return Condition",
    "Return Notes",
  ];

  const rows = assignments.map((row) => [
    `${row.employee.firstName} ${row.employee.lastName}`,
    row.employee.employeeNo,
    row.employee.department?.name ?? "",
    row.employee.jobTitle ?? "",
    row.asset.assetTag,
    row.asset.name,
    row.asset.serialNumber ?? "",
    row.status,
    row.asset.status,
    row.asset.condition,
    row.asset.site?.name ?? "",
    row.conditionAtAssignment,
    formatDate(row.assignedAt, true),
    row.assignedBy?.name ?? "",
    row.expectedReturnAt ? formatDate(row.expectedReturnAt) : "",
    row.acknowledgedAt ? formatDate(row.acknowledgedAt, true) : "",
    row.returnedAt ? formatDate(row.returnedAt, true) : "",
    row.returnedBy?.name ?? "",
    row.returnCondition ?? "",
    row.returnNotes ?? "",
  ]);

  await recordAudit({
    userId: user.id,
    action: "EXPORT_GENERATED",
    entityType: "AssetAssignment",
    description: `Exported ${assignments.length} assignment(s) to CSV`,
    newValue: { count: assignments.length, filters: Object.fromEntries(params) },
    ip: await getClientIp(),
  });

  return new NextResponse(toCSV([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename("assignments")}"`,
      "Cache-Control": "no-store",
    },
  });
}
