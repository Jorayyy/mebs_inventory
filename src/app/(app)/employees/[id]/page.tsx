import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackageCheck, ShieldCheck, UserRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, assertSiteAccess, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmployeeOpenAssignments } from "@/actions/assignments";
import {
  PageHeader,
  SectionCard,
  DetailGrid,
  DetailItem,
  EmptyState,
} from "@/components/shared/page-header";
import { StatusBadge, ConditionBadge, AssignmentStatusBadge } from "@/components/shared/status-badge";
import { EMPLOYMENT_STATUS } from "@/lib/constants";
import { EmployeeExitButton } from "@/components/employees/employee-exit-dialog";
import { ReturnAssignmentButton } from "@/components/assignments/return-assignment-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatRelative, daysUntil } from "@/lib/utils";
import { ASSET_STATUS } from "@/lib/constants";

export const metadata: Metadata = { title: "Employee profile" };

export default async function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const user = await requirePermissionPage("/my", PERMISSIONS.EMPLOYEES_VIEW);

  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      site: { select: { id: true, name: true, code: true, timezone: true } },
      department: {
        select: { id: true, name: true, code: true, costCenter: { select: { code: true, name: true } } },
      },
      team: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      user: {
        select: { id: true, name: true, email: true, status: true, role: { select: { key: true, name: true } } },
      },
      company: { select: { id: true, name: true } },
    },
  });

  if (!employee || employee.deletedAt) notFound();
  assertSiteAccess(user, employee.siteId);

  const canManage = can(user, PERMISSIONS.EMPLOYEES_MANAGE);
  const canReturn = can(user, PERMISSIONS.ASSIGNMENTS_RETURN);
  const fullName = `${employee.firstName} ${employee.lastName}`;

  const [openAssignments, assignedAssets, returnHistory, directReports] =
    await Promise.all([
      getEmployeeOpenAssignments(employee.id),
      prisma.asset.findMany({
        where: { assignedEmployeeId: employee.id, deletedAt: null },
        select: {
          id: true,
          assetTag: true,
          name: true,
          status: true,
          condition: true,
          warrantyEnd: true,
          site: { select: { name: true } },
        },
        orderBy: { assetTag: "asc" },
      }),
      prisma.assetAssignment.findMany({
        where: { employeeId: employee.id, status: { in: ["RETURNED", "DAMAGED", "MISSING"] } },
        select: {
          id: true,
          status: true,
          assignedAt: true,
          returnedAt: true,
          returnCondition: true,
          asset: { select: { id: true, assetTag: true, name: true } },
          returnedBy: { select: { name: true } },
        },
        orderBy: { returnedAt: "desc" },
        take: 25,
      }),
      prisma.employee.count({ where: { managerId: employee.id, deletedAt: null } }),
    ]);

  const outstanding = openAssignments.length + assignedAssets.length;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/employees" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Employees
          </Link>
        }
        title={fullName}
        description={[
          employee.employeeNo,
          employee.jobTitle,
          employee.department.name,
          employee.site.name,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {employee.user && can(user, PERMISSIONS.USERS_MANAGE) && (
              <Link
                href={`/settings/users/${employee.user.id}`}
                className="inline-flex h-8 items-center rounded-md border border-input px-3 text-xs font-medium hover:bg-accent"
              >
                Linked account
              </Link>
            )}
            {canManage && employee.employmentStatus !== "EXITED" && (
              <EmployeeExitButton employeeId={employee.id} employeeName={fullName} />
            )}
          </>
        }
      />

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <StatusBadge status={employee.employmentStatus} map={EMPLOYMENT_STATUS} />
        {employee.employmentStatus !== "EXITED" && outstanding > 0 && (
          <Badge variant="warning">{outstanding} outstanding item{outstanding === 1 ? "" : "s"}</Badge>
        )}
        {employee.user ? (
          <Badge variant="info">Account: {employee.user.role.name}</Badge>
        ) : (
          <Badge variant="muted">No user account</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Identity" description="Personal and contact details.">
          <DetailGrid>
            <DetailItem label="Employee number" mono>
              {employee.employeeNo}
            </DetailItem>
            <DetailItem label="Full name">
              {fullName}
            </DetailItem>
            <DetailItem label="Job title">{employee.jobTitle || "—"}</DetailItem>
            <DetailItem label="Work email" mono>
              {employee.email || "—"}
            </DetailItem>
            <DetailItem label="Phone" mono>
              {employee.phone || "—"}
            </DetailItem>
            <DetailItem label="Reports to">
              {employee.manager ? (
                <Link
                  href={`/employees/${employee.manager.id}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  {employee.manager.firstName} {employee.manager.lastName}
                </Link>
              ) : (
                "—"
              )}
            </DetailItem>
            <DetailItem label="Direct reports">{directReports}</DetailItem>
            <DetailItem label="Linked account">
              {employee.user ? (
                <Link href={`/settings/users/${employee.user.id}`} className="text-primary hover:underline">
                  {employee.user.email}
                </Link>
              ) : (
                "—"
              )}
            </DetailItem>
            <DetailItem label="Company">{employee.company.name}</DetailItem>
          </DetailGrid>
        </SectionCard>

        <SectionCard title="Department & placement" description="Where this headcount sits in the organisation.">
          <DetailGrid>
            <DetailItem label="Site">
              {employee.site.name} ({employee.site.code})
            </DetailItem>
            <DetailItem label="Timezone" mono>
              {employee.site.timezone}
            </DetailItem>
            <DetailItem label="Department">
              {employee.department.name} ({employee.department.code})
            </DetailItem>
            <DetailItem label="Team">{employee.team?.name || "—"}</DetailItem>
            <DetailItem label="Cost centre">
              {employee.department.costCenter
                ? `${employee.department.costCenter.code} — ${employee.department.costCenter.name}`
                : "—"}
            </DetailItem>
            <DetailItem label="Notes" className="sm:col-span-2">
              {employee.notes || "—"}
            </DetailItem>
          </DetailGrid>
        </SectionCard>
      </div>

      <SectionCard
        title="Employment timeline"
        description="Hire, record and exit milestones."
      >
        <DetailGrid>
          <DetailItem label="Hire date">{formatDate(employee.hireDate)}</DetailItem>
          <DetailItem label="Record created">{formatDate(employee.createdAt, true)}</DetailItem>
          <DetailItem label="Last updated">{formatRelative(employee.updatedAt)}</DetailItem>
          <DetailItem label="Employment status">
            <StatusBadge status={employee.employmentStatus} map={EMPLOYMENT_STATUS} />
          </DetailItem>
          <DetailItem label="Exit date">
            {employee.exitDate ? formatDate(employee.exitDate) : "—"}
          </DetailItem>
          <DetailItem label="Account status">
            {employee.user ? (
              <Badge variant={employee.user.status === "ACTIVE" ? "success" : "muted"}>
                {employee.user.status}
              </Badge>
            ) : (
              "—"
            )}
          </DetailItem>
        </DetailGrid>
      </SectionCard>

      {outstanding > 0 && (
        <SectionCard
          title="Outstanding at exit"
          description="Settle these before confirming offboarding."
        >
          <div className="space-y-3">
            {openAssignments.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Open assignments</p>
                <ul className="divide-y rounded-md border">
                  {openAssignments.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm">{row.asset.assetTag}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.asset.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <AssignmentStatusBadge status={row.status as never} />
                        <Link href={`/assets/${row.asset.id}`} className="text-xs text-primary hover:underline">
                          Open
                        </Link>
                        {canReturn && (
                          <ReturnAssignmentButton
                            assignmentId={row.id}
                            assetTag={row.asset.assetTag}
                            assetName={row.asset.name}
                            label="Return"
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {assignedAssets.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Assets still assigned</p>
                <ul className="divide-y rounded-md border">
                  {assignedAssets.map((asset) => (
                    <li key={asset.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm">{asset.assetTag}</p>
                        <p className="truncate text-xs text-muted-foreground">{asset.name}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{asset.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Open assignments"
        description="Live list of equipment currently on loan to this employee."
        actions={
          <Link href={`/assignments?employee=${employee.id}`} className="text-xs text-primary hover:underline">
            View all
          </Link>
        }
      >
        {openAssignments.length === 0 ? (
          <EmptyState
            icon={<PackageCheck className="h-8 w-8" />}
            title="No open assignments"
            description="Every issued item has been returned."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Expected return</TableHead>
                  <TableHead>Acknowledged</TableHead>
                  <TableHead>Assigned by</TableHead>
                  {canReturn && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {openAssignments.map((row) => {
                  const due = daysUntil(row.expectedReturnAt);
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link href={`/assets/${row.asset.id}`} className="font-medium text-primary hover:underline">
                          {row.asset.assetTag}
                        </Link>
                        <span className="block text-xs text-muted-foreground">{row.asset.name}</span>
                      </TableCell>
                      <TableCell>
                        <AssignmentStatusBadge status={row.status as never} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDate(row.assignedAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDate(row.expectedReturnAt)}
                        {row.expectedReturnAt && due !== null && due < 0 && (
                          <Badge variant="danger" className="ml-1.5">
                            Overdue
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.acknowledgedAt ? formatDate(row.acknowledgedAt) : "Pending"}
                      </TableCell>
                      <TableCell className="text-xs">{row.assignedBy.name}</TableCell>
                      {canReturn && (
                        <TableCell className="text-right">
                          <ReturnAssignmentButton
                            assignmentId={row.id}
                            assetTag={row.asset.assetTag}
                            assetName={row.asset.name}
                            label="Return"
                          />
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Assigned assets"
        description={`${assignedAssets.length} asset${assignedAssets.length === 1 ? "" : "s"} currently linked to this employee.`}
      >
        {assignedAssets.length === 0 ? (
          <EmptyState title="No assets assigned" description="Nothing is registered against this employee." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset tag</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Warranty end</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignedAssets.map((asset) => {
                  const warrantyDays = daysUntil(asset.warrantyEnd);
                  return (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <Link href={`/assets/${asset.id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                          {asset.assetTag}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">{asset.name}</TableCell>
                      <TableCell className="text-sm">{asset.site.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={asset.status} map={ASSET_STATUS} />
                      </TableCell>
                      <TableCell>
                        <ConditionBadge condition={asset.condition as never} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDate(asset.warrantyEnd)}
                        {asset.warrantyEnd && warrantyDays !== null && warrantyDays < 0 && (
                          <Badge variant="muted" className="ml-1.5">
                            Expired
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Return history"
        description="Completed returns — last 25 closed assignments."
      >
        {returnHistory.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-8 w-8" />}
            title="No returns recorded"
            description="Closed assignments will appear here once equipment is checked back in."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Returned</TableHead>
                  <TableHead>Return condition</TableHead>
                  <TableHead>Received by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnHistory.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/assets/${row.asset.id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                        {row.asset.assetTag}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{row.asset.name}</span>
                    </TableCell>
                    <TableCell>
                      <AssignmentStatusBadge status={row.status as never} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(row.assignedAt)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{formatDate(row.returnedAt)}</TableCell>
                    <TableCell>
                      {row.returnCondition ? <ConditionBadge condition={row.returnCondition as never} /> : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{row.returnedBy?.name ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
