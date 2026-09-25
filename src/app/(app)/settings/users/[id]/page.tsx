import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS, ROLE_DEFINITIONS, type RoleKey } from "@/lib/permissions";
import { formatDate, formatRelative } from "@/lib/utils";
import {
  PageHeader,
  SectionCard,
  DetailGrid,
  DetailItem,
} from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import { USER_STATUS } from "@/lib/constants";
import { RoleStatusPanel, SiteScopePanel } from "@/components/users/user-detail-actions";

export const metadata: Metadata = { title: "Manage user" };

export default async function UserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const viewer = await requirePermissionPage("/my", PERMISSIONS.USERS_MANAGE);

  const account = await prisma.user.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      role: {
        include: { permissions: { include: { permission: { select: { key: true } } } } },
      },
      siteScopes: { include: { site: { select: { id: true, name: true, code: true } } } },
      employee: { select: { id: true, employeeNo: true, firstName: true, lastName: true } },
    },
  });

  if (!account) notFound();

  const sites = await prisma.site.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const canManage = can(viewer, PERMISSIONS.USERS_MANAGE);
  const isSelf = viewer.id === account.id;
  const definition = ROLE_DEFINITIONS[account.role.key as RoleKey];
  const baseline = definition?.permissions ?? [];
  const effective = account.role.permissions.map((row) => row.permission.key).sort();
  const isBaseline = baseline.length > 0 && effective.length > 0
    ? JSON.stringify([...baseline].sort()) === JSON.stringify(effective)
    : effective.length === baseline.length;

  return (
    <div className="space-y-4">
      <PageHeader
        title={account.name}
        breadcrumb={
          <Link href="/settings/users" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Users &amp; roles
          </Link>
        }
        description={account.email}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={account.status} map={USER_STATUS} />
            <Badge variant="outline">{account.role.name}</Badge>
            {isSelf && <Badge variant="info">Your account</Badge>}
          </div>
        }
      />

      <RoleStatusPanel
        user={{ id: account.id, status: account.status, roleKey: account.role.key }}
        isSelf={isSelf}
        canManage={canManage}
      />

      <SiteScopePanel
        user={{
          id: account.id,
          name: account.name,
          siteIds: account.siteScopes.map((scope) => scope.siteId),
          roleKey: account.role.key,
        }}
        sites={sites}
        isSelf={isSelf}
        canManage={canManage}
      />

      <SectionCard
        title="Effective permissions"
        description={
          isBaseline
            ? "Matches the built-in baseline for this role."
            : "Customised — these grants differ from the built-in baseline."
        }
        actions={<Badge variant={isBaseline ? "success" : "warning"}>{effective.length} granted</Badge>}
      >
        {effective.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No permissions are stored for this role yet. Open{" "}
            <Link href="/settings/users?tab=roles" className="text-primary hover:underline">
              Roles &amp; permissions
            </Link>{" "}
            to grant them.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {effective.map((key) => (
              <span
                key={key}
                className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {key}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Sign-in refreshes the session, so permission changes take effect from the user&apos;s next
          sign-in.
        </p>
      </SectionCard>

      <SectionCard title="Account details">
        <DetailGrid>
          <DetailItem label="Email" mono>
            {account.email}
          </DetailItem>
          <DetailItem label="Role key" mono>
            {account.role.key}
          </DetailItem>
          <DetailItem label="Status">
            <StatusBadge status={account.status} map={USER_STATUS} />
          </DetailItem>
          <DetailItem label="Site scopes">
            {account.siteScopes.length === 0
              ? "All sites"
              : account.siteScopes
                  .map((scope) => scope.site.name)
                  .join(", ")}
          </DetailItem>
          <DetailItem label="Linked employee">
            {account.employee ? (
              <Link
                href={`/employees/${account.employee.id}`}
                className="text-primary hover:underline"
              >
                {account.employee.firstName} {account.employee.lastName} (
                {account.employee.employeeNo})
              </Link>
            ) : (
              "Not linked"
            )}
          </DetailItem>
          <DetailItem label="Last sign-in">
            {account.lastLoginAt ? (
              <span title={formatDate(account.lastLoginAt, true)}>
                {formatRelative(account.lastLoginAt)}
              </span>
            ) : (
              "Never signed in"
            )}
          </DetailItem>
          <DetailItem label="Created">{formatDate(account.createdAt)}</DetailItem>
          <DetailItem label="Must change password">
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              {account.mustChangePassword ? "Required" : "Not required"}
            </span>
          </DetailItem>
          <DetailItem label="Failed attempts">
            {account.lockedUntil && account.lockedUntil > new Date() ? (
              <span className="text-destructive">
                Locked until {formatDate(account.lockedUntil, true)}
              </span>
            ) : (
              account.failedAttempts
            )}
          </DetailItem>
        </DetailGrid>
      </SectionCard>
    </div>
  );
}
