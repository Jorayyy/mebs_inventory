import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Tag, Upload, Laptop } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, isGlobal, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str, num, parseTableQuery } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { Button } from "@/components/ui/button";
import { assetColumns, type AssetRow } from "@/components/assets/asset-columns";
import { AssetSelectionToolbar } from "@/components/assets/asset-bulk-actions";
import { ASSET_STATUS, CATEGORY_GROUP } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma";

export const metadata: Metadata = { title: "Assets" };

const SORTABLE: Record<string, string> = {
  assetTag: "assetTag",
  serialNumber: "serialNumber",
  status: "status",
  condition: "condition",
  purchasePrice: "purchasePrice",
  warrantyEnd: "warrantyEnd",
  createdAt: "createdAt",
  name: "name",
  category: "category.name",
  site: "site.name",
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.ASSETS_VIEW);
  const query = parseTableQuery(searchParams);

  const siteId = str(searchParams, "site");
  const categoryId = str(searchParams, "category");
  const status = str(searchParams, "status");
  const condition = str(searchParams, "condition");
  const departmentId = str(searchParams, "department");
  const assigned = str(searchParams, "assigned");
  const group = str(searchParams, "group");
  const from = str(searchParams, "from");
  const to = str(searchParams, "to");

  const scope: Prisma.AssetWhereInput = isGlobal(user)
    ? {}
    : { siteId: { in: user.siteIds } };

  const where: Prisma.AssetWhereInput = {
    ...scope,
    deletedAt: null,
    ...(siteId ? { siteId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status: status as never } : {}),
    ...(condition ? { condition: condition as never } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(group
      ? { category: { group: group as never } }
      : {}),
    ...(assigned === "yes"
      ? { assignedEmployeeId: { not: null } }
      : assigned === "no"
        ? { assignedEmployeeId: null }
        : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { assetTag: { contains: query.q, mode: "insensitive" } },
            { serialNumber: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
            { model: { contains: query.q, mode: "insensitive" } },
            { brand: { contains: query.q, mode: "insensitive" } },
            { barcode: { contains: query.q, mode: "insensitive" } },
            {
              assignedEmployee: {
                OR: [
                  { firstName: { contains: query.q, mode: "insensitive" } },
                  { lastName: { contains: query.q, mode: "insensitive" } },
                  { employeeNo: { contains: query.q, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  const sortKey = SORTABLE[query.sort] ?? "createdAt";
  const orderBy: Prisma.AssetOrderByWithRelationInput =
    sortKey.includes(".")
      ? ({ [sortKey.split(".")[0]]: { [sortKey.split(".")[1]]: query.dir } } as never)
      : ({ [sortKey]: query.dir } as never);

  const [total, items, sites, categories, departments] = await Promise.all([
    prisma.asset.count({ where }),
    prisma.asset.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: {
        site: { select: { id: true, name: true, code: true } },
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedEmployee: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { code: true, name: true } },
        stockLocation: { select: { code: true, name: true } },
      },
    }),
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, group: true },
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.department.findMany({
      where: { isActive: true, ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows: AssetRow[] = items.map((asset) => ({
    id: asset.id,
    assetTag: asset.assetTag,
    name: asset.name,
    serialNumber: asset.serialNumber,
    model: asset.model,
    brand: asset.brand,
    status: asset.status,
    condition: asset.condition,
    purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
    warrantyEnd: asset.warrantyEnd,
    createdAt: asset.createdAt,
    site: asset.site,
    category: asset.category,
    department: asset.department,
    assignedEmployee: asset.assignedEmployee,
    room: asset.room,
    stockLocation: asset.stockLocation,
  }));

  const showExport = can(user, PERMISSIONS.ASSETS_EXPORT);
  const exportHref = `/api/export/assets?${new URLSearchParams(
    Object.fromEntries(
      Object.entries(searchParams)
        .map(([k, v]) => [k, Array.isArray(v) ? v[0] : (v ?? "")])
        .filter(([, v]) => v !== "")
    )
  ).toString()}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assets"
        description={`${total.toLocaleString()} tracked asset${total === 1 ? "" : "s"} across ${sites.length} site${sites.length === 1 ? "" : "s"}.`}
        actions={
          <>
            {showExport && (
              <Button variant="outline" size="sm" asChild>
                <a href={exportHref}>
                  <Upload /> Export CSV
                </a>
              </Button>
            )}
            {can(user, PERMISSIONS.ASSETS_PRINT_LABELS) && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/labels">
                  <Tag /> Print labels
                </Link>
              </Button>
            )}
            {can(user, PERMISSIONS.ASSETS_CREATE) && (
              <Button size="sm" asChild>
                <Link href="/assets/new">
                  <Plus /> New asset
                </Link>
              </Button>
            )}
          </>
        }
      />

      <FilterBar>
        <SearchInput placeholder="Tag, serial, model, employee…" defaultValue={query.q} />
        <FilterSelect param="site" label="Site" options={sites.map((s) => ({ value: s.id, label: s.name }))} />
        <FilterSelect
          param="group"
          label="Category group"
          options={Object.entries(CATEGORY_GROUP).map(([value, label]) => ({ value, label }))}
        />
        <FilterSelect
          param="categoryId"
          label="Category"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
        <FilterSelect
          param="department"
          label="Department"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <FilterSelect
          param="status"
          label="Status"
          options={Object.entries(ASSET_STATUS).map(([value, meta]) => ({ value, label: meta.label }))}
        />
        <FilterSelect
          param="assigned"
          label="Assignment"
          allLabel="Any assignment"
          options={[
            { value: "yes", label: "Assigned" },
            { value: "no", label: "Unassigned" },
          ]}
        />
      </FilterBar>

      <DataTable
        columns={assetColumns}
        data={rows}
        total={total}
        page={query.page}
        pageSize={query.pageSize}
        enableRowSelection={can(user, PERMISSIONS.ASSETS_ASSIGN)}
        toolbar={
          <AssetSelectionToolbar
            canAssign={can(user, PERMISSIONS.ASSETS_ASSIGN)}
            canStatus={can(user, PERMISSIONS.ASSETS_UPDATE)}
            canPrint={can(user, PERMISSIONS.ASSETS_PRINT_LABELS)}
            canTransfer={can(user, PERMISSIONS.ASSETS_TRANSFER)}
          />
        }
        emptyState={
          <EmptyState
            icon={<Laptop className="h-8 w-8" />}
            title="No assets match your filters"
            description="Clear filters or register your first asset to start tracking equipment."
            action={
              can(user, PERMISSIONS.ASSETS_CREATE) ? (
                <Button size="sm" asChild>
                  <Link href="/assets/new">
                    <Plus /> New asset
                  </Link>
                </Button>
              ) : undefined
            }
          />
        }
      />
    </div>
  );
}
