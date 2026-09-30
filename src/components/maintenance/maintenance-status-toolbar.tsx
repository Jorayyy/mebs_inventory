"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Wrench } from "lucide-react";
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
import { updateMaintenance } from "@/actions/maintenance";
import { MAINTENANCE_STATUS } from "@/lib/constants";

type TicketRecord = {
  id: string;
  referenceNo: string;
  status: string;
  issue: string;
  diagnosis: string | null;
  repairAction: string | null;
  partsUsed: string | null;
  cost: number;
  notes: string | null;
  assetTag: string;
};

/** Detail-page action bar: one save updates the ticket and the asset's status. */
export function MaintenanceStatusToolbar({
  record,
  canManage,
}: {
  record: TicketRecord;
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const [status, setStatus] = React.useState(record.status);
  const [diagnosis, setDiagnosis] = React.useState(record.diagnosis ?? "");
  const [repairAction, setRepairAction] = React.useState(record.repairAction ?? "");
  const [partsUsed, setPartsUsed] = React.useState(record.partsUsed ?? "");
  const [cost, setCost] = React.useState(String(record.cost));
  const [notes, setNotes] = React.useState(record.notes ?? "");

  const openDialog = () => {
    setStatus(record.status);
    setDiagnosis(record.diagnosis ?? "");
    setRepairAction(record.repairAction ?? "");
    setPartsUsed(record.partsUsed ?? "");
    setCost(String(record.cost));
    setNotes(record.notes ?? "");
    setOpen(true);
  };

  const save = async () => {
    setPending(true);
    try {
      const result = await updateMaintenance({
        id: record.id,
        status,
        diagnosis,
        repairAction,
        partsUsed,
        cost,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }

      toast.success("Maintenance updated");
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  if (!canManage) return null;

  return (
    <>
      <Button size="sm" onClick={openDialog}>
        <Wrench /> Update ticket
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>Update {record.referenceNo}</DialogTitle>
            <DialogDescription>
              Status changes are written to the asset ledger, audited and pushed to watchers.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mt-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="mt-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MAINTENANCE_STATUS).map(([value, meta]) => (
                    <SelectItem key={value} value={value}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mt-cost">Cost</Label>
              <Input
                id="mt-cost"
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mt-diagnosis">Diagnosis</Label>
              <Textarea
                id="mt-diagnosis"
                rows={2}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mt-repair">Repair action</Label>
              <Textarea
                id="mt-repair"
                rows={2}
                value={repairAction}
                onChange={(e) => setRepairAction(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mt-parts">Parts used</Label>
              <Input
                id="mt-parts"
                value={partsUsed}
                onChange={(e) => setPartsUsed(e.target.value)}
                placeholder="e.g. 1× fan assembly"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mt-notes">Notes</Label>
              <Input id="mt-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !status}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
