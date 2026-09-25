"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignmentStatusBadge, ConditionBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/page-header";
import { formatDate } from "@/lib/utils";
import { ASSET_CONDITION } from "@/lib/constants";
import { assignAssets } from "@/actions/assets";
import { returnAssets } from "@/actions/assignments";
import type { AssetDetailData } from "@/components/assets/asset-detail";

export function AssignmentPanel({
  data,
  onChange,
}: {
  data: AssetDetailData;
  onChange: () => void;
}) {
  const router = useRouter();
  const { asset, assignments, permissions } = data;

  const [assignOpen, setAssignOpen] = React.useState(false);
  const [returning, setReturning] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const [employeeId, setEmployeeId] = React.useState("");
  const [condition, setCondition] = React.useState<string>("GOOD");
  const [expectedReturnAt, setExpectedReturnAt] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [returnCondition, setReturnCondition] = React.useState<string>("GOOD");
  const [returnOutcome, setReturnOutcome] = React.useState<"RETURNED" | "DAMAGED" | "MISSING">(
    "RETURNED"
  );
  const [returnNotes, setReturnNotes] = React.useState("");

  const [employees, setEmployees] = React.useState<{ id: string; label: string }[]>([]);
  const [loadingEmployees, setLoadingEmployees] = React.useState(false);

  async function openAssign() {
    setAssignOpen(true);
    if (employees.length > 0) return;
    setLoadingEmployees(true);
    try {
      const { getFormOptions } = await import("@/actions/catalog");
      const options = await getFormOptions();
      setEmployees(options.employees);
    } catch {
      toast.error("Could not load employees");
    } finally {
      setLoadingEmployees(false);
    }
  }

  async function submitAssign() {
    setPending(true);
    try {
      const result = await assignAssets({
        assetIds: [asset.id],
        employeeId,
        conditionAtAssignment: condition as never,
        expectedReturnAt: expectedReturnAt || undefined,
        notes: notes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success("Asset assigned");
      setAssignOpen(false);
      setEmployeeId("");
      setNotes("");
      onChange();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitReturn() {
    if (!returning) return;
    setPending(true);
    try {
      const result = await returnAssets({
        assignmentIds: [returning],
        condition: returnCondition as never,
        outcome: returnOutcome,
        notes: returnNotes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success("Return recorded");
      setReturning(null);
      setReturnNotes("");
      onChange();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const activeCount = assignments.filter(
    (a) => a.status === "ACTIVE" || a.status === "RETURN_PENDING"
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {activeCount} open assignment{activeCount === 1 ? "" : "s"} ·{" "}
          {assignments.length} total in history
        </div>
        {permissions.assign && asset.status !== "ASSIGNED" && (
          <Button size="sm" onClick={openAssign}>
            <UserPlus /> Assign asset
          </Button>
        )}
        {permissions.assign && asset.status === "ASSIGNED" && asset.assignedEmployee && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const open = assignments.find(
                (a) => a.status === "ACTIVE" || a.status === "RETURN_PENDING"
              );
              if (open) setReturning(open.id);
            }}
          >
            <Undo2 /> Record return
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        {assignments.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<UserPlus className="h-8 w-8" />}
              title="Never assigned"
              description={
                permissions.assign
                  ? "Assign this asset to an employee to start tracking custody."
                  : "This asset has no assignment history."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Expected return</TableHead>
                <TableHead>Returned</TableHead>
                <TableHead>Acknowledged</TableHead>
                {permissions.assign && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <a
                      href={`/employees/${assignment.employee.id}`}
                      className="font-medium hover:underline"
                    >
                      {assignment.employee.firstName} {assignment.employee.lastName}
                    </a>
                    <p className="text-xs text-muted-foreground">{assignment.employee.employeeNo}</p>
                  </TableCell>
                  <TableCell>
                    <AssignmentStatusBadge status={assignment.status as never} />
                    {assignment.status === "RETURN_PENDING" && (
                      <p className="mt-1 text-[11px] text-amber-600">Return requested</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(assignment.assignedAt)}
                    <p className="text-muted-foreground">by {assignment.assignedBy.name}</p>
                  </TableCell>
                  <TableCell>
                    <ConditionBadge condition={assignment.conditionAtAssignment as never} />
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatDate(assignment.expectedReturnAt)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {assignment.returnedAt ? (
                      <>
                        {formatDate(assignment.returnedAt)}
                        {assignment.returnCondition && (
                          <p>
                            <ConditionBadge condition={assignment.returnCondition as never} />
                          </p>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {assignment.acknowledgedAt ? (
                      <Badge variant="success">Signed</Badge>
                    ) : (
                      <Badge variant="muted">Pending</Badge>
                    )}
                  </TableCell>
                  {permissions.assign && (
                    <TableCell className="text-right">
                      {(assignment.status === "ACTIVE" ||
                        assignment.status === "RETURN_PENDING") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7"
                          onClick={() => setReturning(assignment.id)}
                        >
                          <Undo2 /> Return
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {asset.assetTag}</DialogTitle>
            <DialogDescription>
              Custody transfers to the selected employee and is written to the asset ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingEmployees ? "Loading…" : "Select employee"} />
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Condition at assignment</Label>
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
              <div className="space-y-1.5">
                <Label>Expected return date</Label>
                <Input
                  type="date"
                  value={expectedReturnAt}
                  onChange={(e) => setExpectedReturnAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAssign} disabled={pending || !employeeId}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returning !== null} onOpenChange={(open) => !open && setReturning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record return</DialogTitle>
            <DialogDescription>
              Closes the assignment and updates the asset&apos;s status and condition.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Outcome</Label>
                <Select
                  value={returnOutcome}
                  onValueChange={(v) => setReturnOutcome(v as typeof returnOutcome)}
                >
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
                <Select value={returnCondition} onValueChange={setReturnCondition}>
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
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Accessories returned, visible wear…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReturning(null)}>
              Cancel
            </Button>
            <Button onClick={submitReturn} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
