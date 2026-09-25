"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Laptop, ArrowLeftRight, Tag, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssetStatusBadge, ConditionBadge } from "@/components/shared/status-badge";
import { formatDate, formatCurrency } from "@/lib/utils";
import { deleteAsset } from "@/actions/assets";
import { useRouter } from "next/navigation";

export type AssetRow = {
  id: string;
  assetTag: string;
  name: string;
  serialNumber: string | null;
  model: string | null;
  brand: string | null;
  status: string;
  condition: string;
  purchasePrice: number | null;
  warrantyEnd: Date | null;
  createdAt: Date;
  site: { id: string; name: string; code: string };
  category: { id: string; name: string };
  department: { id: string; name: string } | null;
  assignedEmployee: { id: string; firstName: string; lastName: string } | null;
  room: { code: string; name: string } | null;
  stockLocation: { code: string; name: string } | null;
};

export function AssetActionsCell({ asset }: { asset: AssetRow }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function handleDelete() {
    if (!confirm(`Delete ${asset.assetTag}? This is a soft delete and is fully audited.`)) return;
    setPending(true);
    const result = await deleteAsset(asset.id);
    setPending(false);
    if (result.ok) {
      toast.success(`${asset.assetTag} deleted`);
      router.refresh();
    } else {
      toast.error(result.error, { description: `Reference: ${result.errorId}` });
    }
  }

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button variant="ghost" size="icon-sm" asChild title="Open asset">
        <Link href={`/assets/${asset.id}`}>
          <Laptop className="h-4 w-4" />
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{asset.assetTag}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/assets/${asset.id}`}>
              <Laptop /> View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/assets/${asset.id}?tab=assignment`}>
              <UserPlus /> Assign / history
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/labels?ids=${asset.id}`}>
              <Tag /> Print label
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/transfers/new?assetIds=${asset.id}`}>
              <ArrowLeftRight /> Transfer
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/assets/${asset.id}/edit`}>
              <Laptop /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={pending}
            onSelect={handleDelete}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const assetColumns: ColumnDef<AssetRow>[] = [
  {
    accessorKey: "assetTag",
    header: "Asset Tag",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/assets/${row.original.id}`}
          className="block truncate font-medium text-primary hover:underline"
        >
          {row.original.assetTag}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">{row.original.name}</span>
      </div>
    ),
  },
  {
    id: "category",
    accessorFn: (row) => row.category.name,
    header: "Category",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.original.category.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[row.original.brand, row.original.model].filter(Boolean).join(" ") || "—"}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "serialNumber",
    header: "Serial Number",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.serialNumber || "—"}</span>
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
          {row.original.room?.name ??
            row.original.stockLocation?.name ??
            row.original.department?.name ??
            "—"}
        </p>
      </div>
    ),
  },
  {
    id: "assigned",
    accessorFn: (row) =>
      row.assignedEmployee ? `${row.assignedEmployee.firstName} ${row.assignedEmployee.lastName}` : "",
    header: "Assigned To",
    cell: ({ row }) => {
      const employee = row.original.assignedEmployee;
      return employee ? (
        <Link href={`/employees/${employee.id}`} className="truncate text-sm hover:underline">
          {employee.firstName} {employee.lastName}
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Unassigned</span>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <AssetStatusBadge status={row.original.status as never} />,
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => <ConditionBadge condition={row.original.condition as never} />,
  },
  {
    accessorKey: "purchasePrice",
    header: "Value",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">
        {row.original.purchasePrice ? formatCurrency(row.original.purchasePrice) : "—"}
      </span>
    ),
  },
  {
    accessorKey: "warrantyEnd",
    header: "Warranty",
    cell: ({ row }) => <span className="text-xs">{formatDate(row.original.warrantyEnd)}</span>,
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <AssetActionsCell asset={row.original} />,
  },
];
