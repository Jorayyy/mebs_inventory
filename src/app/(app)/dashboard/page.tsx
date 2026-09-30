import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileBarChart2 } from "lucide-react";
import { requireUser, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { getDashboardData } from "@/actions/dashboard";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { DashboardStatCards } from "@/components/dashboard/stat-cards";
import { CategoryBarChart, DonutChart, TrendChart } from "@/components/dashboard/charts";
import {
  AttentionWidget,
  LowStockWidget,
  PendingApprovalsWidget,
  RecentActivityWidget,
  SiteSummaryTable,
  WarrantyWidget,
} from "@/components/dashboard/widgets";
import { ASSET_STATUS } from "@/lib/constants";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  if (!can(user, PERMISSIONS.DASHBOARD_VIEW)) redirect("/my");
  const data = await getDashboardData();

  const statusChart = data.assetsByStatus.map((point) => ({
    ...point,
    label: point.key ? ASSET_STATUS[point.key as keyof typeof ASSET_STATUS]?.label ?? point.label : point.label,
  }));

  const chartEmpty = <EmptyState title="No data yet" description="Figures appear once records exist." />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Dashboard"
        description={`Fleet and stock overview for ${data.siteSummary.length} site${data.siteSummary.length === 1 ? "" : "s"} · refreshed ${formatRelative(data.generatedAt)}.`}
        actions={
          <Button size="sm" asChild>
            <Link href="/reports">
              <FileBarChart2 /> Reports
            </Link>
          </Button>
        }
      />

      <DashboardStatCards
        stats={data.stats}
        visibility={{
          transfers: can(user, PERMISSIONS.TRANSFERS_VIEW),
          maintenance: can(user, PERMISSIONS.MAINTENANCE_VIEW),
          inventory: can(user, PERMISSIONS.INVENTORY_VIEW),
          assignments: can(user, PERMISSIONS.ASSIGNMENTS_VIEW),
        }}
      />

      <AttentionWidget items={data.attentionItems} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Assets by status" description="How the fleet is currently allocated.">
          {statusChart.length ? <DonutChart data={statusChart} /> : chartEmpty}
        </SectionCard>
        <SectionCard title="Assets by site" description="Distribution of assets across locations.">
          {data.assetsBySite.length ? <CategoryBarChart data={data.assetsBySite} /> : chartEmpty}
        </SectionCard>
        <SectionCard title="Top categories" description="Most populated asset categories.">
          {data.topCategories.length ? (
            <CategoryBarChart data={data.topCategories} orientation="horizontal" />
          ) : (
            chartEmpty
          )}
        </SectionCard>
        <SectionCard title="Stock value by category" description="Consumable value on hand per category.">
          {data.stockValueByCategory.length ? (
            <CategoryBarChart data={data.stockValueByCategory} orientation="horizontal" currency />
          ) : (
            chartEmpty
          )}
        </SectionCard>
        <SectionCard title="Monthly asset additions" description="Assets registered over the last 12 months.">
          {data.monthlyAdditions.some((point) => point.value > 0) ? (
            <TrendChart data={data.monthlyAdditions} />
          ) : (
            chartEmpty
          )}
        </SectionCard>
        <SectionCard title="Transfer volume" description="Transfers requested over the last 12 months.">
          {data.transferVolume.some((point) => point.value > 0) ? (
            <TrendChart data={data.transferVolume} />
          ) : (
            chartEmpty
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {can(user, PERMISSIONS.ASSETS_VIEW) && <WarrantyWidget items={data.warrantyExpiring} />}
        {can(user, PERMISSIONS.INVENTORY_VIEW) && <LowStockWidget items={data.lowStockItems} />}
        {can(user, PERMISSIONS.TRANSFERS_VIEW) && (
          <PendingApprovalsWidget items={data.pendingApprovals} />
        )}
        {can(user, PERMISSIONS.AUDIT_VIEW) && <RecentActivityWidget items={data.recentActivity} />}
      </div>

      <SiteSummaryTable rows={data.siteSummary} />
    </div>
  );
}
