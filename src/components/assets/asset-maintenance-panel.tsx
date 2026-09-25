"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wrench, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { MaintenanceStatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/page-header";
import { formatDate, formatCurrency } from "@/lib/utils";
import { createMaintenance, updateMaintenance } from "@/actions/maintenance";
import { MAINTENANCE_STATUS } from "@/lib/constants";
import type { AssetDetailData } from "@/components/assets/asset-detail";

type MaintenanceRow = AssetDetailData["maintenance"][number];

export function MaintenancePanel({
  data,
  onChange,
}: {
  data: AssetDetailData;
  onChange: () => void;
}) {
  const router = useRouter();
  const { asset, maintenance, permissions } = data;

  const [reportOpen, setReportOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<MaintenanceRow | null>(null);
  const [pending, setPending] = React.useState(false);

  const [issue, setIssue] = React.useState("");
  const [reportNotes, setReportNotes] = React.useState("");

  const [status, setStatus] = React.useState("");
  const [diagnosis, setDiagnosis] = React.useState("");
  const [repairAction, setRepairAction] = React.useState("");
  const [partsUsed, setPartsUsed] = React.useState("");
  const [cost, setCost] = React.useState("");

  async function submitReport() {
    setPending(true);
    try {
      const result = await createMaintenance({
        assetId: asset.id,
        issue,
        notes: reportNotes || undefined,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success("Maintenance ticket created");
      setReportOpen(false);
      setIssue("");
      setReportNotes("");
      onChange();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function submitUpdate() {
    if (!editing) return;
    setPending(true);
    try {
      const result = await updateMaintenance({
        id: editing.id,
        status,
        diagnosis,
        repairAction,
        partsUsed,
        cost,
      });
      if (!result.ok) {
        toast.error(result.error, { description: `Reference: ${result.errorId}` });
        return;
      }
      toast.success("Maintenance updated");
      setEditing(null);
      onChange();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const openReport = maintenance.filter(
    (m) => !["COMPLETED", "RETURNED_TO_SERVICE", "CANCELLED"].includes(m.status)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {openReport.length} open ticket{openReport.length === 1 ? "" : "s"} ·{" "}
          {formatCurrency(maintenance.reduce((sum, m) => sum + Number(m.cost || 0), 0))} lifetime
          cost
        </div>
        {permissions.maintenance && openReport.length === 0 && (
          <Button size="sm" onClick={() => setReportOpen(true)}>
            <Wrench /> Report issue
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        {maintenance.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Wrench className="h-8 w-8" />}
              title="No maintenance history"
              description={
                permissions.maintenance
                  ? "Report an issue to open the first maintenance ticket."
                  : "This asset has never been serviced."
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Reported by</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Cost</TableHead>
                {permissions.maintenance && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenance.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.referenceNo}</TableCell>
                  <TableCell className="max-w-[280px]">
                    <p className="truncate text-sm" title={row.issue}>
                      {row.issue}
                    </p>
                  </TableCell>
                  <TableCell>
                    <MaintenanceStatusBadge status={row.status as never} />
                  </TableCell>
                  <TableCell className="text-xs">{formatDate(row.reportedAt)}</TableCell>
                  <TableCell className="text-xs">{row.reportedBy.name}</TableCell>
                  <TableCell className="text-xs">{row.technician?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {formatCurrency(Number(row.cost || 0))}
                  </TableCell>
                  {permissions.maintenance && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        onClick={() => {
                          setEditing(row);
                          setStatus(row.status);
                          setCost(String(Number(row.cost || 0)));
                        }}
                      >
                        <Pencil /> Update
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report issue — {asset.assetTag}</DialogTitle>
            <DialogDescription>
              Opens a maintenance ticket and flags the asset as under maintenance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Issue</Label>
              <Textarea
                rows={3}
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="e.g. BSOD on boot, intermittent power loss…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={2} value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitReport} disabled={pending || issue.trim().length < 5}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>Update {editing?.referenceNo}</DialogTitle>
            <DialogDescription>
              Status changes are written to the asset ledger and audited.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
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
              <Label>Cost</Label>
              <Input type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Diagnosis</Label>
              <Textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Repair action</Label>
              <Textarea rows={2} value={repairAction} onChange={(e) => setRepairAction(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Parts used</Label>
              <Input
                value={partsUsed}
                onChange={(e) => setPartsUsed(e.target.value)}
                placeholder="e.g. 1× replacement battery"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submitUpdate} disabled={pending || !status}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
