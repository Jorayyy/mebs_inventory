"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/skeleton";

export type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Total rows across all pages when server-side pagination is used. */
  total?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  manualSorting?: boolean;
  sort?: { id: string; desc: boolean } | null;
  onSortChange?: (sort: { id: string; desc: boolean } | null) => void;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: TData) => void;
  enableRowSelection?: boolean;
  /** Override the row id. Only pass this from client components — never from a server page. */
  rowId?: (row: TData) => string;
  emptyState?: React.ReactNode;
  toolbar?: React.ReactNode;
  /** Selection ids are available to `toolbar` through `useTableSelectionIds()`. */
  onSelectionChange?: (ids: string[]) => void;
  className?: string;
};

const SelectionContext = React.createContext<string[]>([]);

/** Selected row ids of the enclosing `DataTable` (read inside `toolbar`). */
export function useTableSelectionIds(): string[] {
  return React.useContext(SelectionContext);
}

export function DataTable<TData, TValue>({
  columns,
  data,
  total,
  page = 1,
  pageSize = 25,
  loading,
  manualSorting,
  sort,
  onSortChange,
  onPageChange,
  onRowClick,
  enableRowSelection,
  rowId,
  emptyState,
  toolbar,
  onSelectionChange,
  className,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});

  const getRowId = React.useCallback(
    (row: TData, index: number) => {
      if (rowId) return rowId(row);
      const withId = row as { id?: unknown };
      return typeof withId?.id === "string" ? withId.id : String(index);
    },
    [rowId]
  );

  const allIds = React.useMemo(() => data.map((row, i) => getRowId(row, i)), [data, getRowId]);
  const allSelected = allIds.length > 0 && allIds.every((id) => rowSelection[id]);

  const toggleAll = React.useCallback(() => {
    setRowSelection(allSelected ? {} : Object.fromEntries(allIds.map((id) => [id, true])));
  }, [allSelected, allIds]);

  const allColumns = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableRowSelection) return columns;
    const selectionColumn: ColumnDef<TData, TValue> = {
      id: "select",
      enableSorting: false,
      enableHiding: false,
      header: () => (
        <Checkbox
          checked={allSelected}
          onCheckedChange={toggleAll}
          aria-label="Select all rows on this page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={!!rowSelection[row.id]}
          onCheckedChange={(value) =>
            setRowSelection((prev) => ({ ...prev, [row.id]: value === true }))
          }
          aria-label={`Select row ${row.id}`}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    };
    return [selectionColumn, ...columns];
  }, [columns, enableRowSelection, allSelected, toggleAll, rowSelection]);

  const internalSort: SortingState = React.useMemo(() => {
    if (manualSorting) return sort ? [{ id: sort.id, desc: sort.desc }] : [];
    return sorting;
  }, [manualSorting, sort, sorting]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting: internalSort, rowSelection, columnVisibility },
    enableRowSelection,
    getRowId,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(internalSort) : updater;
      if (manualSorting) onSortChange?.(next[0] ?? null);
      else setSorting(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: manualSorting ?? false,
  });

  React.useEffect(() => setRowSelection({}), [data]);

  const selectedIds = React.useMemo(
    () => Object.entries(rowSelection).filter(([, v]) => v).map(([k]) => k),
    [rowSelection]
  );

  React.useEffect(() => {
    onSelectionChange?.(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds.join(",")]);

  const pageCount = total ? Math.max(1, Math.ceil(total / pageSize)) : table.getPageCount();
  const startRow = total ? (page - 1) * pageSize + 1 : data.length ? 1 : 0;
  const endRow = total ? Math.min(page * pageSize, total) : data.length;

  const headerCells = table.getHeaderGroups().map((headerGroup) => (
    <TableRow key={headerGroup.id} className="hover:bg-transparent">
      {headerGroup.headers.map((header) => {
        const canSort = header.column.getCanSort();
        const sorted = header.column.getIsSorted();
        return (
          <TableHead key={header.id} className="whitespace-nowrap">
            {header.isPlaceholder ? null : canSort ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                onClick={() => header.column.toggleSorting(sorted === "asc")}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {sorted === "asc" ? (
                  <ArrowUp className="h-3 w-3" />
                ) : sorted === "desc" ? (
                  <ArrowDown className="h-3 w-3" />
                ) : (
                  <ArrowUpDown className="h-3 w-3 opacity-40" />
                )}
              </button>
            ) : (
              flexRender(header.column.columnDef.header, header.getContext())
            )}
          </TableHead>
        );
      })}
    </TableRow>
  ));

  return (
    <div className={cn("space-y-2", className)}>
      {(toolbar || selectedIds.length > 0) && (
        <SelectionContext.Provider value={selectedIds}>
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
        </SelectionContext.Provider>
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>{headerCells}</TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="p-0">
                  <TableSkeleton rows={6} cols={Math.min(allColumns.length, 6)} />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row: Row<TData>) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(onRowClick && "cursor-pointer")}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a,button,input,label")) {
                          e.stopPropagation();
                        }
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={allColumns.length} className="h-40 text-center">
                  {emptyState ?? (
                    <div className="mx-auto max-w-sm py-6">
                      <p className="text-sm font-medium">No records found</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Adjust your filters or create the first record.
                      </p>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {total
            ? `${startRow.toLocaleString()}–${endRow.toLocaleString()} of ${total.toLocaleString()} records`
            : `${data.length} record${data.length === 1 ? "" : "s"}`}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange?.(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= pageCount || loading}
              onClick={() => onPageChange?.(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
