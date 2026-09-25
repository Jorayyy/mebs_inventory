import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str } from "@/lib/query";
import { formatDate, formatRelative } from "@/lib/utils";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { AssignmentStatusBadge } from "@/components/shared/status-badge";
import { ASSIGNMENT_STATUS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { FilterBar, FilterSelect } from "@/components/shared/filters";

export const metadata: Metadata = { title: "Assignment history" };

const STATUS_OPTIONS = Object.entries(ASSIGNMENT_STATUS).map(([value, meta]) => ({
  value,
  label: meta.label,
}));

export default async function MyAssignmentsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.SELF_SERVICE_VIEW);
  const status = str(searchParams, "status");

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    select: { id: true, firstName: true, employeeNo: true },
  });

  if (!employee) {
    return (
      <div className="space-y-4">
        <PageHeader title="Assignment history" />
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="No employee profile is linked to your account"
          description="Ask an administrator to link your account before reviewing assignment history."
        />
      </div>
    );
  }

  const assignments = await prisma.assetAssignment.findMany({
    where: {
      employeeId: employee.id,
      ...(status ? { status: status as never } : {}),
    },
    include: {
      asset: {
        select: {
          id: true,
          assetTag: true,
          name: true,
          condition: true,
          category: { select: { name: true } },
        },
      },
    },
    orderBy: { assignedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assignment history"
        breadcrumb={
          <Link href="/my" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> My assets
          </Link>
        }
        description={`${employee.employeeNo} — every handover, acknowledgement and return on record.`}
      />

      <FilterBar>
        <FilterSelect
          param="status"
          label="Status"
          allLabel="Any status"
          options={STATUS_OPTIONS}
        />
      </FilterBar>

      {assignments.length === 0 ? (
        <EmptyState
          icon={<History className="h-8 w-8" />}
          title="No assignments match"
          description="Clear the filter to see your full history."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Assigned</th>
                <th className="px-3 py-2 font-medium">Acknowledged</th>
                <th className="px-3 py-2 font-medium">Returned</th>
                <th className="px-3 py-2 font-medium">Return notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assignments.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-3 py-2">
                    <Link
                      href={`/assets/${entry.asset.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {entry.asset.name}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {entry.asset.assetTag}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {entry.asset.category?.name ?? "Uncategorised"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <AssignmentStatusBadge status={entry.status} />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatDate(entry.assignedAt)}
                    <span className="block">{entry.conditionAtAssignment}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {entry.acknowledgedAt ? formatRelative(entry.acknowledgedAt) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {entry.returnedAt ? formatDate(entry.returnedAt) : "—"}
                    {entry.returnCondition && (
                      <span className="block">{entry.returnCondition}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {entry.returnNotes || entry.notes ? (
                      <span className="text-xs text-muted-foreground">
                        {entry.returnNotes || entry.notes}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {assignments.length === 200 && (
        <p className="text-xs text-muted-foreground">
          Showing the 200 most recent assignments.
          <Badge variant="outline" className="ml-2">
            Ask an admin for a full export
          </Badge>
        </p>
      )}
    </div>
  );
}
