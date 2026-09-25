"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
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
import { Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { returnAssets } from "@/actions/assignments";
import { useTableSelectionIds } from "@/components/shared/data-table";
import { ASSET_CONDITION } from "@/lib/constants";

const OUTCOMES = [
  { value: "RETURNED", label: "Returned in good order" },
  { value: "DAMAGED", label: "Returned damaged" },
  { value: "MISSING", label: "Not returned (missing)" },
] as const;

/** Bulk return toolbar rendered by the assignments table selection. */
export function AssignmentSelectionToolbar({
  selectedIds: selectedIdsProp,
  canReturn,
}: {
  selectedIds?: string[];
  canReturn: boolean;
}) {
  const router = useRouter();
  const contextIds = useTableSelectionIds();
  const selectedIds = selectedIdsProp ?? contextIds;
  const [open, setOpen] = React.useState(false);
  const [condition, setCondition] = React.useState("GOOD");
  const [outcome, setOutcome] = React.useState<string>("RETURNED");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const count = selectedIds.length;
  if (count === 0 || !canReturn) return null;

  const submit = async () => {
    setPending(true);
    try {
      const result = await returnAssets({
        assignmentIds: selectedIds,
        condition,
        outcome,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success(`Returned ${result.data.processed} asset(s)`);
      setOpen(false);
      setNotes("");
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border bg-muted px-2 py-1 text-xs font-medium">
          {count} selected
        </span>
        <Button size="sm" className="h-8" onClick={() => setOpen(true)}>
          <RotateCcw /> Return
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return {count} asset(s)</DialogTitle>
            <DialogDescription>
              Closes each assignment, writes a RETURN transaction per asset and frees the equipment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-condition">Returned condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id="bulk-condition">
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

            <div className="space-y-1.5">
              <Label htmlFor="bulk-outcome">Outcome</Label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger id="bulk-outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-notes">Notes</Label>
              <Textarea
                id="bulk-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Collected during exit interview"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? "Working…" : "Record return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
