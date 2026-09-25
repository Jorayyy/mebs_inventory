"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw, User, Laptop, History } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AssignmentStatusBadge,
  AssetStatusBadge,
  ConditionBadge,
} from "@/components/shared/status-badge";
import { DetailGrid, DetailItem, EmptyState } from "@/components/shared/page-header";
import { getAssignmentDetail, returnAssets } from "@/actions/assignments";
import { ASSET_CONDITION } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/utils";

type Detail = Awaited<ReturnType<typeof getAssignmentDetail>>;

const OUTCOMES = [
  { value: "RETURNED", label: "Returned in good order" },
  { value: "DAMAGED", label: "Returned damaged" },
  { value: "MISSING", label: "Not returned (missing)" },
] as const;

export function AssignmentDrawer({
  assignmentId,
  closeHref,
  canReturn,
}: {
  assignmentId: string | null;
  closeHref: string;
  canReturn: boolean;
}) {
  const router = useRouter();
  const close = () => router.replace(closeHref, { scroll: false });
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [returnOpen, setReturnOpen] = React.useState(false);
  const [condition, setCondition] = React.useState("GOOD");
  const [outcome, setOutcome] = React.useState<string>("RETURNED");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!assignmentId) {
      setDetail(null);
      setError(null);
      setReturnOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAssignmentDetail(assignmentId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load assignment");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  const submitReturn = async () => {
    if (!assignmentId) return;
    setPending(true);
    try {
      const result = await returnAssets({
        assignmentIds: [assignmentId],
        condition,
        outcome,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success(`Asset returned (${result.data.processed})`);
      setReturnOpen(false);
      close();
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  const assignment = detail?.assignment;
  const canReturnNow =
    canReturn && assignment && ["ACTIVE", "RETURN_PENDING"].includes(assignment.status);

  return (
    <Sheet open={assignmentId !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Assignment</SheetTitle>
          <SheetDescription>
            Full custody record and the asset&apos;s recent ledger.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {error && <EmptyState title="Could not load this assignment" description={error} />}

        {!loading && !error && !assignment && (
          <EmptyState title="Assignment not found" />
        )}

        {assignment && (
          <div className="space-y-4 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <AssignmentStatusBadge status={assignment.status} />
              <AssetStatusBadge status={assignment.asset.status} />
              <ConditionBadge condition={assignment.asset.condition} />
            </div>

            <section className="rounded-lg border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" /> Employee
              </p>
              <DetailGrid className="grid-cols-1 sm:grid-cols-2">
                <DetailItem label="Name">
                  {assignment.employee.firstName} {assignment.employee.lastName}
                </DetailItem>
                <DetailItem label="Employee no.">{assignment.employee.employeeNo}</DetailItem>
                <DetailItem label="Job title">{assignment.employee.jobTitle ?? "—"}</DetailItem>
                <DetailItem label="Department">{assignment.employee.department?.name ?? "—"}</DetailItem>
                <DetailItem label="Email">{assignment.employee.email ?? "—"}</DetailItem>
                <DetailItem label="Employment">{assignment.employee.employmentStatus}</DetailItem>
              </DetailGrid>
            </section>

            <section className="rounded-lg border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Laptop className="h-3.5 w-3.5" /> Asset
              </p>
              <div className="mb-2">
                <Link
                  href={`/assets/${assignment.asset.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {assignment.asset.assetTag}
                </Link>
                <p className="text-sm text-muted-foreground">{assignment.asset.name}</p>
              </div>
              <DetailGrid className="grid-cols-1 sm:grid-cols-2">
                <DetailItem label="Serial">{assignment.asset.serialNumber ?? "—"}</DetailItem>
                <DetailItem label="Site">{assignment.asset.site.name}</DetailItem>
                <DetailItem label="Category">{assignment.asset.category?.name ?? "—"}</DetailItem>
                <DetailItem label="Custody area">{assignment.asset.department?.name ?? "—"}</DetailItem>
              </DetailGrid>
            </section>

            <section className="rounded-lg border p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Assignment
              </p>
              <DetailGrid className="grid-cols-1 sm:grid-cols-2">
                <DetailItem label="Assigned">{formatDate(assignment.assignedAt, true)}</DetailItem>
                <DetailItem label="Assigned by">{assignment.assignedBy?.name ?? "—"}</DetailItem>
                <DetailItem label="Condition at handover">{assignment.conditionAtAssignment}</DetailItem>
                <DetailItem label="Due back">{formatDate(assignment.expectedReturnAt)}</DetailItem>
                <DetailItem label="Acknowledged">
                  {assignment.acknowledgedAt ? formatDate(assignment.acknowledgedAt, true) : "Not yet"}
                </DetailItem>
                <DetailItem label="Returned">
                  {assignment.returnedAt ? formatDate(assignment.returnedAt, true) : "—"}
                </DetailItem>
                <DetailItem label="Returned to">{assignment.returnedBy?.name ?? "—"}</DetailItem>
                <DetailItem label="Return condition">{assignment.returnCondition ?? "—"}</DetailItem>
              </DetailGrid>
              {assignment.notes && (
                <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm">
                  {assignment.notes}
                </p>
              )}
              {assignment.returnNotes && (
                <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2 text-sm">
                  {assignment.returnNotes}
                </p>
              )}
            </section>

            <section className="rounded-lg border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" /> Asset ledger
              </p>
              {detail && detail.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recorded movement yet.</p>
              ) : (
                <ul className="space-y-2">
                  {detail?.transactions.map((tx) => (
                    <li key={tx.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {tx.fromStatus} → {tx.toStatus}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {tx.notes || tx.type} · {tx.performedBy?.name ?? "System"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelative(tx.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {canReturnNow && (
              <div className="rounded-lg border border-dashed p-3">
                {!returnOpen ? (
                  <Button size="sm" className="w-full" onClick={() => setReturnOpen(true)}>
                    <RotateCcw /> Record return
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="drawer-condition">Returned condition</Label>
                      <Select value={condition} onValueChange={setCondition}>
                        <SelectTrigger id="drawer-condition">
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
                      <Label htmlFor="drawer-outcome">Outcome</Label>
                      <Select value={outcome} onValueChange={setOutcome}>
                        <SelectTrigger id="drawer-outcome">
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
                      <Label htmlFor="drawer-notes">Notes</Label>
                      <Textarea
                        id="drawer-notes"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReturnOpen(false)}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={submitReturn} disabled={pending}>
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw />}
                        Confirm return
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
