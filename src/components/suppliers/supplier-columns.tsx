"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Building2, Pencil, Archive, ArchiveRestore } from "lucide-react";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { formatRelative } from "@/lib/utils";
import type { Tone } from "@/lib/constants";
import { archiveSupplier, restoreSupplier } from "@/actions/suppliers";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form";

export const SUPPLIER_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "muted" },
};

export const PO_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "muted" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warning" },
  APPROVED: { label: "Approved", tone: "info" },
  SENT: { label: "Sent", tone: "purple" },
  PARTIALLY_RECEIVED: { label: "Partially received", tone: "warning" },
  RECEIVED: { label: "Received", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};

export type SupplierRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  taxId: string | null;
  productsSupplied: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  archived: boolean;
  itemCount: number;
  openPoCount: number;
  lastActivityAt: Date | null;
  createdAt: Date;
  can: SupplierPermissions;
};

export type SupplierPermissions = { manage: boolean };

export function SupplierRowActions({
  supplier,
  can,
}: {
  supplier: SupplierRow;
  can: SupplierPermissions;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [editing, setEditing] = React.useState(false);

  async function toggleArchive() {
    const action = supplier.archived ? "restore" : "archive";
    const verb = supplier.archived ? "Restore" : "Archive";
    if (
      !confirm(
        `${verb} ${supplier.name}? ${supplier.archived ? "" : "Existing records keep their supplier link."}`
      )
    ) {
      return;
    }
    setPending(true);
    const result = supplier.archived
      ? await restoreSupplier(supplier.id)
      : await archiveSupplier(supplier.id);
    setPending(false);
    if (result.ok) {
      toast.success(`${supplier.name} ${supplier.archived ? "restored" : "archived"}`);
      router.refresh();
    } else {
      toast.error(result.error, { description: `Reference: ${result.errorId}` });
    }
  }

  return (
    <>
      <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
        <Button variant="ghost" size="icon-sm" asChild title="Open supplier">
          <Link href={`/suppliers/${supplier.id}`}>
            <Building2 className="h-4 w-4" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{supplier.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/suppliers/${supplier.id}`}>
                <Building2 /> Supplier profile
              </Link>
            </DropdownMenuItem>
            {can.manage && (
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit supplier
              </DropdownMenuItem>
            )}
            {can.manage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={supplier.archived ? "" : "text-destructive focus:text-destructive"}
                  disabled={pending}
                  onSelect={toggleArchive}
                >
                  {supplier.archived ? <ArchiveRestore /> : <Archive />}
                  {supplier.archived ? "Restore" : "Archive"}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {editing && (
        <SupplierFormDialog
          supplier={supplier}
          open
          onOpenChange={(value) => !value && setEditing(false)}
        />
      )}
    </>
  );
}

export const supplierColumns: ColumnDef<SupplierRow>[] = [
  {
    accessorKey: "name",
    header: "Supplier",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[260px]">
        <Link
          href={`/suppliers/${row.original.id}`}
          className="block truncate font-medium text-primary hover:underline"
        >
          {row.original.name}
          {row.original.archived && (
            <Badge variant="muted" className="ml-1.5 align-middle">
              Archived
            </Badge>
          )}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">
          {row.original.contactPerson || row.original.email || row.original.phone || "—"}
        </span>
      </div>
    ),
  },
  {
    id: "products",
    accessorFn: (row) => row.productsSupplied ?? "",
    header: "Products supplied",
    cell: ({ row }) => (
      <span className="block max-w-[220px] truncate text-sm text-muted-foreground">
        {row.original.productsSupplied || "—"}
      </span>
    ),
  },
  {
    id: "contact",
    enableSorting: false,
    header: "Contact",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[200px] text-xs text-muted-foreground">
        <p className="truncate">{row.original.email || "—"}</p>
        <p className="truncate">{row.original.phone || row.original.address || ""}</p>
      </div>
    ),
  },
  {
    accessorKey: "itemCount",
    header: "Stock items",
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">{row.original.itemCount}</span>
    ),
  },
  {
    accessorKey: "openPoCount",
    header: "Open POs",
    cell: ({ row }) => (
      <span className={`tabular-nums text-sm ${row.original.openPoCount > 0 ? "font-medium" : "text-muted-foreground"}`}>
        {row.original.openPoCount}
      </span>
    ),
  },
  {
    id: "lastActivity",
    accessorFn: (row) => row.lastActivityAt?.getTime() ?? 0,
    header: "Last activity",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.lastActivityAt ? formatRelative(row.original.lastActivityAt) : "—"}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} map={SUPPLIER_STATUS} />,
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <SupplierRowActions supplier={row.original} can={row.original.can} />,
  },
];
