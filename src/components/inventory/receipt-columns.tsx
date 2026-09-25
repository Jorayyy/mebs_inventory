"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Tone } from "@/lib/constants";
import { ReceiptActionsCell } from "@/components/inventory/receipt-actions";

export type ReceiptStatus = "OPEN" | "COMPLETED";

export const RECEIVING_STATUS: Record<ReceiptStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
};

export type ReceiptRow = {
  id: string;
  receiptNumber: string;
  status: ReceiptStatus;
  deliveryDate: Date;
  createdAt: Date;
  totalCost: number;
  lineCount: number;
  itemQty: number;
  invoiceNumber: string | null;
  poNumber: string | null;
  site: { id: string; name: string; code: string };
  stockLocation: { code: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  receivedBy: { name: string };
  can: ReceiptPermissions;
};

export type ReceiptPermissions = {
  receive: boolean;
};

export const receiptColumns: ColumnDef<ReceiptRow>[] = [
  {
    accessorKey: "receiptNumber",
    header: "Receipt",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[200px]">
        <Link
          href={`/inventory/receive/${row.original.id}`}
          className="block truncate font-mono text-sm font-medium text-primary hover:underline"
        >
          {row.original.receiptNumber}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {row.original.invoiceNumber ? `Inv ${row.original.invoiceNumber}` : row.original.poNumber ?? "Manual"}
        </span>
      </div>
    ),
  },
  {
    id: "supplier",
    accessorFn: (row) => row.supplier?.name ?? "",
    header: "Supplier",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[220px]">
        <p className="truncate text-sm">{row.original.supplier?.name ?? "—"}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.poNumber ?? "No PO"}</p>
      </div>
    ),
  },
  {
    id: "site",
    accessorFn: (row) => row.site.name,
    header: "Site / Location",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.original.site.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.original.stockLocation?.name ?? "Default location"}
        </p>
      </div>
    ),
  },
  {
    id: "deliveryDate",
    accessorFn: (row) => row.deliveryDate.getTime(),
    header: "Delivery date",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-sm">{formatDate(row.original.deliveryDate)}</span>
    ),
  },
  {
    id: "lines",
    enableSorting: false,
    header: "Lines",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">
        {row.original.lineCount} line{row.original.lineCount === 1 ? "" : "s"}
        <span className="text-xs text-muted-foreground"> · {row.original.itemQty} units</span>
      </span>
    ),
  },
  {
    accessorKey: "totalCost",
    header: "Total",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm font-medium">{formatCurrency(row.original.totalCost)}</span>
    ),
  },
  {
    id: "receivedBy",
    accessorFn: (row) => row.receivedBy.name,
    header: "Received by",
    cell: ({ row }) => <span className="text-sm">{row.original.receivedBy.name}</span>,
  },
  {
    id: "status",
    accessorFn: (row) => row.status,
    enableSorting: false,
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} map={RECEIVING_STATUS} />,
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <ReceiptActionsCell receipt={row.original} can={row.original.can} />,
  },
];
