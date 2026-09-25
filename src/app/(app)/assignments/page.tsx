import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Upload, UserPlus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, isGlobal, requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { buildQuery, parseTableQuery, str } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { assignmentColumns, type AssignmentRow } from "@/components/assignments/assignment-columns";
import { AssignmentSelectionToolbar } from "@/components/assignments/assignment-bulk-return";
import { AssignmentDrawer } from "@/components/assignments/assignment-drawer";
import { UrlDataTable } from "@/components/transfers/url-data-table";
import { DateRangeFilter } from "@/components/transfers/date-range-filter";
import { ASSIGNMENT_STATUS } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma";

export const metadata: Metadata = { title: "Assignments" };

const SORTABLE: Record<string, string> = {
  assignedAt: "assignedAt",
  expectedReturnAt: "expectedReturnAt",
  status: "status",
  employee: "employee.lastName",
  asset: "asset.assetTag",
  site: "asset.siteId",
};

const TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  ...Object.entries(ASSIGNMENT_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
];

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.ASSIGNMENTS_VIEW);
  const query = parseTableQuery(searchParams);

  const status = str(searchParams, "status");
  const siteId = str(searchParams, "site");
  const departmentId = str(searchParams, "department");
  const from = str(searchParams, "from");
  const to = str(searchParams, "to");
  const openId = str(searchParams, "open");

  const assetWhere: Prisma.AssetWhereInput = {
    ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
    ...(siteId ? { siteId } : {}),
    ...(query.q
      ? {
          OR: [
            { assetTag: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
            { serialNumber: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const employeeWhere: Prisma.EmployeeWhereInput = {
    ...(departmentId ? { departmentId } : {}),
    ...(query.q
      ? {
          OR: [
            { firstName: { contains: query.q, mode: "insensitive" } },
            { lastName: { contains: query.q, mode: "insensitive" } },
            { employeeNo: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const base: Prisma.AssetAssignmentWhereInput = {
    ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {}),
    ...(Object.keys(employeeWhere).length ? { employee: employeeWhere } : {}),
    ...(from || to
      ? {
          assignedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const where: Prisma.AssetAssignmentWhereInput = {
    ...base,
    ...(status ? { status: status as never } : {}),
  };

  const sortKey = SORTABLE[query.sort] ?? "assignedAt";
  const orderBy: Prisma.AssetAssignmentOrderByWithRelationInput = sortKey.includes(".")
    ? ({ [sortKey.split(".")[0]]: { [sortKey.split(".")[1]]: query.dir } } as never)
    : ({ [sortKey]: query.dir } as never);

  const [total, items, statusCounts, sites, departments] = await Promise.all([
    prisma.assetAssignment.count({ where }),
    prisma.assetAssignment.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        status: true,
        assignedAt: true,
        expectedReturnAt: true,
        acknowledgedAt: true,
        conditionAtAssignment: true,
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            status: true,
            condition: true,
            serialNumber: true,
            site: { select: { name: true } },
          },
        },
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
        assignedBy: { select: { name: true } },
      },
    }),
    prisma.assetAssignment.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
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

  const counts = new Map<string, number>(statusCounts.map((row) => [row.status, row._count._all]));

  const rows: AssignmentRow[] = items.map((assignment) => ({
    id: assignment.id,
    status: assignment.status,
    assignedAt: assignment.assignedAt,
    expectedReturnAt: assignment.expectedReturnAt,
    acknowledgedAt: assignment.acknowledgedAt,
    conditionAtAssignment: assignment.conditionAtAssignment,
    assignedBy: assignment.assignedBy?.name ?? null,
    asset: {
      id: assignment.asset.id,
      assetTag: assignment.asset.assetTag,
      name: assignment.asset.name,
      status: assignment.asset.status,
      condition: assignment.asset.condition,
      serialNumber: assignment.asset.serialNumber,
    },
    employee: {
      id: assignment.employee.id,
      name: `${assignment.employee.firstName} ${assignment.employee.lastName}`,
      employeeNo: assignment.employee.employeeNo,
      jobTitle: assignment.employee.jobTitle,
      department: assignment.employee.department?.name ?? null,
    },
    site: assignment.asset.site,
  }));

  const currentParams = Object.fromEntries(
    Object.entries(searchParams)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v ?? "")])
      .filter(([, v]) => v !== "")
  );
  const closeHref = `/assignments${buildQuery(currentParams, { open: undefined })}`;
  const showExport = can(user, PERMISSIONS.REPORTS_EXPORT);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assignments"
        description={`${total.toLocaleString()} assignment${total === 1 ? "" : "s"} tracked across ${sites.length} site${sites.length === 1 ? "" : "s"}.`}
        actions={
          <>
            {showExport && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/export/assignments?${new URLSearchParams(currentParams).toString()}`}>
                  <Upload /> Export CSV
                </a>
              </Button>
            )}
            {can(user, PERMISSIONS.ASSIGNMENTS_CLEARANCE) && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/assignments/clearance">
                  <ArrowLeftRight /> Clearance
                </Link>
              </Button>
            )}
            {can(user, PERMISSIONS.ASSIGNMENTS_CREATE) && (
              <Button size="sm" asChild>
                <Link href="/assets?assign=1">
                  <UserPlus /> Assign assets
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1 shadow-sm">
        {TABS.map(({ value, label }) => {
          const active = (status ?? "") === value;
          const count = value ? (counts.get(value) ?? 0) : total;
          return (
            <Link
              key={value || "all"}
              href={`/assignments${buildQuery(currentParams, { status: value || undefined, page: undefined, open: undefined })}`}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs tabular-nums opacity-70">{count}</span>
            </Link>
          );
        })}
      </div>

      <FilterBar>
        <SearchInput placeholder="Employee, employee no, asset tag…" defaultValue={query.q} />
        <FilterSelect
          param="site"
          label="Site"
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          param="department"
          label="Department"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <DateRangeFilter
          fromParam="from"
          toParam="to"
          label="Assigned"
          fromValue={from ?? ""}
          toValue={to ?? ""}
        />
      </FilterBar>

      <UrlDataTable
        columns={assignmentColumns}
        data={rows}
        total={total}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort}
        dir={query.dir}
        enableRowSelection={can(user, PERMISSIONS.ASSIGNMENTS_RETURN)}
        toolbar={
          <AssignmentSelectionToolbar canReturn={can(user, PERMISSIONS.ASSIGNMENTS_RETURN)} />
        }
        emptyState={
          <EmptyState
            icon={<ArrowLeftRight className="h-8 w-8" />}
            title="No assignments match your filters"
            description="Assign assets to employees from the assets list."
            action={
              can(user, PERMISSIONS.ASSIGNMENTS_CREATE) ? (
                <Button size="sm" asChild>
                  <Link href="/assets?assign=1">
                    <UserPlus /> Assign assets
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />

      <AssignmentDrawer
        assignmentId={openId ?? null}
        closeHref={closeHref}
        canReturn={can(user, PERMISSIONS.ASSIGNMENTS_RETURN)}
      />
    </div>
  );
}
