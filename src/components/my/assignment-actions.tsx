"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Undo2, TriangleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  acknowledgeAssignment,
  requestAssetReturn,
  reportAssetIssue,
} from "@/actions/assignments";
import type { ActionResult } from "@/lib/errors";

type AssignmentSummary = {
  id: string;
  status: string;
  acknowledgedAt: Date | null;
  assetId: string;
  assetTag: string;
};

export function AssignmentActions({
  assignment,
  canRequest = true,
}: {
  assignment: AssignmentSummary;
  canRequest?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [returnOpen, setReturnOpen] = React.useState(false);
  const [issueOpen, setIssueOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [kind, setKind] = React.useState("DAMAGED");
  const [details, setDetails] = React.useState("");

  async function run(action: () => Promise<ActionResult<unknown>>, label: string) {
    setPending(label);
    try {
      const result = await action();
      if (result.ok) {
        toast.success(label === "ack" ? "Assignment acknowledged" : `${label} sent`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  if (assignment.status === "RETURN_PENDING") {
    return <Badge variant="warning">Return requested</Badge>;
  }

  if (assignment.status !== "ACTIVE") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canRequest && !assignment.acknowledgedAt && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => run(() => acknowledgeAssignment(assignment.id), "ack")}
        >
          {pending === "ack" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <CheckCheck />
          )}
          Acknowledge
        </Button>
      )}

      {canRequest && (
        <>
          <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Undo2 /> Request return
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request a return</DialogTitle>
                <DialogDescription>
                  {assignment.assetTag} will move to “return pending” and the inventory team will be
                  notified. Hand the device over in person afterwards.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor={`reason-${assignment.id}`}>Reason (optional)</Label>
                <Textarea
                  id={`reason-${assignment.id}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. laptop upgraded, leaving the project"
                  maxLength={1000}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReturnOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={pending !== null}
                  onClick={async () => {
                    await run(
                      () => requestAssetReturn({ assignmentId: assignment.id, reason }),
                      "return"
                    );
                    setReturnOpen(false);
                    setReason("");
                  }}
                >
                  {pending === "return" ? <Loader2 className="animate-spin" /> : <Undo2 />}
                  Send request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <TriangleAlert /> Report issue
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report a problem</DialogTitle>
                <DialogDescription>
                  Report {assignment.assetTag} as damaged or lost. The asset is flagged immediately
                  and a maintenance report is raised for the team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`kind-${assignment.id}`}>What happened?</Label>
                  <Select value={kind} onValueChange={setKind}>
                    <SelectTrigger id={`kind-${assignment.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAMAGED">Damaged / not working</SelectItem>
                      <SelectItem value="LOST">Lost or stolen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`details-${assignment.id}`}>Details</Label>
                  <Textarea
                    id={`details-${assignment.id}`}
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Describe what happened"
                    maxLength={2000}
                  />
                  {details.trim().length > 0 && details.trim().length < 5 && (
                    <p className="text-xs font-medium text-destructive">
                      Add a little more detail (at least 5 characters)
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setIssueOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending !== null || details.trim().length < 5}
                  onClick={async () => {
                    await run(
                      () =>
                        reportAssetIssue({
                          assetId: assignment.assetId,
                          kind: kind as never,
                          details: details.trim(),
                        }),
                      "issue"
                    );
                    setIssueOpen(false);
                    setDetails("");
                  }}
                >
                  {pending === "issue" ? <Loader2 className="animate-spin" /> : <TriangleAlert />}
                  Submit report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
