"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus, Loader2, PackageX, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AssignmentStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/page-header";
import { getEmployeeExitSummary, setEmployeeExit, type EmployeeExitSummary } from "@/actions/employees";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function EmployeeExitButton({
  employeeId,
  employeeName,
  disabled,
}: {
  employeeId: string;
  employeeName: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [summary, setSummary] = React.useState<EmployeeExitSummary | null>(null);
  const [exitDate, setExitDate] = React.useState(todayISO());

  async function handleOpen(next: boolean) {
    setOpen(next);
    if (!next || summary) return;
    setLoading(true);
    const result = await getEmployeeExitSummary(employeeId);
    setLoading(false);
    if (result.ok) setSummary(result.data);
    else toast.error(result.error, { description: `Reference: ${result.errorId}` });
  }

  async function confirmExit() {
    setSaving(true);
    const result = await setEmployeeExit(employeeId, exitDate);
    setSaving(false);
    if (result.ok) {
      toast.success(`${employeeName} marked as exited`);
      setOpen(false);
      setSummary(null);
      router.refresh();
    } else {
      toast.error(result.error, { description: `Reference: ${result.errorId}` });
    }
  }

  const outstanding =
    (summary?.openAssignments.length ?? 0) + (summary?.assignedAssets.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <UserMinus /> Mark exit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Offboard {employeeName}</DialogTitle>
          <DialogDescription>
            Sets the employment status to EXITED. Outstanding equipment must be settled through the
            return workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="exitDate">Exit date</Label>
            <Input
              id="exitDate"
              type="date"
              value={exitDate}
              onChange={(event) => setExitDate(event.target.value)}
              className="mt-1.5"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-md border border-dashed py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking outstanding items…
            </div>
          ) : summary ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Outstanding items</span>
                <Badge variant={outstanding > 0 ? "warning" : "success"}>
                  {outstanding > 0 ? `${outstanding} to settle` : "All clear"}
                </Badge>
              </div>

              {summary.openAssignments.length > 0 && (
                <div className="rounded-md border">
                  <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <PackageX className="h-3.5 w-3.5" /> Open assignments
                  </p>
                  <ul className="divide-y">
                    {summary.openAssignments.map((row) => (
                      <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-mono">{row.assetTag}</p>
                          <p className="truncate text-xs text-muted-foreground">{row.assetName}</p>
                        </div>
                        <AssignmentStatusBadge status={row.status as never} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.assignedAssets.length > 0 && (
                <div className="rounded-md border">
                  <p className="flex items-center gap-1.5 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <Laptop className="h-3.5 w-3.5" /> Assets still assigned
                  </p>
                  <ul className="divide-y">
                    {summary.assignedAssets.map((asset) => (
                      <li key={asset.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-mono">{asset.assetTag}</p>
                          <p className="truncate text-xs text-muted-foreground">{asset.name}</p>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{asset.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {outstanding === 0 && (
                <EmptyState
                  title="Nothing outstanding"
                  description="No open assignments or assets are linked to this employee."
                />
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmExit} disabled={saving || !summary}>
            {saving ? "Saving…" : "Mark as exited"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
