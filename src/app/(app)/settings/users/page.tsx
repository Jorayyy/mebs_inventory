import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShieldCheck, UsersRound } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, type RoleKey } from "@/lib/permissions";
import { parseTableQuery, str } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { userColumns, type UserRow } from "@/components/users/user-columns";
import { USER_STATUS } from "@/lib/constants";
import { RolesPanel, type RoleSummary } from "@/components/users/roles-panel";

export const metadata: Metadata = { title: "Users & Roles" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.USERS_MANAGE);
  const canRoles = can(user, PERMISSIONS.ROLES_MANAGE);
  const tab = str(searchParams, "tab") === "roles" ? "roles" : "users";
  const query = parseTableQuery(searchParams);

  const q = str(searchParams, "q");
  const roleKey = str(searchParams, "role");
  const status = str(searchParams, "status");

  const where = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(roleKey ? { role: { key: roleKey } } : {}),
    ...(status ? { status: status as never } : {}),
  };

  const [total, users, roleRows, siteCount] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        role: { select: { key: true, name: true, scope: true } },
        siteScopes: { select: { siteId: true } },
      },
    }),
    prisma.role.findMany({
      include: {
        _count: { select: { users: true } },
        permissions: { include: { permission: { select: { key: true } } } },
      },
    }),
    prisma.site.count({ where: { deletedAt: null } }),
  ]);

  const rows: UserRow[] = users.map((account) => ({
    id: account.id,
    name: account.name,
    email: account.email,
    status: account.status,
    role: {
      key: account.role.key,
      name: account.role.name,
      siteScoped: account.role.scope === "site",
    },
    siteCount: account.siteScopes.length,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
    mustChangePassword: account.mustChangePassword,
  }));

  const roleByKey = new Map(roleRows.map((role) => [role.key, role]));
  const baseSummaries: RoleSummary[] = ROLE_KEYS.map((key) => {
    const definition = ROLE_DEFINITIONS[key];
    const row = roleByKey.get(key);
    return {
      key,
      name: definition.name,
      description: row?.description ?? definition.description,
      siteScoped: definition.siteScoped,
      userCount: row?._count.users ?? 0,
      permissionKeys: row ? row.permissions.map((permission) => permission.permission.key) : [],
    };
  });
  const roleSummaries: RoleSummary[] = [
    ...baseSummaries,
    ...roleRows
      .filter((row) => !ROLE_KEYS.includes(row.key as RoleKey))
      .map((row) => ({
        key: row.key,
        name: row.name,
        description: row.description,
        siteScoped: row.scope === "site",
        userCount: row._count.users,
        permissionKeys: row.permissions.map((permission) => permission.permission.key),
      })),
  ];

  const roleOptions = roleSummaries.map((role) => ({ value: role.key, label: role.name }));
  const statusOptions = Object.entries(USER_STATUS).map(([value, meta]) => ({
    value,
    label: meta.label,
  }));

  const tabClass = (active: boolean) =>
    cn(
      "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "border-primary text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users & roles"
        description={`${total.toLocaleString()} account${total === 1 ? "" : "s"} — roles decide permissions, site scopes decide visibility.`}
        actions={
          <Button size="sm" asChild>
            <Link href="/settings/users/new">
              <Plus /> New user
            </Link>
          </Button>
        }
      />

      <div className="flex gap-1 border-b">
        <Link href="/settings/users" className={tabClass(tab === "users")}>
          Users
        </Link>
        <Link href="/settings/users?tab=roles" className={tabClass(tab === "roles")}>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Roles &amp; permissions
          </span>
        </Link>
      </div>

      {tab === "roles" ? (
        <RolesPanel roles={roleSummaries} canManage={canRoles} />
      ) : (
        <>
          <FilterBar>
            <SearchInput placeholder="Name or email…" defaultValue={q ?? ""} />
            <FilterSelect param="role" label="Role" allLabel="Any role" options={roleOptions} />
            <FilterSelect
              param="status"
              label="Status"
              allLabel="Any status"
              options={statusOptions}
            />
          </FilterBar>

          <DataTable
            columns={userColumns}
            data={rows}
            total={total}
            page={query.page}
            pageSize={query.pageSize}
            emptyState={
              <EmptyState
                icon={<UsersRound className="h-8 w-8" />}
                title="No users match your filters"
                description={
                  siteCount === 0
                    ? "Create a site in Organization settings first, then add users."
                    : "Clear the filters or create the first account."
                }
                action={
                  <Button size="sm" asChild>
                    <Link href="/settings/users/new">
                      <Plus /> New user
                    </Link>
                  </Button>
                }
              />
            }
          />
        </>
      )}
    </div>
  );
}
