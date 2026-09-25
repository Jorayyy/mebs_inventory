import { Activity, ArrowLeftRight, Boxes, FileBarChart2, Laptop, PackageOpen, UserCheck, Wrench } from "lucide-react";
import { StatCard } from "@/components/shared/page-header";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DashboardStats } from "@/actions/dashboard";

export type StatVisibility = {
  transfers?: boolean;
  maintenance?: boolean;
  inventory?: boolean;
  assignments?: boolean;
};

export function DashboardStatCards({
  stats,
  visibility,
}: {
  stats: DashboardStats;
  visibility: StatVisibility;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      <StatCard
        label="Total assets"
        value={formatNumber(stats.totalAssets)}
        hint="Registered, not disposed"
        icon={<Laptop className="h-4 w-4" />}
        href="/assets"
      />
      <StatCard
        label="Acquisition value"
        value={formatCurrency(stats.acquisitionValue)}
        hint="Sum of purchase prices"
        icon={<FileBarChart2 className="h-4 w-4" />}
        href="/reports/asset-register"
      />
      <StatCard
        label="Assigned"
        value={formatNumber(stats.assignedAssets)}
        hint={`${formatNumber(stats.availableAssets)} available`}
        tone="info"
        icon={<UserCheck className="h-4 w-4" />}
        href="/assignments"
      />
      <StatCard
        label="Available"
        value={formatNumber(stats.availableAssets)}
        hint="Ready to allocate"
        tone="success"
        icon={<PackageOpen className="h-4 w-4" />}
        href="/assets?status=AVAILABLE"
      />
      {visibility.transfers && (
        <StatCard
          label="Open transfers"
          value={formatNumber(stats.openTransfers)}
          hint="Awaiting approval or in transit"
          tone="warning"
          icon={<ArrowLeftRight className="h-4 w-4" />}
          href="/transfers?status=PENDING_APPROVAL"
        />
      )}
      {visibility.maintenance && (
        <StatCard
          label="Open maintenance"
          value={formatNumber(stats.openMaintenance)}
          hint="Tickets not yet closed"
          tone="warning"
          icon={<Wrench className="h-4 w-4" />}
          href="/maintenance"
        />
      )}
      {visibility.inventory && (
        <StatCard
          label="Low stock items"
          value={formatNumber(stats.lowStockItems)}
          hint="At or below reorder level"
          tone="danger"
          icon={<Boxes className="h-4 w-4" />}
          href="/inventory"
        />
      )}
      {visibility.assignments && (
        <StatCard
          label="Overdue returns"
          value={formatNumber(stats.overdueReturns)}
          hint="Past expected return date"
          tone="danger"
          icon={<Activity className="h-4 w-4" />}
          href="/assignments?status=ACTIVE"
        />
      )}
    </div>
  );
}
