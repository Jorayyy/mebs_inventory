import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str, parseTableQuery } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { UrlDataTable } from "@/components/transfers/url-data-table";
import { Button } from "@/components/ui/button";
import { supplierColumns, type SupplierRow } from "@/components/suppliers/supplier-columns";

export const metadata: Metadata = { title: "Suppliers" };

const MAX_ROWS = 5000;

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.SUPPLIERS_VIEW);
  const query = parseTableQuery(searchParams);

  const status = str(searchParams, "status");
  const archivedOnly = str(searchParams, "archived") === "yes";

  const where = {
    ...(archivedOnly ? {} : { deletedAt: null }),
    ...(status === "active"
      ? { status: "ACTIVE" as const }
      : status === "inactive"
        ? { status: "INACTIVE" as const }
        : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { contactPerson: { contains: query.q, mode: "insensitive" as const } },
            { email: { contains: query.q, mode: "insensitive" as const } },
            { phone: { contains: query.q, mode: "insensitive" as const } },
            { productsSupplied: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { name: "asc" },
    take: MAX_ROWS,
    select: {
      id: true,
      name: true,
      contactPerson: true,
      email: true,
      phone: true,
      website: true,
      address: true,
      taxId: true,
      productsSupplied: true,
      notes: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      _count: {
        select: {
          inventoryItems: { where: { deletedAt: null } },
          purchaseOrders: {
            where: { status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } },
          },
        },
      },
    },
  });

  const ids = suppliers.map((supplier) => supplier.id);
  const emptyActivity: { supplierId: string; _max: { createdAt: Date | null } }[] = [];
  const [poActivity, receivingActivity] = ids.length
    ? await Promise.all([
        prisma.purchaseOrder.groupBy({
          by: ["supplierId"],
          where: { supplierId: { in: ids } },
          _max: { createdAt: true },
        }),
        prisma.receiving.groupBy({
          by: ["supplierId"],
          where: { supplierId: { in: ids } },
          _max: { createdAt: true },
        }),
      ])
    : [emptyActivity, emptyActivity];

  const lastPo = new Map(poActivity.map((row) => [row.supplierId, row._max.createdAt]));
  const lastReceipt = new Map(receivingActivity.map((row) => [row.supplierId, row._max.createdAt]));

  const canManage = can(user, PERMISSIONS.SUPPLIERS_MANAGE);

  let rows: SupplierRow[] = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    website: supplier.website,
    address: supplier.address,
    taxId: supplier.taxId,
    productsSupplied: supplier.productsSupplied,
    notes: supplier.notes,
    status: supplier.status,
    archived: Boolean(supplier.deletedAt),
    itemCount: supplier._count.inventoryItems,
    openPoCount: supplier._count.purchaseOrders,
    lastActivityAt:
      [lastPo.get(supplier.id), lastReceipt.get(supplier.id)]
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
    createdAt: supplier.createdAt,
    can: { manage: canManage },
  }));

  const numeric: Record<string, (row: SupplierRow) => number> = {
    itemCount: (row) => row.itemCount,
    openPoCount: (row) => row.openPoCount,
    lastActivity: (row) => row.lastActivityAt?.getTime() ?? 0,
    createdAt: (row) => row.createdAt.getTime(),
    status: (row) => (row.status === "ACTIVE" ? 1 : 0),
  };
  const textual: Record<string, (row: SupplierRow) => string> = {
    name: (row) => row.name.toLowerCase(),
    products: (row) => (row.productsSupplied ?? "").toLowerCase(),
  };

  const byNumber = numeric[query.sort];
  const byText = textual[query.sort];
  const dir = query.dir === "desc" ? -1 : 1;
  if (byNumber) rows = [...rows].sort((a, b) => (byNumber(a) - byNumber(b)) * dir);
  else if (byText) rows = [...rows].sort((a, b) => byText(a).localeCompare(byText(b)) * dir);

  const total = rows.length;
  const start = (query.page - 1) * query.pageSize;
  const page = rows.slice(start, start + query.pageSize);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description={`${total.toLocaleString()} supplier${total === 1 ? "" : "s"} matching the current filters.`}
        actions={
          canManage ? (
            <Button size="sm" asChild>
              <Link href="/suppliers/new">
                <Plus /> New supplier
              </Link>
            </Button>
          ) : undefined
        }
      />

      <FilterBar>
        <SearchInput placeholder="Name, contact, email…" defaultValue={query.q} />
        <FilterSelect
          param="status"
          label="Status"
          allLabel="Any status"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
        />
        <FilterSelect
          param="archived"
          label="Records"
          allLabel="Current only"
          options={[{ value: "yes", label: "Archived" }]}
        />
      </FilterBar>

      <UrlDataTable
        columns={supplierColumns}
        data={page}
        total={total}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort || "name"}
        dir={query.dir}
        emptyState={
          <EmptyState
            icon={<Truck className="h-8 w-8" />}
            title="No suppliers found"
            description="Register a supplier to link against purchase orders, receipts and stock items."
            action={
              canManage ? (
                <Button size="sm" asChild>
                  <Link href="/suppliers/new">
                    <Plus /> New supplier
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
