"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSET_CONDITION } from "@/lib/constants";
import { assetStatusLabel, describeReturnOutcome, returnAssetStatus } from "@/lib/lifecycle";
import { returnAssets } from "@/actions/assignments";

type Outcome = "RETURNED" | "DAMAGED" | "MISSING";

/**
 * One shared "Record return" action so the asset page and the employee profile
 * offer exactly the same confirmation and produce exactly the same ledger entry.
 */
export function ReturnAssignmentButton({
  assignmentId,
  assetTag,
  assetName,
  onDone,
  size = "sm",
  variant = "outline",
  label = "Return",
}: {
  assignmentId: string;
  assetTag?: string;
  assetName?: string;
  onDone?: () => void;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "outline" | "ghost" | "destructive";
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [outcome, setOutcome] = React.useState<Outcome>("RETURNED");
  const [condition, setCondition] = React.useState<string>("GOOD");
  const [notes, setNotes] = React.useState("");

  async function submit() {
    setPending(true);
    try {
      const result = await returnAssets({
        assignmentIds: [assignmentId],
        condition: condition as never,
        outcome,
        notes: notes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success("Return recorded", {
        description: `${assetTag ?? "Asset"} → ${assetStatusLabel(returnAssetStatus(outcome, condition as never))}.`,
      });
      setOpen(false);
      setNotes("");
      onDone?.();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setNotes("");
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <Undo2 /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record return{assetTag ? ` — ${assetTag}` : ""}</DialogTitle>
          <DialogDescription>
            {assetName ? `${assetName}. ` : ""}Custody returns to the company and the assignment is
            closed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(value) => setOutcome(value as Outcome)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETURNED">Returned</SelectItem>
                  <SelectItem value="DAMAGED">Returned damaged</SelectItem>
                  <SelectItem value="MISSING">Missing / not returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Condition on return</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
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
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Accessories returned, visible wear…"
            />
          </div>

          <div className="rounded-lg border bg-muted/40 p-3 text-xs">
            <p className="mb-1.5 font-medium text-foreground">What happens when you confirm</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>The open assignment closes and custody returns to the company.</li>
              <li>
                {assetTag ? <span className="font-mono">{assetTag}</span> : "The asset"} becomes{" "}
                <span className="text-foreground">
                  {assetStatusLabel(returnAssetStatus(outcome, condition as never))}
                </span>
                .
              </li>
              <li>{describeReturnOutcome(outcome, condition as never)}</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
