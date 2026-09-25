import type { Metadata } from "next";
import Link from "next/link";
import { FileBarChart2 } from "lucide-react";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { REPORTS } from "@/components/reports/registry";
import { getLastRunMetadata } from "@/actions/reports";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.REPORTS_VIEW);
  const visible = REPORTS.filter((report) => can(user, report.permission));
  const lastRuns = await getLastRunMetadata(visible.map((report) => report.slug));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports"
        description={`${visible.length} report${visible.length === 1 ? "" : "s"} available. Every report is scoped to the sites you can access and exports as CSV.`}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<FileBarChart2 className="h-8 w-8" />}
          title="No reports available"
          description="Your role does not include any report permissions yet."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((report) => {
            const last = lastRuns[report.slug];
            return (
              <Link
                key={report.slug}
                href={`/reports/${report.slug}`}
                className="group flex flex-col rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <FileBarChart2 className="h-4 w-4 text-muted-foreground/70 group-hover:text-primary" />
                  <Badge variant={last ? "info" : "muted"}>
                    {last ? "Exported" : "Not run"}
                  </Badge>
                </div>
                <h2 className="mt-2 text-sm font-semibold group-hover:text-primary">{report.title}</h2>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
                  {report.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {report.params.map((param) => (
                    <Badge key={param.key} variant="outline" className="font-normal">
                      {param.label}
                    </Badge>
                  ))}
                </div>
                <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
                  {last
                    ? `Last export ${formatRelative(last.at)}${last.by ? ` by ${last.by}` : ""}${
                        last.count !== null ? ` · ${last.count.toLocaleString()} rows` : ""
                      }`
                    : "Never exported"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
