"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterSelect, SearchInput, type FilterOption } from "@/components/shared/filters";
import { buildQuery } from "@/lib/query";

export type ResolvedFilter = {
  key: string;
  label: string;
  type: "site" | "date" | "text" | "status" | "category" | "number";
  options?: FilterOption[];
};

export function ParamDateInput({
  param,
  label,
  defaultValue,
}: {
  param: string;
  label: string;
  defaultValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => setValue(defaultValue), [defaultValue]);

  const push = (next: string) => {
    router.replace(
      `${pathname}${buildQuery(Object.fromEntries(searchParams), { [param]: next || undefined, page: undefined })}`,
      { scroll: false }
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={`filter-${param}`} className="whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={`filter-${param}`}
        type="date"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (next === "" || /^\d{4}-\d{2}-\d{2}$/.test(next)) push(next);
        }}
        className="h-8 w-[148px] text-xs"
      />
    </div>
  );
}

export function ParamNumberInput({
  param,
  label,
  defaultValue,
}: {
  param: string;
  label: string;
  defaultValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => setValue(defaultValue), [defaultValue]);

  const push = (next: string) => {
    router.replace(
      `${pathname}${buildQuery(Object.fromEntries(searchParams), { [param]: next || undefined, page: undefined })}`,
      { scroll: false }
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={`filter-${param}`} className="whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </label>
      <Input
        id={`filter-${param}`}
        type="number"
        min={1}
        max={3650}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (next === "" || Number(next) > 0) push(next);
        }}
        className="h-8 w-[92px] text-xs"
      />
    </div>
  );
}

/** URL-synced filter row driven by a report's declared params. */
export function ReportFilters({
  filters,
  values,
}: {
  filters: ResolvedFilter[];
  values: Record<string, string>;
}) {
  if (filters.length === 0) return null;

  return (
    <FilterBar>
      {filters.map((filter) => {
        switch (filter.type) {
          case "site":
            return (
              <FilterSelect
                key={filter.key}
                param="site"
                label={filter.label}
                options={filter.options ?? []}
                allLabel="All sites"
                defaultValue={values.site}
              />
            );
          case "category":
            return (
              <FilterSelect
                key={filter.key}
                param="categoryId"
                label={filter.label}
                options={filter.options ?? []}
                allLabel="All categories"
                defaultValue={values.categoryId}
              />
            );
          case "status":
            return (
              <FilterSelect
                key={filter.key}
                param="status"
                label={filter.label}
                options={filter.options ?? []}
                allLabel={`All ${filter.label.toLowerCase()}`}
                defaultValue={values.status}
              />
            );
          case "text":
            return (
              <SearchInput key={filter.key} param="q" placeholder={filter.label} defaultValue={values.q ?? ""} />
            );
          case "date":
            return (
              <ParamDateInput
                key={filter.key}
                param={filter.key}
                label={filter.label}
                defaultValue={values[filter.key] ?? ""}
              />
            );
          case "number":
            return (
              <ParamNumberInput
                key={filter.key}
                param={filter.key}
                label={filter.label}
                defaultValue={values[filter.key] ?? ""}
              />
            );
          default:
            return null;
        }
      })}
    </FilterBar>
  );
}
