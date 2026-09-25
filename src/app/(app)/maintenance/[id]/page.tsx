import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Laptop } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess, can, requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader, SectionCard, DetailGrid, DetailItem, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { MaintenanceStatusBadge, AssetStatusBadge, ConditionBadge } from "@/components/shared/status-badge";
import { PriorityBadge } from "@/components/maintenance/maintenance-columns";
import { MaintenanceStatusToolbar } from "@/components/maintenance/maintenance-status-toolbar";
import { formatCurrency, formatDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Maintenance ticket" };

const CLOSED_STATUSES = ["COMPLETED", "RETURNED_TO_SERVICE", "CANCELLED"];
const DAY = 86_400_000;

export default async function MaintenanceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.MAINTENANCE_VIEW);

  const record = await prisma.maintenanceRecord.findUnique({
    where: { id: params.id },
    include: {
      asset: {
        select: {
          id: true,
          assetTag: true,
          name: true,
          serialNumber: true,
          status: true,
          condition: true,
          siteId: true,
          site: { select: { name: true, code: true } },
          category: { select: { name: true } },
        },
      },
      reportedBy: { select: { name: true } },
      technician: { select: { name: true } },
      vendor: { select: { name: true } },
    },
  });

  if (!record) notFound();
  assertSiteAccess(user, record.asset.siteId);

  const [activity] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: "MaintenanceRecord", entityId: record.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, action: true, description: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);

  const closed = CLOSED_STATUSES.includes(record.status);
  const age = Date.now() - record.reportedAt.getTime();
  const priority = closed
    ? "CLOSED"
    : age >= 7 * DAY
      ? "URGENT"
      : age >= 3 * DAY
        ? "DUE"
        : "NEW";

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/maintenance" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Maintenance
          </Link>
        }
        title={record.referenceNo}
        description={`${record.asset.assetTag} · ${record.asset.name}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/assets/${record.asset.id}`}>
              <Laptop /> View asset
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <MaintenanceStatusBadge status={record.status} />
        <PriorityBadge priority={priority} />
        <span className="text-xs text-muted-foreground">
          Reported {formatDate(record.reportedAt)} · {formatRelative(record.reportedAt)}
        </span>
        <div className="ml-auto">
          <MaintenanceStatusToolbar
            record={{
              id: record.id,
              referenceNo: record.referenceNo,
              status: record.status,
              issue: record.issue,
              diagnosis: record.diagnosis,
              repairAction: record.repairAction,
              partsUsed: record.partsUsed,
              cost: Number(record.cost),
              notes: record.notes,
              assetTag: record.asset.assetTag,
            }}
            canManage={can(user, PERMISSIONS.MAINTENANCE_MANAGE)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Issue" description="Reported by staff or detected during a check.">
            <p className="whitespace-pre-wrap text-sm">{record.issue}</p>
          </SectionCard>

          <SectionCard title="Service record">
            <DetailGrid>
              <DetailItem label="Status">{record.status.replace(/_/g, " ").toLowerCase()}</DetailItem>
              <DetailItem label="Reported by">{record.reportedBy.name}</DetailItem>
              <DetailItem label="Technician">{record.technician?.name ?? "Unassigned"}</DetailItem>
              <DetailItem label="Vendor">{record.vendor?.name ?? "—"}</DetailItem>
              <DetailItem label="Started">{formatDate(record.startedAt, true)}</DetailItem>
              <DetailItem label="Completed">{formatDate(record.completedAt, true)}</DetailItem>
              <DetailItem label="Returned to service">{formatDate(record.returnedAt, true)}</DetailItem>
              <DetailItem label="Cost">{formatCurrency(Number(record.cost))}</DetailItem>
            </DetailGrid>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Diagnosis</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{record.diagnosis || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Repair action</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{record.repairAction || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Parts used</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{record.partsUsed || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{record.notes || "—"}</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Activity" description="Audit entries recorded against this ticket.">
            {activity.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="space-y-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{entry.description ?? entry.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.user?.name ?? "System"} · {entry.action.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground" title={formatRelative(entry.createdAt)}>
                      {formatDate(entry.createdAt, true)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Asset">
            <div className="space-y-3">
              <div>
                <Link href={`/assets/${record.asset.id}`} className="font-medium text-primary hover:underline">
                  {record.asset.assetTag}
                </Link>
                <p className="text-sm text-muted-foreground">{record.asset.name}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <AssetStatusBadge status={record.asset.status} />
                <ConditionBadge condition={record.asset.condition} />
              </div>
              <DetailGrid className="grid-cols-1">
                <DetailItem label="Serial">{record.asset.serialNumber ?? "—"}</DetailItem>
                <DetailItem label="Category">{record.asset.category?.name ?? "—"}</DetailItem>
                <DetailItem label="Site">{record.asset.site.name}</DetailItem>
              </DetailGrid>
            </div>
          </SectionCard>

          <SectionCard title="SLA" description="Priority is derived from ticket age, not stored.">
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 border-b pb-2">
                <dt className="text-muted-foreground">Open for</dt>
                <dd className="tabular-nums">{Math.floor(age / DAY)} day(s)</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b pb-2">
                <dt className="text-muted-foreground">Bucket</dt>
                <dd>
                  <PriorityBadge priority={priority} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Reported</dt>
                <dd>{formatDate(record.reportedAt)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
