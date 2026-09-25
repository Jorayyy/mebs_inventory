"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Boxes, PackageMinus, PackagePlus, ClipboardList, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/utils";
import { StockIssueDialog } from "@/components/inventory/stock-issue-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { InventoryItemDialog } from "@/components/inventory/inventory-form";

export type InventoryItemLite = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentQty: number;
  reservedQty: number;
  unitCost: number;
  reorderLevel: number;
  siteId: string;
  stockLocationId: string;
};

export type InventoryRow = InventoryItemLite & {
  description: string | null;
  binLocation: string | null;
  minQty: number;
  maxQty: number | null;
  available: number;
  value: number;
  lowStock: boolean;
  isActive: boolean;
  updatedAt: Date;
  site: { id: string; name: string; code: string };
  category: { id: string; name: string };
  stockLocation: { id: string; code: string; name: string };
  supplier: { id: string; name: string } | null;
  can: InventoryPermissions;
};

export type InventoryPermissions = {
  issue: boolean;
  adjust: boolean;
  receive: boolean;
};

function LowStockBadge({ low }: { low: boolean }) {
  if (!low) return null;
  return (
    <Badge variant="warning" className="ml-1.5 align-middle">
      Low
    </Badge>
  );
}

export function InventoryRowActions({
  row,
  can,
}: {
  row: InventoryRow;
  can: InventoryPermissions;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [dialog, setDialog] = React.useState<null | "issue" | "consume" | "replenish" | "adjust" | "edit">(
    null
  );

  async function archive() {
    if (!confirm(`Archive ${row.sku}? The item can no longer receive stock movements.`)) return;
    setPending(true);
    const { archiveInventoryItem } = await import("@/actions/inventory");
    const result = await archiveInventoryItem(row.id);
    setPending(false);
    if (result.ok) {
      toast.success(`${row.sku} archived`);
      router.refresh();
    } else {
      toast.error(result.error, { description: `Reference: ${result.errorId}` });
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon-sm" asChild title="Open item">
          <Link href={`/inventory/${row.id}`}>
            <Boxes className="h-4 w-4" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{row.sku}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/inventory/${row.id}`}>
                <Boxes /> Item profile
              </Link>
            </DropdownMenuItem>
            {can.issue && (
              <DropdownMenuItem onSelect={() => setDialog("issue")}>
                <PackageMinus /> Issue stock
              </DropdownMenuItem>
            )}
            {can.issue && (
              <DropdownMenuItem onSelect={() => setDialog("consume")}>
                <ClipboardList /> Consume stock
              </DropdownMenuItem>
            )}
            {can.receive && (
              <DropdownMenuItem onSelect={() => setDialog("replenish")}>
                <PackagePlus /> Replenish
              </DropdownMenuItem>
            )}
            {can.adjust && (
              <DropdownMenuItem onSelect={() => setDialog("adjust")}>
                <ClipboardList /> Adjust count
              </DropdownMenuItem>
            )}
            {can.adjust && (
              <DropdownMenuItem onSelect={() => setDialog("edit")}>
                <Boxes /> Edit item
              </DropdownMenuItem>
            )}
            {can.adjust && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" disabled={pending} onSelect={archive}>
                  <Archive /> Archive
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {(dialog === "issue" || dialog === "consume" || dialog === "replenish") && (
        <StockIssueDialog
          mode={dialog}
          item={row}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      {dialog === "adjust" && (
        <StockAdjustDialog item={row} open onOpenChange={(open) => !open && setDialog(null)} />
      )}
      {dialog === "edit" && (
        <InventoryItemDialog item={row} open onOpenChange={(open) => !open && setDialog(null)} />
      )}
    </>
  );
}

export const inventoryColumns: ColumnDef<InventoryRow>[] = [
  {
      accessorKey: "sku",
      header: "Item",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[260px]">
          <Link
            href={`/inventory/${row.original.id}`}
            className="block truncate font-medium text-primary hover:underline"
          >
            {row.original.sku}
            <LowStockBadge low={row.original.lowStock} />
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
          <p className="truncate text-xs text-muted-foreground">{row.original.supplier?.name ?? "—"}</p>
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
            {row.original.stockLocation.name}
            {row.original.binLocation ? ` · Bin ${row.original.binLocation}` : ""}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "currentQty",
      header: "On hand",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">
          {formatNumber(row.original.currentQty, 3)}
        </span>
      ),
    },
    {
      accessorKey: "reservedQty",
      header: "Reserved",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatNumber(row.original.reservedQty, 3)}
        </span>
      ),
    },
    {
      accessorKey: "available",
      header: "Available",
      cell: ({ row }) => (
        <span
          className={`tabular-nums text-sm ${
            row.original.available <= 0 ? "text-destructive" : ""
          }`}
        >
          {formatNumber(row.original.available, 3)}
        </span>
      ),
    },
    {
      accessorKey: "reorderLevel",
      header: "Reorder at",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatNumber(row.original.reorderLevel, 3)}
        </span>
      ),
    },
    {
      id: "unit",
      accessorFn: (row) => row.unit,
      header: "Unit",
      cell: ({ row }) => <span className="text-xs uppercase">{row.original.unit}</span>,
    },
    {
      accessorKey: "unitCost",
      header: "Unit cost",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{formatCurrency(row.original.unitCost)}</span>
      ),
    },
    {
      accessorKey: "value",
      header: "Value",
      cell: ({ row }) => (
        <span className="tabular-nums text-sm font-medium">{formatCurrency(row.original.value)}</span>
      ),
    },
    {
      id: "updated",
      accessorFn: (row) => row.updatedAt.getTime(),
      header: "Last movement",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{formatRelative(row.original.updatedAt)}</span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <InventoryRowActions row={row.original} can={row.original.can} />,
  },
];
