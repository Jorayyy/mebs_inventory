"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DataTable, type DataTableProps } from "@/components/shared/data-table";
import { buildQuery } from "@/lib/query";

type SortState = { id: string; desc: boolean } | null;

/**
 * `DataTable` whose pagination and sorting are reflected in the URL, so the
 * server-rendered page stays the single source of truth for list state.
 */
export function UrlDataTable<TData, TValue>({
  page,
  pageSize,
  sort,
  dir,
  ...rest
}: Omit<DataTableProps<TData, TValue>, "page" | "pageSize" | "manualSorting" | "sort" | "onSortChange" | "onPageChange"> & {
  page: number;
  pageSize: number;
  sort?: string;
  dir?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const patch = (values: Record<string, string | undefined>) => {
    router.replace(`${pathname}${buildQuery(Object.fromEntries(searchParams), values)}`, {
      scroll: false,
    });
  };

  const sortState: SortState = sort ? { id: sort, desc: dir === "desc" } : null;

  return (
    <DataTable<TData, TValue>
      {...rest}
      page={page}
      pageSize={pageSize}
      manualSorting
      sort={sortState}
      onSortChange={(next: SortState) =>
        patch(
          next
            ? { sort: next.id, dir: next.desc ? "desc" : "asc", page: undefined }
            : { sort: undefined, dir: undefined, page: undefined }
        )
      }
      onPageChange={(next) => patch({ page: next <= 1 ? undefined : String(next) })}
    />
  );
}
