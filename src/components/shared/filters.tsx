"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildQuery } from "@/lib/query";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/** URL-synced text search box (debounced). */
export function SearchInput({
  param = "q",
  placeholder = "Search…",
  defaultValue = "",
  className,
  autoFocus,
}: {
  param?: string;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = React.useState(defaultValue);

  React.useEffect(() => setValue(defaultValue), [defaultValue]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchParams.get(param) ?? "";
      if (value === current) return;
      router.replace(`${pathname}${buildQuery(Object.fromEntries(searchParams), { [param]: value || undefined, page: undefined })}`, {
        scroll: false,
      });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-8 pl-8 pr-8 text-sm"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/** URL-synced select filter. `ALL_VALUE` removes the param. */
export function FilterSelect({
  param,
  label,
  options,
  allLabel = "All",
  className,
  defaultValue,
}: {
  param: string;
  label: string;
  options: FilterOption[];
  allLabel?: string;
  className?: string;
  defaultValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? defaultValue ?? "";

  const onChange = (next: string) => {
    router.replace(
      `${pathname}${buildQuery(Object.fromEntries(searchParams), { [param]: next === "ALL" ? undefined : next, page: undefined })}`,
      { scroll: false }
    );
  };

  return (
    <div className={cn("w-[170px]", className)}>
      <Select value={current || "ALL"} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs" aria-label={label}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FilterBar({
  children,
  onReset,
  className,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasFilters = Array.from(searchParams.keys()).some((k) => k !== "page");

  const reset = () => {
    onReset?.();
    router.replace(pathname, { scroll: false });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="hidden items-center gap-1 text-xs font-medium text-muted-foreground sm:flex">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
      </span>
      {children}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-xs">
          <X className="h-3.5 w-3.5" /> Reset
        </Button>
      )}
    </div>
  );
}

export function ActiveFilters({ labels }: { labels: Record<string, string> }) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 text-[11px]">
      {entries.map(([key, label]) => (
        <span key={key} className="rounded border bg-muted px-1.5 py-0.5 text-muted-foreground">
          {label}
        </span>
      ))}
    </div>
  );
}
