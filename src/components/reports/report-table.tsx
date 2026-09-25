"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buildQuery } from "@/lib/query";
import { cn } from "@/lib/utils";
import { BADGE_MAPS } from "./badge-maps";
import { formatCellText } from "./format";
import type { ReportColumn, ReportRow } from "./types";

type TableRow = ReportRow & { __row: string };

function ReportCell({ value, column }: { value: ReportRow[string]; column: ReportColumn }) {
  if (column.kind === "badge" && column.badge) {
    return <StatusBadge status={String(value ?? "")} map={BADGE_MAPS[column.badge]} />;
  }
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  const text = formatCellText(value, column.kind);
  if (column.kind === "mono") return <span className="font-mono text-xs">{text}</span>;
  if (column.kind === "currency" || column.kind === "number" || column.kind === "percent") {
    return (
      <span className={cn("block tabular-nums text-sm", column.align === "right" && "text-right")}>{text}</span>
    );
  }
  return <span className="text-sm">{text}</span>;
}

export function ReportTable({
  slug,
  columns,
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
  serverPaging,
}: {
  slug: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  sort?: string;
  dir?: "asc" | "desc";
  serverPaging: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const data = React.useMemo(
    () => rows.map((row, index) => ({ ...row, __row: `${slug}-${page}-${index}` })),
    [rows, page, slug]
  );

  const tableColumns = React.useMemo<ColumnDef<TableRow>[]>(
    () =>
      columns.map((column) => ({
        accessorKey: column.key,
        header: column.header,
        enableSorting: serverPaging ? Boolean(column.sortable) : true,
        cell: ({ row }) => <ReportCell value={row.original[column.key]} column={column} />,
      })),
    [columns, serverPaging]
  );

  const navigate = (patch: Record<string, string | undefined>) => {
    router.replace(`${pathname}${buildQuery(Object.fromEntries(searchParams), patch)}`, { scroll: false });
  };

  return (
    <DataTable
      columns={tableColumns}
      data={data}
      total={serverPaging ? total : undefined}
      page={page}
      pageSize={pageSize}
      rowId={(row) => row.__row}
      manualSorting={serverPaging}
      sort={serverPaging && sort ? { id: sort, desc: dir === "desc" } : null}
      onSortChange={(next) =>
        navigate(
          next
            ? { sort: next.id, dir: next.desc ? "desc" : "asc", page: undefined }
            : { sort: undefined, dir: undefined }
        )
      }
      onPageChange={(next) => navigate({ page: String(next) })}
      emptyState={
        <EmptyState
          title="No records match your filters"
          description="Adjust the filters above or widen the date range."
        />
      }
    />
  );
}
