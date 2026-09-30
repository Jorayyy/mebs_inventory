import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, isGlobal, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str, parseTableQuery } from "@/lib/query";
import { PageHeader, EmptyState } from "@/components/shared/page-header";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import { UrlDataTable } from "@/components/transfers/url-data-table";
import { receiptColumns, type ReceiptRow } from "@/components/inventory/receipt-columns";
import { NewReceiptButton } from "@/components/inventory/receipt-form";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";

export const metadata: Metadata = { title: "Receiving" };

const MAX_ROWS = 5000;

export default async function ReceivingPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.INVENTORY_VIEW);
  const query = parseTableQuery(searchParams);

  const siteId = str(searchParams, "site");
  const status = str(searchParams, "status");

  const scope = isGlobal(user) ? {} : { siteId: { in: user.siteIds } };

  const where = {
    ...scope,
    ...(siteId ? { siteId } : {}),
    ...(query.q
      ? {
          OR: [
            { receiptNumber: { contains: query.q, mode: "insensitive" as const } },
            { invoiceNumber: { contains: query.q, mode: "insensitive" as const } },
            { referenceNumber: { contains: query.q, mode: "insensitive" as const } },
            { notes: { contains: query.q, mode: "insensitive" as const } },
            { supplier: { name: { contains: query.q, mode: "insensitive" as const } } },
            { po: { poNumber: { contains: query.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [receipts, completedIds, sites] = await Promise.all([
    prisma.receiving.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        id: true,
        receiptNumber: true,
        deliveryDate: true,
        createdAt: true,
        totalCost: true,
        invoiceNumber: true,
        site: { select: { id: true, name: true, code: true } },
        stockLocation: { select: { code: true, name: true } },
        supplier: { select: { id: true, name: true } },
        po: { select: { poNumber: true } },
        receivedBy: { select: { name: true } },
        items: { select: { quantity: true } },
      },
    }),
    prisma.inventoryTransaction.findMany({
      where: { referenceType: "RECEIVING" },
      distinct: ["referenceId"],
      select: { referenceId: true },
    }),
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const done = new Set(completedIds.map((row) => row.referenceId));
  const canReceive = can(user, PERMISSIONS.INVENTORY_RECEIVE);

  let rows: ReceiptRow[] = receipts.map((receipt) => ({
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    status: done.has(receipt.id) ? "COMPLETED" : "OPEN",
    deliveryDate: receipt.deliveryDate,
    createdAt: receipt.createdAt,
    totalCost: Number(receipt.totalCost),
    lineCount: receipt.items.length,
    itemQty: receipt.items.reduce((sum, line) => sum + line.quantity, 0),
    invoiceNumber: receipt.invoiceNumber,
    poNumber: receipt.po?.poNumber ?? null,
    site: receipt.site,
    stockLocation: receipt.stockLocation,
    supplier: receipt.supplier,
    receivedBy: { name: receipt.receivedBy.name },
    can: { receive: canReceive },
  }));

  if (status === "open") rows = rows.filter((row) => row.status === "OPEN");
  if (status === "completed") rows = rows.filter((row) => row.status === "COMPLETED");

  const numeric: Record<string, (row: ReceiptRow) => number> = {
    deliveryDate: (row) => row.deliveryDate.getTime(),
    totalCost: (row) => row.totalCost,
    createdAt: (row) => row.createdAt.getTime(),
  };
  const textual: Record<string, (row: ReceiptRow) => string> = {
    receiptNumber: (row) => row.receiptNumber.toLowerCase(),
    supplier: (row) => row.supplier?.name.toLowerCase() ?? "",
    site: (row) => row.site.name.toLowerCase(),
    receivedBy: (row) => row.receivedBy.name.toLowerCase(),
  };

  const byNumber = numeric[query.sort];
  const byText = textual[query.sort];
  const dir = query.dir === "desc" ? -1 : 1;
  if (byNumber) {
    rows = [...rows].sort((a, b) => (byNumber(a) - byNumber(b)) * dir);
  } else if (byText) {
    rows = [...rows].sort((a, b) => byText(a).localeCompare(byText(b)) * dir);
  }

  const start = (query.page - 1) * query.pageSize;
  const page = rows.slice(start, start + query.pageSize);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Stock
          </Link>
        }
        title="Receiving"
        description={`${rows.length.toLocaleString()} receipt${rows.length === 1 ? "" : "s"} matching the current filters.`}
        actions={canReceive ? <NewReceiptButton /> : undefined}
      />

      <InventoryTabs canAdd={canReceive} />

      <FilterBar>
        <SearchInput placeholder="Receipt, invoice, PO, supplier…" defaultValue={query.q} />
        <FilterSelect
          param="site"
          label="Site"
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
        />
        <FilterSelect
          param="status"
          label="Status"
          allLabel="Any status"
          options={[
            { value: "open", label: "Open" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </FilterBar>

      <UrlDataTable
        columns={receiptColumns}
        data={page}
        total={rows.length}
        page={query.page}
        pageSize={query.pageSize}
        sort={query.sort || "createdAt"}
        dir={query.dir}
        emptyState={
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No receipts found"
            description="Receive a delivery to post consumable stock and update purchase orders."
            action={canReceive ? <NewReceiptButton label="New receipt" /> : undefined}
          />
        }
      />
    </div>
  );
}
