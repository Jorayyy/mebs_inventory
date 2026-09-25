import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Upload, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, isGlobal, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str, parseTableQuery } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { employeeColumns, type EmployeeRow } from "@/components/employees/employee-columns";
import { EMPLOYMENT_STATUS } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma";

export const metadata: Metadata = { title: "Employees" };

const SORTABLE: Record<string, string> = {
  lastName: "lastName",
  firstName: "firstName",
  employeeNo: "employeeNo",
  hireDate: "hireDate",
  createdAt: "createdAt",
  employmentStatus: "employmentStatus",
  site: "site.name",
  department: "department.name",
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.EMPLOYEES_VIEW);
  const query = parseTableQuery(searchParams);

  const siteId = str(searchParams, "site");
  const departmentId = str(searchParams, "department");
  const employment = str(searchParams, "employment");
  const recordStatus = str(searchParams, "status") ?? "active";

  const scope: Prisma.EmployeeWhereInput = isGlobal(user)
    ? {}
    : { siteId: { in: user.siteIds } };

  const where: Prisma.EmployeeWhereInput = {
    ...scope,
    ...(recordStatus === "archived"
      ? { deletedAt: { not: null } }
      : recordStatus === "all"
        ? {}
        : { deletedAt: null }),
    ...(siteId ? { siteId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(employment ? { employmentStatus: employment as never } : {}),
    ...(query.q
      ? {
          OR: [
            { firstName: { contains: query.q, mode: "insensitive" } },
            { lastName: { contains: query.q, mode: "insensitive" } },
            { employeeNo: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortKey = SORTABLE[query.sort] ?? "lastName";
  const orderBy: Prisma.EmployeeOrderByWithRelationInput = sortKey.includes(".")
    ? ({ [sortKey.split(".")[0]]: { [sortKey.split(".")[1]]: query.dir } } as never)
    : ({ [sortKey]: query.dir } as never);

  const [total, items, sites, departments] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        site: { select: { id: true, name: true, code: true } },
        department: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } },
        user: { select: { id: true, email: true, status: true } },
      },
    }),
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.department.findMany({
      where: { isActive: true, ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: EmployeeRow[] = items.map((employee) => ({
    id: employee.id,
    employeeNo: employee.employeeNo,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone,
    jobTitle: employee.jobTitle,
    employmentStatus: employee.employmentStatus,
    hireDate: employee.hireDate,
    exitDate: employee.exitDate,
    createdAt: employee.createdAt,
    site: employee.site,
    department: employee.department,
    team: employee.team,
    user: employee.user,
  }));

  const canManage = can(user, PERMISSIONS.EMPLOYEES_MANAGE);
  const showExport = canManage || can(user, PERMISSIONS.REPORTS_EXPORT);
  const exportHref = `/api/export/employees?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(searchParams)
        .map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v ?? "")])
        .filter(([, v]) => v !== "")
    )
  ).toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees"
        description={`${total.toLocaleString()} record${total === 1 ? "" : "s"} — searchable by name, employee number or email.`}
        actions={
          <>
            {showExport && (
              <Button variant="outline" size="sm" asChild>
                <a href={exportHref}>
                  <Upload /> Export CSV
                </a>
              </Button>
            )}
            {canManage && (
              <Button size="sm" asChild>
                <Link href="/employees/new">
                  <Plus /> New employee
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <SearchInput placeholder="Name, employee no, email…" defaultValue={query.q} />
        <FilterSelect
          param="site"
          label="Site"
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
        />
        <FilterSelect
          param="department"
          label="Department"
          options={departments.map((department) => ({ value: department.id, label: department.name }))}
        />
        <FilterSelect
          param="employment"
          label="Employment status"
          allLabel="Any employment"
          options={Object.entries(EMPLOYMENT_STATUS).map(([value, meta]) => ({
            value,
            label: meta.label,
          }))}
        />
        <FilterSelect
          param="status"
          label="Record status"
          allLabel="Active records"
          options={[
            { value: "archived", label: "Archived" },
            { value: "all", label: "All records" },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={employeeColumns}
        data={rows}
        total={total}
        page={query.page}
        pageSize={query.pageSize}
        emptyState={
          <EmptyState
            icon={<UsersRound className="h-8 w-8" />}
            title="No employees match your filters"
            description="Clear the filters or add your first employee to start tracking headcount."
            action={
              canManage ? (
                <Button size="sm" asChild>
                  <Link href="/employees/new">
                    <Plus /> New employee
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
