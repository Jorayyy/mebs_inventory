"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { PO_STATUS } from "@/components/suppliers/supplier-columns";
import { archiveSupplier, restoreSupplier } from "@/actions/suppliers";
import { SupplierFormDialog, type SupplierEditable } from "@/components/suppliers/supplier-form";

/** Server pages render this so PO status labels come from client-safe code. */
export function PoStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} map={PO_STATUS} />;
}

export function SupplierDetailActions({
  supplier,
  can,
}: {
  supplier: SupplierEditable;
  can: { manage: boolean };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const archived = supplier.archived ?? supplier.status === "INACTIVE";

  async function toggleArchive() {
    const verb = archived ? "Restore" : "Archive";
    if (!confirm(`${verb} ${supplier.name}?`)) return;
    setPending(true);
    const result = archived
      ? await restoreSupplier(supplier.id)
      : await archiveSupplier(supplier.id);
    setPending(false);
    if (result.ok) {
      toast.success(`${supplier.name} ${archived ? "restored" : "archived"}`);
      router.refresh();
    } else {
      toast.error(result.error, { description: `Reference: ${result.errorId}` });
    }
  }

  if (!can.manage) return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil /> Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        className={archived ? "" : "text-destructive hover:text-destructive"}
        onClick={() => void toggleArchive()}
      >
        {archived ? <ArchiveRestore /> : <Archive />}
        {archived ? "Restore" : "Archive"}
      </Button>

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
