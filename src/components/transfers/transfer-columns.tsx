"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { ArrowRight, Package, Boxes } from "lucide-react";
import { TransferStatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatRelative } from "@/lib/utils";

export type TransferRow = {
  id: string;
  transferNumber: string;
  status: string;
  fromSite: { id: string; name: string; code: string };
  toSite: { id: string; name: string; code: string };
  requestedBy: { name: string };
  approvedBy: { name: string } | null;
  requestedAt: Date;
  expectedArrival: Date | null;
  shippedAt: Date | null;
  actualArrival: Date | null;
  courier: string | null;
  referenceNumber: string | null;
  assetCount: number;
  itemCount: number;
};

export const transferColumns: ColumnDef<TransferRow>[] = [
  {
    accessorKey: "transferNumber",
    header: "Transfer",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/transfers/${row.original.id}`}
          className="block truncate font-medium text-primary hover:underline"
        >
          {row.original.transferNumber}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {row.original.courier || row.original.referenceNumber || "—"}
        </span>
      </div>
    ),
  },
  {
    id: "route",
    header: "Route",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="truncate">{row.original.fromSite.name}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{row.original.toSite.name}</span>
      </div>
    ),
  },
  {
    id: "lines",
    header: "Lines",
    cell: ({ row }) => (
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="inline-flex items-center gap-1" title="Assets">
          <Package className="h-3.5 w-3.5 text-muted-foreground" /> {row.original.assetCount}
        </span>
        <span className="inline-flex items-center gap-1" title="Consumable lines">
          <Boxes className="h-3.5 w-3.5 text-muted-foreground" /> {row.original.itemCount}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <TransferStatusBadge status={row.original.status as never} />,
  },
  {
    id: "requestedBy",
    accessorFn: (row) => row.requestedBy.name,
    header: "Requested by",
    cell: ({ row }) => <span className="text-sm">{row.original.requestedBy.name}</span>,
  },
  {
    accessorKey: "requestedAt",
    header: "Requested",
    cell: ({ row }) => (
      <span className="text-xs" title={formatRelative(row.original.requestedAt)}>
        {formatDate(row.original.requestedAt)}
      </span>
    ),
  },
  {
    accessorKey: "expectedArrival",
    header: "Expected",
    cell: ({ row }) => <span className="text-xs">{formatDate(row.original.expectedArrival)}</span>,
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Link
          href={`/transfers/${row.original.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Open
        </Link>
      </div>
    ),
  },
];
