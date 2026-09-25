import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isGlobal, can, requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str, parseTableQuery, buildQuery } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { transferColumns, type TransferRow } from "@/components/transfers/transfer-columns";
import { UrlDataTable } from "@/components/transfers/url-data-table";
import { DateRangeFilter } from "@/components/transfers/date-range-filter";
import { TRANSFER_STATUS } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma";

export const metadata: Metadata = { title: "Transfers" };

const SORTABLE: Record<string, string> = {
  transferNumber: "transferNumber",
  status: "status",
  requestedAt: "requestedAt",
  expectedArrival: "expectedArrival",
  shippedAt: "shippedAt",
  actualArrival: "actualArrival",
  courier: "courier",
};

const TABS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  ...Object.entries(TRANSFER_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
];

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.TRANSFERS_VIEW);
  const query = parseTableQuery(searchParams);

  const status = str(searchParams, "status");
  const fromSiteId = str(searchParams, "fromSite");
  const toSiteId = str(searchParams, "toSite");
  const from = str(searchParams, "from");
  const to = str(searchParams, "to");

  const scope: Prisma.TransferWhereInput = isGlobal(user)
    ? {}
    : { OR: [{ fromSiteId: { in: user.siteIds } }, { toSiteId: { in: user.siteIds } }] };

  const base: Prisma.TransferWhereInput = {
    ...scope,
    ...(fromSiteId ? { fromSiteId } : {}),
    ...(toSiteId ? { toSiteId } : {}),
    ...(from || to
      ? {
          requestedAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        }
      : {}),
  };

  const where: Prisma.TransferWhereInput = {
    ...base,
    ...(status ? { status: status as never } : {}),
    ...(query.q
      ? {
          OR: [
            { transferNumber: { contains: query.q, mode: "insensitive" } },
            { courier: { contains: query.q, mode: "insensitive" } },
            { referenceNumber: { contains: query.q, mode: "insensitive" } },
            { fromSite: { name: { contains: query.q, mode: "insensitive" } } },
            { toSite: { name: { contains: query.q, mode: "insensitive" } } },
            { assets: { some: { asset: { assetTag: { contains: query.q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  const sortKey = SORTABLE[query.sort] ?? "requestedAt";
  const orderBy = { [sortKey]: query.dir } as Prisma.TransferOrderByWithRelationInput;

  const [total, items, statusCounts, sites] = await Promise.all([
    prisma.transfer.count({ where }),
    prisma.transfer.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        transferNumber: true,
        status: true,
        requestedAt: true,
        expectedArrival: true,
        shippedAt: true,
        actualArrival: true,
        courier: true,
        referenceNumber: true,
        fromSite: { select: { id: true, name: true, code: true } },
        toSite: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        _count: { select: { assets: true, items: true } },
      },
    }),
    prisma.transfer.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const counts = new Map<string, number>(
    statusCounts.map((row) => [row.status, row._count._all])
  );
  const rows: TransferRow[] = items.map((transfer) => ({
    id: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    fromSite: transfer.fromSite,
    toSite: transfer.toSite,
    requestedBy: transfer.requestedBy,
    approvedBy: transfer.approvedBy,
    requestedAt: transfer.requestedAt,
    expectedArrival: transfer.expectedArrival,
    shippedAt: transfer.shippedAt,
    actualArrival: transfer.actualArrival,
    courier: transfer.courier,
    referenceNumber: transfer.referenceNumber,
    assetCount: transfer._count.assets,
    itemCount: transfer._count.items,
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
        title="Transfers"
        description={`${total.toLocaleString()} inter-site transfer${total === 1 ? "" : "s"} in scope.`}
        actions={
          <>
            {showExport && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/export/transfers?${new URLSearchParams(currentParams).toString()}`}>
                  <Upload /> Export CSV
                </a>
              </Button>
            )}
            {can(user, PERMISSIONS.TRANSFERS_CREATE) && (
              <Button size="sm" asChild>
                <Link href="/transfers/new">
                  <Plus /> New transfer
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
                href={`/transfers${buildQuery(currentParams, { status: value || undefined, page: undefined })}`}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {label}
                <span className="ml-1.5 text-xs tabular-nums opacity-70">{count}</span>
              </Link>
            );
          })}
      </div>

      <FilterBar>
        <SearchInput placeholder="Transfer number, courier, asset tag…" defaultValue={query.q} />
        <FilterSelect
          param="fromSite"
          label="From"
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          param="toSite"
          label="To"
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
        />
        <DateRangeFilter
          fromParam="from"
          toParam="to"
          label="Requested"
          fromValue={from ?? ""}
          toValue={to ?? ""}
        />
      </FilterBar>

      <UrlDataTable
        columns={transferColumns}
        data={rows}
        total={total}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort}
        dir={query.dir}
        emptyState={
          <EmptyState
            icon={<ArrowLeftRight className="h-8 w-8" />}
            title="No transfers match your filters"
            description="Clear the filters or start an inter-site move."
            action={
              can(user, PERMISSIONS.TRANSFERS_CREATE) ? (
                <Button size="sm" asChild>
                  <Link href="/transfers/new">
                    <Plus /> New transfer
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
