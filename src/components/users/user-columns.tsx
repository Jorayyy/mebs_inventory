"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { formatDate, formatRelative } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { USER_STATUS } from "@/lib/constants";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  role: { key: string; name: string; siteScoped: boolean };
  siteCount: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  mustChangePassword: boolean;
};

export const userColumns: ColumnDef<UserRow>[] = [
  {
    id: "name",
    accessorFn: (row) => row.name,
    header: "User",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          href={`/settings/users/${row.original.id}`}
          className="block truncate font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
        <span className="block truncate text-xs text-muted-foreground">{row.original.email}</span>
      </div>
    ),
  },
  {
    id: "role",
    accessorFn: (row) => row.role.name,
    header: "Role",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-sm">{row.original.role.name}</p>
        <span className="block truncate font-mono text-[11px] text-muted-foreground">
          {row.original.role.key}
        </span>
      </div>
    ),
  },
  {
    id: "status",
    accessorFn: (row) => row.status,
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.original.status} map={USER_STATUS} />,
  },
  {
    id: "scope",
    accessorFn: (row) => row.siteCount,
    header: "Site scope",
    cell: ({ row }) =>
      row.original.siteCount === 0 ? (
        <span className="text-xs text-muted-foreground">All sites</span>
      ) : (
        <span className="text-xs text-muted-foreground">
          {row.original.siteCount} site{row.original.siteCount === 1 ? "" : "s"}
        </span>
      ),
  },
  {
    id: "lastLoginAt",
    accessorFn: (row) => row.lastLoginAt?.getTime() ?? 0,
    header: "Last sign-in",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate text-xs">{formatDate(row.original.lastLoginAt) || "Never"}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {row.original.lastLoginAt ? formatRelative(row.original.lastLoginAt) : "No sign-ins yet"}
        </p>
      </div>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <Link
          href={`/settings/users/${row.original.id}`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Manage
        </Link>
      </div>
    ),
  },
];
