"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, PackageCheck, Send, ThumbsDown, ThumbsUp, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveTransfer,
  cancelTransfer,
  completeTransfer,
  rejectTransfer,
  shipTransfer,
  submitTransfer,
  receiveTransfer,
} from "@/actions/transfers";
import { ASSET_CONDITION } from "@/lib/constants";
import type { ActionResult } from "@/lib/errors";

type Mode = "submit" | "approve" | "reject" | "ship" | "receive" | "complete" | "cancel" | null;

type TransferSummary = {
  id: string;
  status: string;
  transferNumber: string;
  assetCount: number;
  itemCount: number;
  courier: string | null;
  referenceNumber: string | null;
};

type ReceiveAsset = { id: string; assetTag: string; condition: string };

const COPY: Record<Exclude<Mode, null>, { title: string; description: string; confirm: string }> = {
  submit: {
    title: "Submit for approval",
    description: "Locks the line list and sends the transfer to an approver.",
    confirm: "Submit",
  },
  approve: {
    title: "Approve transfer",
    description: "Authorises dispatch. The transfer then waits for shipping.",
    confirm: "Approve",
  },
  reject: {
    title: "Reject transfer",
    description: "Returns the transfer to the requester. A reason is required.",
    confirm: "Reject",
  },
  ship: {
    title: "Ship transfer",
    description: "Marks every line as sent and starts the in-transit window.",
    confirm: "Mark as shipped",
  },
  receive: {
    title: "Receive transfer",
    description:
      "Records arrival. Assets move to the destination site and consumable stock moves with them.",
    confirm: "Confirm receipt",
  },
  complete: {
    title: "Complete transfer",
    description: "Closes the transfer after every line has been reconciled.",
    confirm: "Complete",
  },
  cancel: {
    title: "Cancel transfer",
    description: "Void lines and close the transfer. This cannot be undone.",
    confirm: "Cancel transfer",
  },
};

export function TransferStatusToolbar({
  transfer,
  assets,
  can,
}: {
  transfer: TransferSummary;
  assets: ReceiveAsset[];
  can: { act: boolean; approve: boolean; ship: boolean; receive: boolean };
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>(null);
  const [pending, setPending] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [courier, setCourier] = React.useState(transfer.courier ?? "");
  const [reference, setReference] = React.useState(transfer.referenceNumber ?? "");
  const [expectedArrival, setExpectedArrival] = React.useState("");
  const [conditions, setConditions] = React.useState<Record<string, string>>({});

  const close = () => {
    setMode(null);
    setNotes("");
    setReason("");
  };

  const run = async (action: () => Promise<ActionResult<unknown>>) => {
    setPending(true);
    try {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      close();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const onReceiveOpen = () => {
    setConditions(Object.fromEntries(assets.map((a) => [a.id, a.condition])));
    setMode("receive");
  };

  const buttons: React.ReactNode = (
    <div className="flex flex-wrap items-center gap-2">
      {transfer.status === "DRAFT" && can.act && (
        <Button size="sm" onClick={() => setMode("submit")}>
          <Send /> Submit for approval
        </Button>
      )}
      {transfer.status === "PENDING_APPROVAL" && can.approve && (
        <>
          <Button size="sm" onClick={() => setMode("approve")}>
            <ThumbsUp /> Approve
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode("reject")}>
            <ThumbsDown /> Reject
          </Button>
        </>
      )}
      {transfer.status === "APPROVED" && can.ship && (
        <Button size="sm" onClick={() => setMode("ship")}>
          <Truck /> Mark as shipped
        </Button>
      )}
      {transfer.status === "IN_TRANSIT" && can.receive && (
        <Button size="sm" onClick={onReceiveOpen}>
          <PackageCheck /> Receive
        </Button>
      )}
      {transfer.status === "RECEIVED" && can.receive && (
        <Button size="sm" onClick={() => setMode("complete")}>
          <Check /> Complete
        </Button>
      )}
      {["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(transfer.status) && can.act && (
        <Button size="sm" variant="outline" onClick={() => setMode("cancel")}>
          <Ban /> Cancel
        </Button>
      )}
    </div>
  );

  const copy = mode ? COPY[mode] : null;

  return (
    <>
      {buttons}
      <Dialog open={mode !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {copy && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {copy.title} · {transfer.transferNumber}
                </DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {mode === "submit" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="submit-notes">Note (optional)</Label>
                    <Textarea
                      id="submit-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Anything the approver should know"
                    />
                  </div>
                )}

                {mode === "approve" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="approve-notes">Note (optional)</Label>
                    <Textarea
                      id="approve-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                )}

                {mode === "reject" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="reject-reason">
                      Reason <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="reject-reason"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why is this transfer being rejected?"
                    />
                    {reason.trim().length > 0 && reason.trim().length < 3 && (
                      <p className="text-xs font-medium text-destructive">
                        Provide at least 3 characters
                      </p>
                    )}
                  </div>
                )}

                {mode === "ship" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="ship-courier">Courier</Label>
                      <Input
                        id="ship-courier"
                        value={courier}
                        onChange={(e) => setCourier(e.target.value)}
                        placeholder="Hand carry, courier…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ship-ref">Reference / AWB</Label>
                      <Input
                        id="ship-ref"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="ship-eta">Expected arrival</Label>
                      <Input
                        id="ship-eta"
                        type="date"
                        value={expectedArrival}
                        onChange={(e) => setExpectedArrival(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {mode === "receive" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Record the condition of each asset on arrival.
                    </p>
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <span className="truncate text-sm font-medium">{asset.assetTag}</span>
                        <Select
                          value={conditions[asset.id] ?? asset.condition}
                          onValueChange={(v) =>
                            setConditions((prev) => ({ ...prev, [asset.id]: v }))
                          }
                        >
                          <SelectTrigger className="h-8 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(ASSET_CONDITION).map(([value, meta]) => (
                              <SelectItem key={value} value={value}>
                                {meta.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    <div className="space-y-1.5 pt-1">
                      <Label htmlFor="receive-notes">Receipt note (optional)</Label>
                      <Textarea
                        id="receive-notes"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {mode === "complete" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="complete-notes">Note (optional)</Label>
                    <Textarea
                      id="complete-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                )}

                {mode === "cancel" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cancel-notes">Reason (optional)</Label>
                    <Textarea
                      id="cancel-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {transfer.assetCount} asset line(s) and {transfer.itemCount} consumable line(s)
                      will be voided.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close} disabled={pending}>
                  Close
                </Button>
                <Button
                  disabled={
                    pending ||
                    (mode === "reject" ? reason.trim().length < 3 : false)
                  }
                  variant={mode === "reject" || mode === "cancel" ? "destructive" : "default"}
                  onClick={() => {
                    if (mode === "submit") {
                      void run(() => submitTransfer({ id: transfer.id, notes }));
                    } else if (mode === "approve") {
                      void run(() => approveTransfer({ id: transfer.id, notes }));
                    } else if (mode === "reject") {
                      void run(() => rejectTransfer({ id: transfer.id, notes: reason }));
                    } else if (mode === "ship") {
                      void run(() =>
                        shipTransfer({
                          id: transfer.id,
                          courier,
                          referenceNumber: reference,
                          expectedArrival,
                          notes,
                        })
                      );
                    } else if (mode === "receive") {
                      void run(() =>
                        receiveTransfer({
                          id: transfer.id,
                          notes,
                          conditions: assets.map((a) => ({
                            assetId: a.id,
                            condition: (conditions[a.id] ?? a.condition) as never,
                          })),
                        })
                      );
                    } else if (mode === "complete") {
                      void run(() => completeTransfer({ id: transfer.id, notes }));
                    } else if (mode === "cancel") {
                      void run(() => cancelTransfer({ id: transfer.id, notes }));
                    }
                  }}
                >
                  {pending ? "Working…" : copy.confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
