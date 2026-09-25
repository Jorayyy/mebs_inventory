"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Search,
  X,
  Laptop,
  User,
  Boxes,
  ArrowLeftRight,
  Truck,
  Loader2,
  QrCode,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/page-header";
import { globalSearch, type SearchHit } from "@/actions/search";

const TYPE_META: Record<SearchHit["type"], { label: string; icon: React.ReactNode }> = {
  asset: { label: "Assets", icon: <Laptop className="h-4 w-4" /> },
  employee: { label: "People", icon: <User className="h-4 w-4" /> },
  stock: { label: "Stock", icon: <Boxes className="h-4 w-4" /> },
  transfer: { label: "Transfers", icon: <ArrowLeftRight className="h-4 w-4" /> },
  supplier: { label: "Suppliers", icon: <Truck className="h-4 w-4" /> },
  page: { label: "Pages", icon: <QrCode className="h-4 w-4" /> },
};

const FILTERS: { value: "all" | SearchHit["type"]; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "asset", label: "Assets" },
  { value: "employee", label: "People" },
  { value: "stock", label: "Stock" },
  { value: "transfer", label: "Transfers" },
  { value: "supplier", label: "Suppliers" },
];

export function SearchView({
  initialQuery = "",
  initialResults = [],
}: {
  initialQuery?: string;
  initialResults?: SearchHit[];
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState<SearchHit[]>(initialResults);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | SearchHit["type"]>("all");

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  React.useEffect(() => {
    const value = query.trim();
    if (value === initialQuery.trim()) return;

    const timer = setTimeout(async () => {
      const params = new URLSearchParams(window.location.search);
      if (value) params.set("q", value);
      else params.delete("q");
      window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);

      if (value.length < 2) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        setResults(await globalSearch(value));
      } catch {
        toast.error("Search failed. Please try again.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const visible = filter === "all" ? results : results.filter((hit) => hit.type === filter);
  const grouped = visible.reduce<Record<string, SearchHit[]>>((acc, hit) => {
    (acc[hit.type] ??= []).push(hit);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search asset tags, serial numbers, people, stock, transfers…"
          className="h-11 pl-9 pr-9 text-base"
          aria-label="Global search"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setFilter(entry.value)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
              filter === entry.value
                ? "border-primary bg-primary/10 text-foreground"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            {entry.label}
          </button>
        ))}
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
          </span>
        )}
      </div>

      {query.trim().length < 2 ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title="Start typing to search"
          description="At least two characters. Try an asset tag (AST-0001), a serial number, a name, an SKU or a transfer number."
        />
      ) : visible.length === 0 && !loading ? (
        <EmptyState
          icon={<Search className="h-8 w-8" />}
          title={`No matches for “${query.trim()}”`}
          description="Check the spelling, drop a prefix, or try the last four characters of a tag or serial number."
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([type, hits]) => (
            <section key={type}>
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {TYPE_META[type as SearchHit["type"]]?.icon}
                {TYPE_META[type as SearchHit["type"]]?.label ?? type}
                <Badge variant="outline">{hits.length}</Badge>
              </h2>
              <ul className="divide-y rounded-lg border bg-card">
                {hits.map((hit) => (
                  <li key={`${hit.type}-${hit.id}`}>
                    <Link
                      href={hit.href}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {TYPE_META[hit.type]?.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{hit.title}</span>
                        {hit.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {hit.subtitle}
                          </span>
                        )}
                      </span>
                      {hit.badge && (
                        <Badge variant="outline" className="shrink-0 font-mono">
                          {hit.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Results respect your site scope — items outside your sites are never returned.</span>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/scan">
            <QrCode /> Open scanner
          </Link>
        </Button>
      </div>
    </div>
  );
}
