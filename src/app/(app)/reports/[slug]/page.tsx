import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
import { requirePermissionPage, can, isGlobal } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState, StatCard } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getReport, buildScope } from "@/components/reports/registry";
import { ReportTable } from "@/components/reports/report-table";
import { ReportFilters, type ResolvedFilter } from "@/components/reports/report-filters";
import { flattenSearchParams, parseReportParams } from "@/lib/validations/report";
import {
  ASSET_STATUS,
  ASSIGNMENT_STATUS,
  MAINTENANCE_STATUS,
  STOCK_TX_LABELS,
  TRANSFER_STATUS,
} from "@/lib/constants";
import type { StatusOptionsKey } from "@/components/reports/types";

type PageProps = {
  params: { slug: string };
  searchParams: Record<string, string | string[] | undefined>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const report = getReport(params.slug);
  return { title: report ? `${report.title} · Reports` : "Report" };
}

const STATUS_OPTIONS: Record<StatusOptionsKey, { value: string; label: string }[]> = {
  ASSET_STATUS: Object.entries(ASSET_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
  ASSIGNMENT_STATUS: Object.entries(ASSIGNMENT_STATUS).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
  TRANSFER_STATUS: Object.entries(TRANSFER_STATUS).map(([value, meta]) => ({ value, label: meta.label })),
  MAINTENANCE_STATUS: Object.entries(MAINTENANCE_STATUS).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
  STOCK_TX: Object.entries(STOCK_TX_LABELS).map(([value, label]) => ({ value, label })),
};

export default async function ReportPage({ params, searchParams }: PageProps) {
  const user = await requirePermissionPage("/my", PERMISSIONS.REPORTS_VIEW);
  const report = getReport(params.slug);
  if (!report) notFound();

  if (!can(user, report.permission)) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={report.title}
          description={report.description}
          breadcrumb={<Link href="/reports">← All reports</Link>}
        />
        <EmptyState
          title="You do not have permission to view this report"
          description="This report requires additional access. Ask an administrator to grant it."
          action={
            <Button size="sm" variant="outline" asChild>
              <Link href="/reports">Back to reports</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const query = parseReportParams(searchParams);
  const scope = buildScope(user, query);
  const result = await report.run(query, scope);

  const needsSites = report.params.some((param) => param.type === "site");
  const needsCategories = report.params.some((param) => param.type === "category");
  const sites = needsSites
    ? await prisma.site.findMany({
        where: { deletedAt: null, ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const categories = needsCategories
    ? await prisma.category.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      })
    : [];

  const filters: ResolvedFilter[] = report.params.map((param) => ({
    key: param.key,
    label: param.label,
    type: param.type,
    options:
      param.type === "site"
        ? sites.map((site) => ({ value: site.id, label: site.name }))
        : param.type === "category"
          ? categories.map((category) => ({ value: category.id, label: category.name }))
          : param.optionsKey
            ? STATUS_OPTIONS[param.optionsKey]
            : undefined,
  }));

  const values = flattenSearchParams(searchParams);
  const exportParams = new URLSearchParams(values);
  for (const key of ["page", "pageSize", "sort", "dir"]) exportParams.delete(key);
  const exportHref = `/api/export/report?slug=${encodeURIComponent(report.slug)}${
    exportParams.toString() ? `&${exportParams.toString()}` : ""
  }`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={report.title}
        description={report.description}
        breadcrumb={<Link href="/reports">← All reports</Link>}
        actions={
          can(user, PERMISSIONS.REPORTS_EXPORT) ? (
            <Button variant="outline" size="sm" asChild>
              <a href={exportHref}>
                <Upload /> Export CSV
              </a>
            </Button>
          ) : undefined
        }
      />

      <ReportFilters filters={filters} values={values} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {result.summary.map((metric) => (
          <StatCard key={metric.label} label={metric.label} value={metric.value} hint={metric.hint} />
        ))}
      </div>

      <ReportTable
        slug={report.slug}
        columns={report.columns}
        rows={result.rows}
        total={result.total}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort}
        dir={query.dir}
        serverPaging={report.serverPaging}
      />
    </div>
  );
}
