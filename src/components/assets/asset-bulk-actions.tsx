"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Tag, UserPlus, Layers } from "lucide-react";
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
import { changeAssetStatus, assignAssets } from "@/actions/assets";
import { useTableSelectionIds } from "@/components/shared/data-table";
import { ASSET_STATUS, ASSET_CONDITION } from "@/lib/constants";

type Mode = "status" | "assign" | null;

/** Toolbar rendered by the assets table with the current selection. */
export function AssetSelectionToolbar({
  selectedIds: selectedIdsProp,
  canAssign,
  canStatus,
  canPrint,
  canTransfer,
}: {
  selectedIds?: string[];
  canAssign: boolean;
  canStatus: boolean;
  canPrint: boolean;
  canTransfer: boolean;
}) {
  const router = useRouter();
  const contextIds = useTableSelectionIds();
  const selectedIds = selectedIdsProp ?? contextIds;
  const [mode, setMode] = React.useState<Mode>(null);
  const [status, setStatus] = React.useState("");
  const [condition, setCondition] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [employees, setEmployees] = React.useState<
    { id: string; label: string }[]
  >([]);
  const [loadingEmployees, setLoadingEmployees] = React.useState(false);

  const count = selectedIds.length;
  if (count === 0) return null;

  async function loadEmployees() {
    setLoadingEmployees(true);
    try {
      const { searchEmployees } = await import("@/actions/employees");
      const rows = await searchEmployees("");
      setEmployees(rows.map((e) => ({ id: e.id, label: `${e.label}` })));
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function submit() {
    setPending(true);
    try {
      if (mode === "status") {
        const result = await changeAssetStatus({
          ids: selectedIds,
          status,
          condition: condition || undefined,
          notes: notes || undefined,
        });
        if (!result.ok) {
          toast.error(result.error, { description: `Reference: ${result.errorId}` });
          return;
        }
        toast.success(`Updated ${result.data.updated} asset(s)`);
      } else if (mode === "assign") {
        const result = await assignAssets({
          assetIds: selectedIds,
          employeeId,
          conditionAtAssignment: (condition || "GOOD") as never,
          notes: notes || undefined,
        });
        if (!result.ok) {
          toast.error(result.error, { description: `Reference: ${result.errorId}` });
          return;
        }
        toast.success(`Assigned ${result.data.assigned} asset(s)`);
      }
      setMode(null);
      setNotes("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border bg-muted px-2 py-1 text-xs font-medium">
          {count} selected
        </span>
        {canStatus && (
          <Button variant="outline" size="sm" className="h-8" onClick={() => setMode("status")}>
            <Layers /> Change status
          </Button>
        )}
        {canAssign && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setMode("assign");
              if (employees.length === 0) void loadEmployees();
            }}
          >
            <UserPlus /> Assign
          </Button>
        )}
        {canTransfer && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => router.push(`/transfers/new?assetIds=${selectedIds.join(",")}`)}
          >
            <ArrowLeftRight /> Transfer
          </Button>
        )}
        {canPrint && (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => router.push(`/labels?ids=${selectedIds.join(",")}`)}
          >
            <Tag /> Labels
          </Button>
        )}
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "status" ? "Change status" : "Assign assets"} ({count})
            </DialogTitle>
            <DialogDescription>
              Applies to every selected asset. The change is written to each asset&apos;s immutable
              transaction history.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {mode === "assign" ? (
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={loadingEmployees ? "Loading…" : "Select employee"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>New status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSET_STATUS).map(([value, meta]) => (
                      <SelectItem key={value} value={value}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Keep current condition" />
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
              <Label>Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || (mode === "status" ? !status : !employeeId)}
            >
              {pending ? "Saving…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
