import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser, can, canAny } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str, parseTableQuery, buildQuery } from "@/lib/query";
import { formatDate } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { DateRangeFilter } from "@/components/transfers/date-range-filter";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  queryInventoryTransactions,
  getTransactionFilterOptions,
} from "@/actions/transactions";
import { TRANSACTION_GROUP_LABELS, type TransactionGroup } from "@/lib/transactions";

export const metadata: Metadata = { title: "Inventory transactions" };

const GROUP_TONE: Record<string, "success" | "info" | "warning" | "danger" | "muted" | "purple"> = {
  RECEIVED: "success",
  ASSIGNED: "info",
  RETURNED: "success",
  TRANSFERRED: "purple",
  ISSUED: "info",
  CONSUMED: "muted",
  ADJUSTED: "warning",
  MAINTENANCE: "warning",
  DISPOSED: "muted",
};

export default async function InventoryTransactionsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  if (!canAny(user, [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.ASSETS_VIEW])) redirect("/my");

  const query = parseTableQuery(searchParams);
  const [result, options] = await Promise.all([
    queryInventoryTransactions({
      from: str(searchParams, "from"),
      to: str(searchParams, "to"),
      siteId: str(searchParams, "site"),
      type: str(searchParams, "type"),
      ledger: str(searchParams, "ledger"),
      q: query.q,
      page: query.page,
      pageSize: query.pageSize,
    }),
    getTransactionFilterOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const pageHref = (page: number) =>
    `/inventory/transactions${buildQuery(searchParams, {
      page: page <= 1 ? undefined : String(page),
    })}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        description="Every receive, assign, return, transfer, issue and adjustment — one source of truth for inventory movement."
      />

      <InventoryTabs canAdd={can(user, PERMISSIONS.ASSETS_CREATE) || can(user, PERMISSIONS.INVENTORY_RECEIVE)} />

      <FilterBar>
        <SearchInput placeholder="Asset tag, SKU, notes…" defaultValue={query.q} />
        <FilterSelect
          param="type"
          label="Action"
          options={options.types}
          allLabel="All actions"
        />
        <FilterSelect
          param="site"
          label="Site"
          options={options.sites.map((site) => ({ value: site.id, label: site.name }))}
          allLabel="All sites"
        />
        <FilterSelect
          param="ledger"
          label="Kind"
          options={[
            { value: "asset", label: "Assets" },
            { value: "stock", label: "Stock" },
          ]}
          allLabel="Assets & stock"
        />
        <DateRangeFilter
          fromParam="from"
          toParam="to"
          label="Date"
          fromValue={str(searchParams, "from") ?? ""}
          toValue={str(searchParams, "to") ?? ""}
        />
      </FilterBar>

      <div className="rounded-lg border bg-card">
        {result.rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<ArrowLeftRight className="h-8 w-8" />}
              title="No transactions match your filters"
              description="Clear the filters, or record a receive, assignment or stock movement to see it here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDate(row.date, true)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={GROUP_TONE[row.group] ?? "outline"}>
                        {TRANSACTION_GROUP_LABELS[row.group as TransactionGroup] ?? row.label}
                      </Badge>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {row.ledger === "asset" ? "Asset" : "Stock"} · {row.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={row.href}
                        className="font-mono text-sm font-medium text-primary hover:underline"
                      >
                        {row.subject}
                      </Link>
                      <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
                        {row.subjectName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {row.quantity === null ? "—" : row.quantity}
                    </TableCell>
                    <TableCell className="text-xs">
                      {[row.from, row.to].filter(Boolean).join(" → ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{row.performedBy ?? "System"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {row.notes || row.reference || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {result.total.toLocaleString()} transaction{result.total === 1 ? "" : "s"} · page{" "}
            {result.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {result.page > 1 && (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(result.page - 1)}>
                  <ChevronLeft /> Previous
                </Link>
              </Button>
            )}
            {result.page < totalPages && (
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(result.page + 1)}>
                  Next <ChevronRight />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
