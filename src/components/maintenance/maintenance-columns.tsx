"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { MaintenanceStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatRelative } from "@/lib/utils";

export type MaintenancePriority = "NEW" | "DUE" | "URGENT" | "CLOSED";

export type MaintenanceRow = {
  id: string;
  referenceNo: string;
  status: string;
  issue: string;
  priority: MaintenancePriority;
  asset: { id: string; assetTag: string; name: string };
  site: { id: string; name: string } | null;
  reportedBy: { name: string };
  technician: { name: string } | null;
  reportedAt: Date;
  completedAt: Date | null;
  cost: number;
};

const PRIORITY_LABEL: Record<MaintenancePriority, { label: string; className: string }> = {
  URGENT: { label: "Urgent", className: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  DUE: { label: "Due", className: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300" },
  NEW: { label: "New", className: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  CLOSED: { label: "Closed", className: "border-transparent bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
};

export function PriorityBadge({ priority }: { priority: MaintenancePriority }) {
  const meta = PRIORITY_LABEL[priority];
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export const maintenanceColumns: ColumnDef<MaintenanceRow>[] = [
  {
    accessorKey: "referenceNo",
    header: "Reference",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/maintenance/${row.original.id}`}
          className="block truncate font-mono text-[13px] font-medium text-primary hover:underline"
        >
          {row.original.referenceNo}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {row.original.asset.assetTag} · {row.original.asset.name}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "issue",
    header: "Issue",
    cell: ({ row }) => (
      <p className="max-w-[320px] truncate text-sm" title={row.original.issue}>
        {row.original.issue}
      </p>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <MaintenanceStatusBadge status={row.original.status as never} />,
  },
  {
    id: "priority",
    header: "Priority",
    cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
  },
  {
    id: "site",
    accessorFn: (row) => row.site?.name ?? "",
    header: "Site",
    cell: ({ row }) => <span className="text-sm">{row.original.site?.name ?? "—"}</span>,
  },
  {
    id: "technician",
    accessorFn: (row) => row.technician?.name ?? "",
    header: "Technician",
    cell: ({ row }) => <span className="text-sm">{row.original.technician?.name ?? "Unassigned"}</span>,
  },
  {
    accessorKey: "reportedAt",
    header: "Reported",
    cell: ({ row }) => (
      <div className="text-xs">
        <span className="block">{formatDate(row.original.reportedAt)}</span>
        <span className="block text-muted-foreground">{formatRelative(row.original.reportedAt)}</span>
      </div>
    ),
  },
  {
    accessorKey: "cost",
    header: "Cost",
    cell: ({ row }) => (
      <span className="text-xs tabular-nums">{formatCurrency(row.original.cost)}</span>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Link
          href={`/maintenance/${row.original.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Wrench className="h-3.5 w-3.5" /> Open
        </Link>
      </div>
    ),
  },
];
