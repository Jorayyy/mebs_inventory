import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, isGlobal, getClientIp, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { toCSV, downloadFilename, formatDate } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!can(user, PERMISSIONS.EMPLOYEES_MANAGE) && !can(user, PERMISSIONS.REPORTS_EXPORT)) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Export",
      entityId: "employees",
      description: "Denied employee export",
      ip: await getClientIp(),
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const get = (key: string) => params.get(key) ?? undefined;

  const recordStatus = get("status") ?? "active";
  const where: Prisma.EmployeeWhereInput = {
    ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
    ...(recordStatus === "archived"
      ? { deletedAt: { not: null } }
      : recordStatus === "all"
        ? {}
        : { deletedAt: null }),
    ...(get("site") ? { siteId: get("site") } : {}),
    ...(get("department") ? { departmentId: get("department") } : {}),
    ...(get("employment") ? { employmentStatus: get("employment") as never } : {}),
    ...(get("q")
      ? {
          OR: [
            { firstName: { contains: get("q")!, mode: "insensitive" } },
            { lastName: { contains: get("q")!, mode: "insensitive" } },
            { employeeNo: { contains: get("q")!, mode: "insensitive" } },
            { email: { contains: get("q")!, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const employees = await prisma.employee.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      site: { select: { name: true, code: true } },
      department: { select: { name: true, code: true, costCenter: { select: { code: true, name: true } } } },
      team: { select: { name: true } },
      user: { select: { email: true, status: true, role: { select: { name: true } } } },
      manager: { select: { firstName: true, lastName: true } },
    },
    take: 50_000,
  });

  const header = [
    "Employee No",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Job Title",
    "Site",
    "Department",
    "Team",
    "Cost Centre",
    "Manager",
    "Employment Status",
    "Hire Date",
    "Exit Date",
    "Account Email",
    "Account Role",
    "Account Status",
    "Notes",
    "Created",
  ];

  const rows = employees.map((employee) => [
    employee.employeeNo,
    employee.firstName,
    employee.lastName,
    employee.email ?? "",
    employee.phone ?? "",
    employee.jobTitle ?? "",
    `${employee.site.name} (${employee.site.code})`,
    employee.department.name,
    employee.team?.name ?? "",
    employee.department.costCenter
      ? `${employee.department.costCenter.code} — ${employee.department.costCenter.name}`
      : "",
    employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "",
    employee.employmentStatus,
    employee.hireDate ? formatDate(employee.hireDate) : "",
    employee.exitDate ? formatDate(employee.exitDate) : "",
    employee.user?.email ?? "",
    employee.user?.role.name ?? "",
    employee.user?.status ?? "",
    employee.notes ?? "",
    formatDate(employee.createdAt),
  ]);

  await recordAudit({
    userId: user.id,
    action: "EXPORT_GENERATED",
    entityType: "Employee",
    description: `Exported ${employees.length} employee(s) to CSV`,
    newValue: { count: employees.length, filters: Object.fromEntries(params) },
    ip: await getClientIp(),
  });

  return new NextResponse(toCSV([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename("employees")}"`,
      "Cache-Control": "no-store",
    },
  });
}
