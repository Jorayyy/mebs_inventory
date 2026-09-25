"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page-header";
import { ScrollText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIT_ACTION_BADGES } from "./audit-constants";
import { buildQuery } from "@/lib/query";
import { cn, formatDate } from "@/lib/utils";
import type { AuditLogRow } from "@/actions/audit";

function JsonBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {value ? (
        <pre className="mt-1 max-h-56 overflow-auto rounded-md border bg-background p-2 font-mono text-[11px] leading-relaxed">
          {value}
        </pre>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">—</p>
      )}
    </div>
  );
}

export function AuditTable({
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
}: {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [openId, setOpenId] = React.useState<string | null>(null);

  const navigate = (patch: Record<string, string | undefined>) => {
    router.replace(`${pathname}${buildQuery(Object.fromEntries(searchParams), patch)}`, { scroll: false });
  };

  const toggleSort = (field: string) => {
    if (sort === field) navigate({ dir: dir === "asc" ? "desc" : "asc", page: undefined });
    else navigate({ sort: field, dir: "desc", page: undefined });
  };

  const sortIcon = (field: string) => {
    if (sort !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ScrollText className="h-8 w-8" />}
        title="No audit entries match your filters"
        description="Widen the date range or clear a filter to see more activity."
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead>
                <button
                  type="button"
                  onClick={() => toggleSort("createdAt")}
                  className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground"
                >
                  Time {sortIcon("createdAt")}
                </button>
              </TableHead>
              <TableHead>Action</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Site / IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const badge = AUDIT_ACTION_BADGES[row.action] ?? {
                label: row.action,
                tone: "muted" as const,
              };
              const isOpen = openId === row.id;
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    className={cn("cursor-pointer", isOpen && "bg-accent/40 hover:bg-accent/50")}
                    onClick={() => setOpenId(isOpen ? null : row.id)}
                  >
                    <TableCell className="pr-0">
                      <Button variant="ghost" size="icon-sm" aria-label="Toggle details">
                        <ChevronDown
                          className={cn("h-3.5 w-3.5 transition-transform", isOpen ? "rotate-180" : "")}
                        />
                      </Button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums">
                      {formatDate(row.createdAt, true)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={toneToVariant(badge.tone)}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[160px] truncate text-sm">{row.user?.name ?? "System"}</p>
                      <p className="max-w-[160px] truncate text-[11px] text-muted-foreground">
                        {row.user?.email ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{row.entityType}</p>
                      <p className="max-w-[140px] truncate font-mono text-[11px] text-muted-foreground">
                        {row.entityId ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[320px] truncate text-xs">{row.description ?? "—"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs">{row.siteName ?? "Global"}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{row.ip ?? "—"}</p>
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7} className="bg-muted/30">
                        <div className="space-y-3 p-1">
                          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Entity ID
                              </dt>
                              <dd className="mt-0.5 break-all font-mono text-xs">{row.entityId ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Request ID
                              </dt>
                              <dd className="mt-0.5 break-all font-mono text-xs">{row.requestId ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                IP address
                              </dt>
                              <dd className="mt-0.5 break-all font-mono text-xs">{row.ip ?? "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                User agent
                              </dt>
                              <dd className="mt-0.5 break-all text-xs">{row.userAgent ?? "—"}</dd>
                            </div>
                          </dl>
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                            <JsonBlock label="Previous value" value={row.previousJson} />
                            <JsonBlock label="New value" value={row.newJson} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {startRow.toLocaleString()}–{endRow.toLocaleString()} of {total.toLocaleString()} records
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => navigate({ page: String(page - 1) })}
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
              disabled={page >= pageCount}
              onClick={() => navigate({ page: String(page + 1) })}
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
