"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard, EmptyState, SectionCard } from "@/components/shared/page-header";
import { AssignmentStatusBadge, AssetStatusBadge } from "@/components/shared/status-badge";
import { getClearanceChecklist, clearEmployee, searchEmployeesForClearance, type ClearanceCandidate } from "@/actions/clearance";
import { returnAssets } from "@/actions/assignments";
import { ASSET_CONDITION } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/utils";

type Checklist = Awaited<ReturnType<typeof getClearanceChecklist>>;

const OUTCOMES = [
  { value: "RETURNED", label: "Returned in good order" },
  { value: "DAMAGED", label: "Returned damaged" },
  { value: "MISSING", label: "Not returned (missing)" },
] as const;

/** Type-ahead employee search used at the top of the clearance desk. */
export function ClearanceEmployeeSearch({ initialQuery = "" }: { initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState<ClearanceCandidate[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchEmployeesForClearance(q);
        if (!cancelled) setResults(rows);
      } catch (error) {
        if (!cancelled) toast.error("Employee search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLoading(false);
    };
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative max-w-lg">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search employee name or number…"
          className="h-9 pl-8 text-sm"
        />
      </div>
      {results.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-md border">
          {results.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                setResults([]);
                setQuery("");
                router.push(`/assignments/clearance?employee=${row.id}`);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{row.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {row.departmentName} · {row.siteName}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {row.openAssignments} open
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Mode = "return" | "clear" | null;

export function ClearancePanel({
  checklist,
  backHref,
  canClear,
}: {
  checklist: Checklist;
  backHref: string;
  canClear: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>(null);
  const [ids, setIds] = React.useState<string[]>([]);
  const [condition, setCondition] = React.useState("GOOD");
  const [outcome, setOutcome] = React.useState<string>("RETURNED");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const { employee, assignments, issues } = checklist;
  const outstandingNet = issues.reduce((sum, issue) => sum + Math.abs(issue.net), 0);

  const openReturn = (assignmentIds: string[]) => {
    setIds(assignmentIds);
    setMode("return");
  };

  const submit = async () => {
    setPending(true);
    try {
      if (mode === "clear") {
        const result = await clearEmployee({
          employeeId: employee.id,
          condition,
          notes,
        });
        if (!result.ok) {
          toast.error(result.error, { description: `Reference: ${result.errorId}` });
          return;
        }
        toast.success(`Cleared ${result.data.returned} assignment(s)`);
        setMode(null);
        router.push("/assignments/clearance");
        router.refresh();
        return;
      }

      const result = await returnAssets({
        assignmentIds: ids,
        condition,
        outcome,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success(`Returned ${result.data.processed} asset(s)`);
      setMode(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to clearance
          </Link>
          <span className="text-sm text-muted-foreground">
            {employee.site.name} · {employee.department.name}
          </span>
        </div>
        <div className="flex gap-2">
          {assignments.length > 0 && canClear && (
            <Button size="sm" variant="outline" onClick={() => openReturn(assignments.map((a) => a.id))}>
              <RotateCcw /> Return all assets
            </Button>
          )}
          <Button
            size="sm"
            disabled={!canClear || assignments.length === 0}
            onClick={() => setMode("clear")}
          >
            <ShieldCheck /> Clear employee
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Open assignments"
          value={assignments.length}
          hint="Assets still in this employee's custody"
          tone={assignments.length ? "warning" : "success"}
        />
        <StatCard
          label="Outstanding stock"
          value={issues.length}
          hint={`${outstandingNet.toFixed(0)} unit(s) net issued`}
          tone={issues.length ? "danger" : "success"}
        />
        <StatCard
          label="Employee"
          value={`${employee.firstName} ${employee.lastName}`}
          hint={`${employee.employeeNo} · ${employee.employmentStatus}`}
        />
      </div>

      <SectionCard
        title="Open assignments"
        description="Close these individually, return them together, or clear everything in one step."
      >
        {assignments.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-8 w-8" />}
            title="No open assignments"
            description="Every asset handed to this employee has been returned."
          />
        ) : (
          <ul className="divide-y">
            {assignments.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.asset.assetTag}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.asset.name} · assigned {formatDate(row.assignedAt)} by {row.assignedBy}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AssignmentStatusBadge status={row.status} />
                  <AssetStatusBadge status={row.asset.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={!canClear}
                    onClick={() => openReturn([row.id])}
                  >
                    Return
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Outstanding consumable issues"
        description="Stock issued to this employee that has not been returned yet."
      >
        {issues.length === 0 ? (
          <EmptyState title="No outstanding stock" description="Consumable issues are fully reconciled." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Net</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2">Last movement</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.inventoryItemId} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{issue.sku}</td>
                    <td className="py-2 pr-3">{issue.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{issue.net}</td>
                    <td className="py-2 pr-3 text-xs">{issue.unit}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {issue.lastType} · {formatRelative(issue.lastAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "clear" ? `Clear ${employee.firstName} ${employee.lastName}` : "Return assets"}
            </DialogTitle>
            <DialogDescription>
              {mode === "clear"
                ? "Closes every open assignment, frees the assets and records a CLEARANCE return for each one."
                : `${ids.length} assignment(s) will be closed with the outcome you pick below.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="clear-condition">Returned condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id="clear-condition">
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

            {mode === "return" && (
              <div className="space-y-1.5">
                <Label htmlFor="clear-outcome">Outcome</Label>
                <Select value={outcome} onValueChange={setOutcome}>
                  <SelectTrigger id="clear-outcome">
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
            )}

            <div className="space-y-1.5">
              <Label htmlFor="clear-notes">Notes</Label>
              <Textarea
                id="clear-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Exit interview — equipment collected in full"
              />
            </div>

            {issues.length > 0 && mode === "clear" && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                {issues.length} consumable line(s) are still outstanding. Clearing closes asset
                assignments only — reconcile stock separately.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "clear" ? <ShieldCheck /> : <RotateCcw />}
              {mode === "clear" ? "Confirm clearance" : "Record return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
