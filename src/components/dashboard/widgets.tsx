import Link from "next/link";
import { ArrowLeftRight, Boxes, Laptop, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionCard } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { AUDIT_ACTION_BADGES } from "@/components/audit/audit-constants";
import { formatDate, formatRelative } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  LowStockItem,
  PendingApproval,
  RecentActivity,
  SiteSummary,
  WarrantyExpiring,
} from "@/actions/dashboard";

export function WarrantyWidget({ items }: { items: WarrantyExpiring[] }) {
  return (
    <SectionCard
      title="Warranty expiring"
      description="Assets losing warranty cover within 90 days."
      actions={
        <Link href="/reports/warranty-expiry" className="text-xs font-medium text-primary hover:underline">
          View report
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Laptop className="h-8 w-8" />}
          title="No warranties expiring"
          description="Nothing lapses in the next 90 days."
        />
      ) : (
        <ul className="divide-y">
          {items.map((item) => {
            const days = item.daysLeft;
            const tone = days <= 14 ? "danger" : days <= 30 ? "warning" : "info";
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link
                    href={`/assets/${item.id}`}
                    className="block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {item.assetTag}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.name} · {item.siteName}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={tone}>{days <= 0 ? "Expired" : `${days}d`}</Badge>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDate(item.warrantyEnd)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export function LowStockWidget({ items }: { items: LowStockItem[] }) {
  return (
    <SectionCard
      title="Low stock"
      description="Items at or below their reorder threshold."
      actions={
        <Link href="/inventory" className="text-xs font-medium text-primary hover:underline">
          Open stock
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<Boxes className="h-8 w-8" />}
          title="Everything is stocked"
          description="No item has dropped to its reorder level."
        />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.sku} · {item.siteName}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
                  {item.currentQty} {item.unit}
                </p>
                <p className="text-[11px] tabular-nums text-muted-foreground">min {item.threshold}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function PendingApprovalsWidget({ items }: { items: PendingApproval[] }) {
  return (
    <SectionCard
      title="Pending approvals"
      description="Transfers waiting for an approver."
      actions={
        <Link
          href="/transfers?status=PENDING_APPROVAL"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open transfers
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="h-8 w-8" />}
          title="Nothing to approve"
          description="All transfers have been actioned."
        />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Link
                  href={`/transfers/${item.id}`}
                  className="block truncate font-mono text-xs font-medium text-primary hover:underline"
                >
                  {item.transferNumber}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {item.fromSite} → {item.toSite}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs">{item.requestedBy}</p>
                <p className="text-[11px] text-muted-foreground">{formatRelative(item.requestedAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function RecentActivityWidget({ items }: { items: RecentActivity[] }) {
  return (
    <SectionCard
      title="Recent activity"
      description="Latest recorded audit events."
      actions={
        <Link href="/audit" className="text-xs font-medium text-primary hover:underline">
          Audit trail
        </Link>
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" />}
          title="No activity yet"
          description="Audit events will appear as people work."
        />
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={item.action} map={AUDIT_ACTION_BADGES} />
                  <span className="text-[11px] text-muted-foreground">{item.entityType}</span>
                </div>
                <p className="mt-0.5 truncate text-xs">{item.description || "—"}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs">{item.userName ?? "System"}</p>
                <p className="text-[11px] text-muted-foreground">{formatRelative(item.createdAt)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function SiteSummaryTable({ rows }: { rows: SiteSummary[] }) {
  const totals = rows.reduce(
    (acc, row) => ({
      assets: acc.assets + row.assets,
      assigned: acc.assigned + row.assigned,
      available: acc.available + row.available,
      items: acc.items + row.items,
      lowStock: acc.lowStock + row.lowStock,
    }),
    { assets: 0, assigned: 0, available: 0, items: 0, lowStock: 0 }
  );

  return (
    <SectionCard
      title="Site summary"
      description="Assets and stock split by location."
      actions={
        <Link href="/reports/asset-by-site" className="text-xs font-medium text-primary hover:underline">
          Full report
        </Link>
      }
    >
      {rows.length === 0 ? (
        <EmptyState icon={<Boxes className="h-8 w-8" />} title="No sites" description="No sites are visible to you." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead className="text-right">Assets</TableHead>
              <TableHead className="text-right">Assigned</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Stock items</TableHead>
              <TableHead className="text-right">Low stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.siteId}>
                <TableCell>
                  <Link href={`/assets?site=${row.siteId}`} className="font-medium text-primary hover:underline">
                    {row.siteName}
                  </Link>
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{row.siteCode}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.assets}</TableCell>
                <TableCell className="text-right tabular-nums">{row.assigned}</TableCell>
                <TableCell className="text-right tabular-nums">{row.available}</TableCell>
                <TableCell className="text-right tabular-nums">{row.items}</TableCell>
                <TableCell
                  className={`text-right tabular-nums ${row.lowStock > 0 ? "font-medium text-red-600 dark:text-red-400" : ""}`}
                >
                  {row.lowStock}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{totals.assets}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{totals.assigned}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{totals.available}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{totals.items}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{totals.lowStock}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
