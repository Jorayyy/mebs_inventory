import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Inbox } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, assertSiteAccess, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader, SectionCard, DetailGrid, DetailItem, EmptyState } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ReceiptRow } from "@/components/inventory/receipt-columns";
import { ReceiptToolbar, ReceiptLineRemoveButton } from "@/components/inventory/receipt-actions";
import { PoStatusBadge } from "@/components/suppliers/supplier-detail";
import { splitLineMeta } from "@/lib/validations/inventory";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

export const metadata: Metadata = { title: "Receipt" };

/** Local labels: server pages cannot read value exports from "use client" modules. */
const RECEIVING_STATUS: Record<string, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
};

const CONDITION_TONE: Record<string, "success" | "warning" | "danger" | "info"> = {
  GOOD: "success",
  DAMAGED: "warning",
  EXPIRED: "danger",
  RETURNED: "info",
};

export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const user = await requirePermissionPage("/my", PERMISSIONS.INVENTORY_VIEW);

  const receipt = await prisma.receiving.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      receiptNumber: true,
      deliveryDate: true,
      createdAt: true,
      invoiceNumber: true,
      referenceNumber: true,
      totalCost: true,
      notes: true,
      siteId: true,
      site: { select: { id: true, name: true, code: true } },
      stockLocation: { select: { code: true, name: true } },
      supplier: { select: { id: true, name: true } },
      po: { select: { id: true, poNumber: true, status: true, expectedDate: true, currency: true } },
      receivedBy: { select: { name: true } },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          quantity: true,
          unitCost: true,
          totalCost: true,
          inventoryItemId: true,
        },
      },
    },
  });

  if (!receipt) notFound();
  assertSiteAccess(user, receipt.siteId);

  const linkedIds = Array.from(
    new Set(
      receipt.items
        .map((line) => line.inventoryItemId)
        .filter((id): id is string => Boolean(id))
    )
  );
  const linkedItems = linkedIds.length
    ? await prisma.inventoryItem.findMany({
        where: { id: { in: linkedIds } },
        select: { id: true, sku: true, name: true, unit: true },
      })
    : [];
  const itemById = new Map(linkedItems.map((item) => [item.id, item]));

  const posted = await prisma.inventoryTransaction.findFirst({
    where: { referenceType: "RECEIVING", referenceId: receipt.id },
    select: { id: true },
  });
  const status: ReceiptRow["status"] = posted ? "COMPLETED" : "OPEN";
  const canReceive = can(user, PERMISSIONS.INVENTORY_RECEIVE);

  const row: ReceiptRow = {
    id: receipt.id,
    receiptNumber: receipt.receiptNumber,
    status,
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
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        breadcrumb={
          <Link
            href="/inventory/receive"
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <ChevronLeft className="h-3 w-3" /> Receiving
          </Link>
        }
        title={receipt.receiptNumber}
        description={`${receipt.supplier?.name ?? "No supplier"} · ${receipt.site.name} (${receipt.site.code})`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={status} map={RECEIVING_STATUS} />
          {receipt.po && (
            <Link href={`/inventory/receive?status=open`} className="text-xs text-muted-foreground hover:text-foreground">
              PO {receipt.po.poNumber}
            </Link>
          )}
          {receipt.po && <PoStatusBadge status={receipt.po.status} />}
        </div>
        <ReceiptToolbar receipt={row} can={{ receive: canReceive }} />
      </div>

      <SectionCard title="Receipt details" description={`Registered ${formatDate(receipt.createdAt, true)}`}>
        <DetailGrid>
          <DetailItem label="Supplier">
            {receipt.supplier ? (
              <Link href={`/suppliers/${receipt.supplier.id}`} className="text-primary hover:underline">
                {receipt.supplier.name}
              </Link>
            ) : (
              "—"
            )}
          </DetailItem>
          <DetailItem label="Purchase order">
            {receipt.po ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-mono">{receipt.po.poNumber}</span>
                <PoStatusBadge status={receipt.po.status} />
              </span>
            ) : (
              "No PO"
            )}
          </DetailItem>
          <DetailItem label="Delivery date">{formatDate(receipt.deliveryDate)}</DetailItem>
          <DetailItem label="Stock location">
            {receipt.stockLocation
              ? `${receipt.stockLocation.name} (${receipt.stockLocation.code})`
              : "Each item's home location"}
          </DetailItem>
          <DetailItem label="Invoice number" mono>
            {receipt.invoiceNumber || "—"}
          </DetailItem>
          <DetailItem label="Reference number" mono>
            {receipt.referenceNumber || "—"}
          </DetailItem>
          <DetailItem label="Received by">{receipt.receivedBy.name}</DetailItem>
          <DetailItem label="Total value">{formatCurrency(Number(receipt.totalCost))}</DetailItem>
          <DetailItem label="Notes" className="sm:col-span-2 lg:col-span-3">
            {receipt.notes || "—"}
          </DetailItem>
        </DetailGrid>
      </SectionCard>

      <SectionCard
        title="Lines"
        description={`${receipt.items.length} line${receipt.items.length === 1 ? "" : "s"} · ${
          status === "OPEN" ? "quantities post to stock on completion" : "posted to stock"
        }`}
      >
        {receipt.items.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No lines on this receipt"
            description="Add lines, link each one to an inventory item, then complete the receipt."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {status === "OPEN" && canReceive && (
                    <TableHead className="w-10">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.items.map((line) => {
                  const { text, meta } = splitLineMeta(line.description);
                  const linked = line.inventoryItemId
                    ? itemById.get(line.inventoryItemId)
                    : undefined;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="min-w-[180px]">
                        {linked ? (
                          <Link
                            href={`/inventory/${linked.id}`}
                            className="block font-medium text-primary hover:underline"
                          >
                            {linked.sku}
                          </Link>
                        ) : (
                          <Badge variant="muted">Unlinked</Badge>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {linked?.name ?? "No stock item"}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <p className="text-sm">{text || "—"}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {meta.condition && (
                            <Badge variant={CONDITION_TONE[meta.condition] ?? "muted"}>
                              {meta.condition}
                            </Badge>
                          )}
                          {meta.expiryDate && (
                            <Badge variant="outline">Exp {formatDate(new Date(meta.expiryDate))}</Badge>
                          )}
                          {meta.batch && <Badge variant="outline">{meta.batch}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {line.quantity} {linked?.unit ?? ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(Number(line.unitCost))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatCurrency(Number(line.totalCost))}
                      </TableCell>
                      {status === "OPEN" && canReceive && (
                        <TableCell>
                          <ReceiptLineRemoveButton receivingId={receipt.id} lineId={line.id} />
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
    </div>
  );
}
