"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { EMPLOYMENT_STATUS } from "@/lib/constants";

export type EmployeeRow = {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  employmentStatus: string;
  hireDate: Date | null;
  exitDate: Date | null;
  createdAt: Date;
  site: { id: string; name: string; code: string };
  department: { id: string; name: string };
  team: { id: string; name: string } | null;
  user: { id: string; email: string; status: string } | null;
};

export const employeeColumns: ColumnDef<EmployeeRow>[] = [
  {
    id: "name",
    accessorFn: (row) => `${row.lastName} ${row.firstName}`,
    header: "Employee",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/employees/${row.original.id}`}
          className="block truncate font-medium text-primary hover:underline"
        >
          {row.original.firstName} {row.original.lastName}
        </Link>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {row.original.employeeNo}
        </span>
      </div>
    ),
  },
  {
    id: "jobTitle",
    accessorFn: (row) => row.jobTitle ?? "",
    header: "Job title",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.original.jobTitle || "—"}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.email || "No email"}</p>
      </div>
    ),
  },
  {
    id: "site",
    accessorFn: (row) => row.site.name,
    header: "Site",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.original.site.name}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.site.code}</p>
      </div>
    ),
  },
  {
    id: "department",
    accessorFn: (row) => row.department.name,
    header: "Department",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.original.department.name}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.team?.name || "—"}</p>
      </div>
    ),
  },
  {
    id: "employmentStatus",
    accessorFn: (row) => row.employmentStatus,
    header: "Employment",
    cell: ({ row }) => (
      <StatusBadge status={row.original.employmentStatus} map={EMPLOYMENT_STATUS} />
    ),
  },
  {
    id: "account",
    accessorFn: (row) => row.user?.email ?? "",
    header: "Account",
    cell: ({ row }) =>
      row.original.user ? (
        <div className="min-w-0">
          <Link
            href={`/settings/users/${row.original.user.id}`}
            className="block truncate text-sm hover:underline"
          >
            {row.original.user.email}
          </Link>
          <span className="block text-[11px] text-muted-foreground">{row.original.user.status}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Not linked</span>
      ),
  },
  {
    id: "hireDate",
    accessorFn: (row) => row.hireDate?.toISOString() ?? "",
    header: "Hired",
    cell: ({ row }) => <span className="text-xs">{formatDate(row.original.hireDate)}</span>,
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <Link
          href={`/employees/${row.original.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          View
        </Link>
      </div>
    ),
  },
];
