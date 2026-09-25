import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Upload, Wrench } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { can, isGlobal, requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { buildQuery, parseTableQuery, str } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import {
  maintenanceColumns,
  type MaintenancePriority,
  type MaintenanceRow,
} from "@/components/maintenance/maintenance-columns";
import { UrlDataTable } from "@/components/transfers/url-data-table";
import { DateRangeFilter } from "@/components/transfers/date-range-filter";
import { MAINTENANCE_STATUS } from "@/lib/constants";
import type { Prisma, MaintenanceStatus } from "@/generated/prisma";

export const metadata: Metadata = { title: "Maintenance" };

const DAY = 86_400_000;
const OPEN_STATUSES: MaintenanceStatus[] = ["REPORTED", "DIAGNOSED", "IN_REPAIR", "AWAITING_PARTS"];
const CLOSED_STATUSES: MaintenanceStatus[] = ["COMPLETED", "RETURNED_TO_SERVICE", "CANCELLED"];

const SORTABLE: Record<string, string> = {
  referenceNo: "referenceNo",
  status: "status",
  reportedAt: "reportedAt",
  completedAt: "completedAt",
  cost: "cost",
  issue: "issue",
};

const TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  ...Object.entries(MAINTENANCE_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
];

/** Derived SLA bucket — the schema has no priority column. */
function priorityOf(status: MaintenanceStatus, reportedAt: Date): MaintenancePriority {
  if (CLOSED_STATUSES.includes(status)) return "CLOSED";
  const age = Date.now() - reportedAt.getTime();
  if (age >= 7 * DAY) return "URGENT";
  if (age >= 3 * DAY) return "DUE";
  return "NEW";
}

function priorityWhere(priority: string): Prisma.MaintenanceRecordWhereInput {
  const open = { status: { in: OPEN_STATUSES } };
  switch (priority) {
    case "URGENT":
      return { ...open, reportedAt: { lte: new Date(Date.now() - 7 * DAY) } };
    case "DUE":
      return {
        ...open,
        reportedAt: { gt: new Date(Date.now() - 7 * DAY), lte: new Date(Date.now() - 3 * DAY) },
      };
    case "NEW":
      return { ...open, reportedAt: { gt: new Date(Date.now() - 3 * DAY) } };
    case "CLOSED":
      return { status: { in: CLOSED_STATUSES } };
    default:
      return {};
  }
}

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.MAINTENANCE_VIEW);
  const query = parseTableQuery(searchParams);

  const status = str(searchParams, "status");
  const priority = str(searchParams, "priority");
  const siteId = str(searchParams, "site");
  const technicianId = str(searchParams, "technician");
  const from = str(searchParams, "from");
  const to = str(searchParams, "to");

  const scope: Prisma.MaintenanceRecordWhereInput = isGlobal(user)
    ? {}
    : { asset: { siteId: { in: user.siteIds } } };

  const assetWhere: Prisma.AssetWhereInput = {
    ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
    ...(siteId ? { siteId } : {}),
    ...(query.q
      ? {
          OR: [
            { assetTag: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const base: Prisma.MaintenanceRecordWhereInput = {
    ...scope,
    ...(Object.keys(assetWhere).length ? { asset: assetWhere } : {}),
    ...(technicianId ? { technicianId } : {}),
    ...(priority ? priorityWhere(priority) : {}),
    ...(from || to
      ? {
          reportedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const where: Prisma.MaintenanceRecordWhereInput = {
    ...base,
    ...(status ? { status: status as never } : {}),
    ...(query.q
      ? {
          OR: [
            { referenceNo: { contains: query.q, mode: "insensitive" } },
            { issue: { contains: query.q, mode: "insensitive" } },
            { diagnosis: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortKey = SORTABLE[query.sort] ?? "reportedAt";
  const orderBy = { [sortKey]: query.dir } as Prisma.MaintenanceRecordOrderByWithRelationInput;

  const [total, items, statusCounts, sites, technicians] = await Promise.all([
    prisma.maintenanceRecord.count({ where }),
    prisma.maintenanceRecord.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        referenceNo: true,
        status: true,
        issue: true,
        reportedAt: true,
        completedAt: true,
        cost: true,
        reportedBy: { select: { name: true } },
        technician: { select: { name: true } },
        asset: {
          select: { id: true, assetTag: true, name: true, siteId: true, site: { select: { name: true } } },
        },
      },
    }),
    prisma.maintenanceRecord.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE", deletedAt: null, repairs: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const counts = new Map<string, number>(statusCounts.map((row) => [row.status, row._count._all]));

  const rows: MaintenanceRow[] = items.map((record) => ({
    id: record.id,
    referenceNo: record.referenceNo,
    status: record.status,
    issue: record.issue,
    priority: priorityOf(record.status, record.reportedAt),
    asset: { id: record.asset.id, assetTag: record.asset.assetTag, name: record.asset.name },
    site: record.asset.site ? { id: record.asset.siteId, name: record.asset.site.name } : null,
    reportedBy: record.reportedBy,
    technician: record.technician,
    reportedAt: record.reportedAt,
    completedAt: record.completedAt,
    cost: Number(record.cost),
  }));

  const currentParams = Object.fromEntries(
    Object.entries(searchParams)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v ?? "")])
      .filter(([, v]) => v !== "")
  );
  const showExport = can(user, PERMISSIONS.REPORTS_EXPORT);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Maintenance"
        description={`${total.toLocaleString()} ticket${total === 1 ? "" : "s"} — priority is derived from ticket age.`}
        actions={
          <>
            {showExport && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/export/maintenance?${new URLSearchParams(currentParams).toString()}`}>
                  <Upload /> Export CSV
                </a>
              </Button>
            )}
            {can(user, PERMISSIONS.MAINTENANCE_MANAGE) && (
              <Button size="sm" asChild>
                <Link href="/maintenance/new">
                  <Plus /> New ticket
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
              href={`/maintenance${buildQuery(currentParams, { status: value || undefined, page: undefined })}`}
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
        <SearchInput placeholder="Reference, issue, asset tag…" defaultValue={query.q} />
        <FilterSelect
          param="priority"
          label="Priority"
          allLabel="Any priority"
          options={[
            { value: "URGENT", label: "Urgent (7d+)" },
            { value: "DUE", label: "Due (3–7d)" },
            { value: "NEW", label: "New (<3d)" },
            { value: "CLOSED", label: "Closed" },
          ]}
        />
        <FilterSelect
          param="site"
          label="Site"
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          param="technician"
          label="Technician"
          options={technicians.map((t) => ({ value: t.id, label: t.name }))}
        />
        <DateRangeFilter
          fromParam="from"
          toParam="to"
          label="Reported"
          fromValue={from ?? ""}
          toValue={to ?? ""}
        />
      </FilterBar>

      <UrlDataTable
        columns={maintenanceColumns}
        data={rows}
        total={total}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort}
        dir={query.dir}
        emptyState={
          <EmptyState
            icon={<Wrench className="h-8 w-8" />}
            title="No maintenance tickets match your filters"
            description="Clear the filters or open a ticket for an asset that needs attention."
            action={
              can(user, PERMISSIONS.MAINTENANCE_MANAGE) ? (
                <Button size="sm" asChild>
                  <Link href="/maintenance/new">
                    <Plus /> New ticket
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
