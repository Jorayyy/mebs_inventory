"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { AssignmentStatusBadge, AssetStatusBadge, ConditionBadge } from "@/components/shared/status-badge";
import { formatDate, formatRelative } from "@/lib/utils";

export type AssignmentRow = {
  id: string;
  status: string;
  assignedAt: Date;
  expectedReturnAt: Date | null;
  acknowledgedAt: Date | null;
  conditionAtAssignment: string;
  assignedBy: string | null;
  asset: {
    id: string;
    assetTag: string;
    name: string;
    status: string;
    condition: string;
    serialNumber: string | null;
  };
  employee: {
    id: string;
    name: string;
    employeeNo: string;
    jobTitle: string | null;
    department: string | null;
  };
  site: { name: string } | null;
};

export const assignmentColumns: ColumnDef<AssignmentRow>[] = [
  {
    id: "employee",
    accessorFn: (row) => row.employee.name,
    header: "Employee",
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="block truncate font-medium">{row.original.employee.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {row.original.employee.employeeNo}
          {row.original.employee.jobTitle ? ` · ${row.original.employee.jobTitle}` : ""}
        </span>
      </div>
    ),
  },
  {
    id: "asset",
    accessorFn: (row) => row.asset.assetTag,
    header: "Asset",
    cell: ({ row }) => (
      <div className="min-w-0">
        <span className="block truncate font-medium">{row.original.asset.assetTag}</span>
        <span className="block truncate text-xs text-muted-foreground">{row.original.asset.name}</span>
      </div>
    ),
  },
  {
    id: "site",
    accessorFn: (row) => row.site?.name ?? "",
    header: "Site",
    cell: ({ row }) => <span className="text-sm">{row.original.site ? row.original.site.name : "—"}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <AssignmentStatusBadge status={row.original.status as never} />,
  },
  {
    accessorKey: "assignedAt",
    header: "Assigned",
    cell: ({ row }) => (
      <div className="text-xs">
        <span className="block">{formatDate(row.original.assignedAt)}</span>
        <span className="block text-muted-foreground">
          {row.original.assignedBy ?? "—"}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "expectedReturnAt",
    header: "Due back",
    cell: ({ row }) => (
      <span className="text-xs" title={formatRelative(row.original.expectedReturnAt)}>
        {formatDate(row.original.expectedReturnAt)}
      </span>
    ),
  },
  {
    id: "condition",
    header: "Condition",
    cell: ({ row }) => (
      <ConditionBadge condition={row.original.asset.condition as never} />
    ),
  },
  {
    id: "assetStatus",
    header: "Asset",
    cell: ({ row }) => <AssetStatusBadge status={row.original.asset.status as never} />,
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <AssignmentRowActions id={row.original.id} />,
  },
];

function AssignmentRowActions({ id }: { id: string }) {
  const router = useRouter();
  return (
    <div className="flex justify-end">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        onClick={() => router.push(`/assignments?open=${id}`)}
      >
        <ExternalLink className="h-3.5 w-3.5" /> Open
      </button>
    </div>
  );
}
