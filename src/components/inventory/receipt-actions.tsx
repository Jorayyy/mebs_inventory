"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ClipboardList, ClipboardCheck, Boxes, Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormAction, FormError } from "@/components/ui/form";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { completeReceipt } from "@/actions/receiving";
import type { ReceiptRow, ReceiptPermissions } from "@/components/inventory/receipt-columns";
import { ReceiptLinesDialog } from "@/components/inventory/receipt-form";

function CompleteReceiptDialog({
  receipt,
  onDone,
}: {
  receipt: ReceiptRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const { submit, submitting, serverError } = useFormAction<{ id: string }, { id: string; receiptNumber: string }>(
    async () => completeReceipt({ id: receipt.id }),
    {
      successMessage: (data) => `Receipt ${data.receiptNumber} completed`,
      onSuccess: () => {
        onDone();
        router.refresh();
      },
    }
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onDone()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete receipt {receipt.receiptNumber}?</DialogTitle>
          <DialogDescription>
            This posts every line to stock, updates the linked purchase order, and locks the receipt.
            It cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <FormError error={serverError} />
        <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Lines</span>
            <span className="tabular-nums font-medium">{receipt.lineCount}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Units to post</span>
            <span className="tabular-nums font-medium">{formatNumber(receipt.itemQty, 3)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Total value</span>
            <span className="tabular-nums font-medium">{formatCurrency(receipt.totalCost)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Completing…" : "Complete receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReceiptActionsCell({
  receipt,
  can,
}: {
  receipt: ReceiptRow;
  can: ReceiptPermissions;
}) {
  const [dialog, setDialog] = React.useState<null | "add" | "complete">(null);
  const open = receipt.status === "OPEN";

  return (
    <>
      <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
        <Button variant="ghost" size="icon-sm" asChild title="Open receipt">
          <Link href={`/inventory/receive/${receipt.id}`}>
            <ClipboardList className="h-4 w-4" />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-mono">{receipt.receiptNumber}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/inventory/receive/${receipt.id}`}>
                <ClipboardList /> Open receipt
              </Link>
            </DropdownMenuItem>
            {open && can.receive && (
              <DropdownMenuItem onSelect={() => setDialog("add")}>
                <Boxes /> Add lines
              </DropdownMenuItem>
            )}
            {open && can.receive && (
              <DropdownMenuItem onSelect={() => setDialog("complete")}>
                <ClipboardCheck /> Complete receipt
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dialog === "add" && (
        <ReceiptLinesDialog
          receivingId={receipt.id}
          siteId={receipt.site.id}
          open
          onOpenChange={(value) => !value && setDialog(null)}
        />
      )}
      {dialog === "complete" && <CompleteReceiptDialog receipt={receipt} onDone={() => setDialog(null)} />}
    </>
  );
}

export function ReceiptLineRemoveButton({
  receivingId,
  lineId,
}: {
  receivingId: string;
  lineId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function remove() {
    if (!confirm("Remove this line from the receipt?")) return;
    setPending(true);
    const { removeReceiptLine } = await import("@/actions/receiving");
    const result = await removeReceiptLine({ receivingId, lineId });
    setPending(false);
    if (result.ok) {
      toast.success("Line removed");
      router.refresh();
    } else {
      toast.error(result.error, { description: `Reference: ${result.errorId}` });
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-destructive"
      disabled={pending}
      aria-label="Remove line"
      title="Remove line"
      onClick={() => void remove()}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function ReceiptToolbar({
  receipt,
  can,
}: {
  receipt: ReceiptRow;
  can: ReceiptPermissions;
}) {
  const [dialog, setDialog] = React.useState<null | "add" | "complete">(null);
  const open = receipt.status === "OPEN";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {open && can.receive && (
          <Button size="sm" variant="outline" onClick={() => setDialog("add")}>
            <Boxes /> Add lines
          </Button>
        )}
        {open && can.receive && (
          <Button size="sm" onClick={() => setDialog("complete")}>
            <ClipboardCheck /> Complete receipt
          </Button>
        )}
        {!open && <span className="text-xs text-muted-foreground">Completed — locked</span>}
      </div>

      {dialog === "add" && (
        <ReceiptLinesDialog
          receivingId={receipt.id}
          siteId={receipt.site.id}
          open
          onOpenChange={(value) => !value && setDialog(null)}
        />
      )}
      {dialog === "complete" && <CompleteReceiptDialog receipt={receipt} onDone={() => setDialog(null)} />}
    </>
  );
}
