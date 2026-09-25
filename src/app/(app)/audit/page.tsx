import type { Metadata } from "next";
import Link from "next/link";
import { Upload } from "lucide-react";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { getAuditFilterOptions, queryAuditLogs } from "@/actions/audit";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { ParamDateInput } from "@/components/reports/report-filters";
import { AuditTable } from "@/components/audit/audit-table";
import { AUDIT_ACTION_OPTIONS } from "@/components/audit/audit-constants";
import { flattenSearchParams, parseAuditQuery } from "@/lib/validations/report";

export const metadata: Metadata = { title: "Audit Trail" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requirePermissionPage("/my", PERMISSIONS.AUDIT_VIEW);
  const query = parseAuditQuery(searchParams);

  const [result, options] = await Promise.all([
    queryAuditLogs({
      filters: {
        action: query.action,
        entityType: query.entityType,
        userId: query.userId,
        site: query.site,
        from: query.from,
        to: query.to,
        q: query.q,
      },
      page: query.page,
      pageSize: query.pageSize,
      sort: query.sort,
      dir: query.dir,
    }),
    getAuditFilterOptions(),
  ]);

  const values = flattenSearchParams(searchParams);
  const exportParams = new URLSearchParams(values);
  for (const key of ["page", "pageSize", "sort", "dir"]) exportParams.delete(key);
  const exportHref = `/api/export/audit${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Audit trail"
        description={`${result.total.toLocaleString()} recorded event${result.total === 1 ? "" : "s"}. Entries are immutable and credentials are never rendered.`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Upload /> Export CSV
            </a>
          </Button>
        }
      />

      <FilterBar>
        <FilterSelect
          param="action"
          label="Action"
          options={AUDIT_ACTION_OPTIONS}
          allLabel="All actions"
          defaultValue={query.action}
        />
        <FilterSelect
          param="entityType"
          label="Entity"
          options={options.entityTypes.map((entity) => ({ value: entity, label: entity }))}
          allLabel="All entities"
          defaultValue={query.entityType}
        />
        <FilterSelect
          param="userId"
          label="User"
          options={options.users.map((user) => ({ value: user.id, label: user.name }))}
          allLabel="All users"
          defaultValue={query.userId}
        />
        <FilterSelect
          param="site"
          label="Site"
          options={options.sites.map((site) => ({ value: site.id, label: site.name }))}
          allLabel="All sites"
          defaultValue={query.site}
        />
        <ParamDateInput param="from" label="From" defaultValue={query.from ?? ""} />
        <ParamDateInput param="to" label="To" defaultValue={query.to ?? ""} />
        <SearchInput placeholder="Description…" defaultValue={query.q ?? ""} />
      </FilterBar>

      <AuditTable
        rows={result.rows}
        total={result.total}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort}
        dir={query.dir}
      />

      <p className="text-[11px] text-muted-foreground">
        Looking for report figures? <Link href="/reports/audit-summary" className="text-primary hover:underline">Audit summary report</Link>.
      </p>
    </div>
  );
}
