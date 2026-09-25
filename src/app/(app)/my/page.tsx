import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Box, PackageCheck, Undo2, Wrench, Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { formatDate, formatRelative, daysUntil } from "@/lib/utils";
import {
  PageHeader,
  EmptyState,
  StatCard,
  SectionCard,
} from "@/components/shared/page-header";
import { AssignmentStatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AssignmentActions } from "@/components/my/assignment-actions";

export const metadata: Metadata = { title: "My assets" };

const OPEN_REPORT_STATUSES = ["REPORTED", "DIAGNOSED", "IN_REPAIR", "AWAITING_PARTS"] as const;

export default async function MyPortalPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.SELF_SERVICE_VIEW);
  const canRequest = can(user, PERMISSIONS.SELF_SERVICE_REQUEST);

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    include: {
      site: { select: { name: true, code: true } },
      department: { select: { name: true } },
      team: { select: { name: true } },
    },
  });

  if (!employee) {
    return (
      <div className="space-y-4">
        <PageHeader title="My assets" description={`Signed in as ${user.email}`} />
        <EmptyState
          icon={<Box className="h-8 w-8" />}
          title="No employee profile is linked to your account"
          description="Ask an administrator to link your account to an employee record — assignments, returns and repairs all hang off it."
        />
      </div>
    );
  }

  const [assignments, openReports, notifications, totalAssignments] = await Promise.all([
    prisma.assetAssignment.findMany({
      where: { employeeId: employee.id, status: { in: ["ACTIVE", "RETURN_PENDING"] } },
      include: {
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            serialNumber: true,
            condition: true,
            status: true,
            category: { select: { name: true } },
            site: { select: { name: true } },
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.maintenanceRecord.count({
      where: { reportedById: user.id, status: { in: [...OPEN_REPORT_STATUSES] } },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.assetAssignment.count({ where: { employeeId: employee.id } }),
  ]);

  const awaitingAck = assignments.filter(
    (entry) => entry.status === "ACTIVE" && !entry.acknowledgedAt
  ).length;
  const returnPending = assignments.filter((entry) => entry.status === "RETURN_PENDING").length;
  const fullName = `${employee.firstName} ${employee.lastName}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`My assets, ${fullName.split(" ")[0] ?? ""}`}
        description={`${employee.employeeNo} · ${employee.jobTitle ?? "—"} · ${employee.department?.name ?? "—"} · ${employee.site.name}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/my/assignments">
              Assignment history <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Assigned now"
          value={assignments.length}
          hint={`${totalAssignments} total on record`}
          icon={<Box className="h-4 w-4" />}
        />
        <StatCard
          label="Awaiting acknowledgement"
          value={awaitingAck}
          hint="Confirm you received these items"
          tone={awaitingAck > 0 ? "warning" : "default"}
          icon={<PackageCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Return pending"
          value={returnPending}
          hint="Handovers waiting on the team"
          tone={returnPending > 0 ? "info" : "default"}
          icon={<Undo2 className="h-4 w-4" />}
        />
        <StatCard
          label="Open repair reports"
          value={openReports}
          hint="Issues you reported"
          icon={<Wrench className="h-4 w-4" />}
        />
      </div>

      <SectionCard
        title="Currently assigned"
        description="Acknowledge receipt, request a return or report a problem — no visit to the IT desk required."
        actions={
          <span className="text-xs text-muted-foreground">
            {assignments.length} item{assignments.length === 1 ? "" : "s"}
          </span>
        }
      >
        {assignments.length === 0 ? (
          <EmptyState
            icon={<Box className="h-8 w-8" />}
            title="Nothing assigned to you right now"
            description="When the team assigns equipment to you it appears here with an acknowledgement button."
          />
        ) : (
          <ul className="space-y-3">
            {assignments.map((entry) => {
              const due = daysUntil(entry.expectedReturnAt);
              return (
                <li key={entry.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{entry.asset.name}</span>
                        <Badge variant="outline" className="font-mono">
                          {entry.asset.assetTag}
                        </Badge>
                        <AssignmentStatusBadge status={entry.status} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {entry.asset.category?.name ?? "Uncategorised"} · {entry.asset.condition} ·{" "}
                        {entry.asset.site?.name}
                        {entry.asset.serialNumber ? ` · S/N ${entry.asset.serialNumber}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assigned {formatDate(entry.assignedAt)}
                        {entry.acknowledgedAt
                          ? ` · acknowledged ${formatRelative(entry.acknowledgedAt)}`
                          : " · not acknowledged yet"}
                        {entry.expectedReturnAt
                          ? due !== null && due <= 7
                            ? ` · return due in ${due} day${due === 1 ? "" : "s"}`
                            : ` · expected back ${formatDate(entry.expectedReturnAt)}`
                          : ""}
                      </p>
                    </div>
                    <AssignmentActions
                      canRequest={canRequest}
                      assignment={{
                        id: entry.id,
                        status: entry.status,
                        acknowledgedAt: entry.acknowledgedAt,
                        assetId: entry.asset.id,
                        assetTag: entry.asset.assetTag,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Recent notifications">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet — updates about your equipment show up here.
            </p>
          ) : (
            <ul className="space-y-2">
              {notifications.map((notification) => (
                <li key={notification.id} className="flex items-start gap-2 rounded-md border p-2.5">
                  <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {notification.title}
                      {!notification.readAt && (
                        <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                      )}
                    </p>
                    {notification.body && (
                      <p className="truncate text-xs text-muted-foreground">{notification.body}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelative(notification.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Need something else?">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              Returning everything? Open the{" "}
              <Link href="/my/assignments" className="text-primary hover:underline">
                assignment history
              </Link>{" "}
              to see closed handovers and their conditions.
            </li>
            <li>
              Scanning a QR label? Use{" "}
              <Link href="/scan" className="text-primary hover:underline">
                Search &amp; Scan
              </Link>{" "}
              if your role allows it.
            </li>
            <li>
              Something arrived damaged? Report it from the item above — it flags the asset
              immediately and raises a repair ticket.
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}
