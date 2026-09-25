import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Boxes, ClipboardList, Inbox, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import {
  PageHeader,
  SectionCard,
  DetailGrid,
  DetailItem,
  EmptyState,
  StatCard,
} from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { SupplierDetailActions, PoStatusBadge } from "@/components/suppliers/supplier-detail";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

export const metadata: Metadata = { title: "Supplier" };

/** Local labels: server pages cannot read value exports from "use client" modules. */
const SUPPLIER_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Inactive", tone: "muted" },
};

export default async function SupplierPage({ params }: { params: { id: string } }) {
  const user = await requirePermissionPage("/my", PERMISSIONS.SUPPLIERS_VIEW);

  const supplier = await prisma.supplier.findUnique({
    where: { id: params.id },
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
    },
  });

  if (!supplier) notFound();

  const [items, itemTotal, purchaseOrders, openPoCount, receipts] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { supplierId: supplier.id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        currentQty: true,
        reorderLevel: true,
        site: { select: { name: true } },
      },
    }),
    prisma.inventoryItem.count({ where: { supplierId: supplier.id, deletedAt: null } }),
    prisma.purchaseOrder.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        poNumber: true,
        status: true,
        orderDate: true,
        totalAmount: true,
        currency: true,
        site: { select: { name: true } },
      },
    }),
    prisma.purchaseOrder.count({
      where: { supplierId: supplier.id, status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } },
    }),
    prisma.receiving.findMany({
      where: { supplierId: supplier.id },
      orderBy: { deliveryDate: "desc" },
      take: 8,
      select: {
        id: true,
        receiptNumber: true,
        deliveryDate: true,
        totalCost: true,
        site: { select: { name: true } },
      },
    }),
  ]);

  const canManage = can(user, PERMISSIONS.SUPPLIERS_MANAGE);
  const archived = Boolean(supplier.deletedAt);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/suppliers" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Suppliers
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {supplier.name}
            <StatusBadge status={supplier.status} map={SUPPLIER_STATUS} />
            {archived && <Badge variant="muted">Archived</Badge>}
          </span>
        }
        description={
          supplier.contactPerson || supplier.email || supplier.phone || "No contact details yet"
        }
        actions={
          <SupplierDetailActions
            supplier={{
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
              archived,
            }}
            can={{ manage: canManage }}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Stock items"
          value={itemTotal.toLocaleString()}
          hint="Active consumables"
          icon={<Boxes className="h-4 w-4" />}
        />
        <StatCard
          label="Open POs"
          value={openPoCount.toLocaleString()}
          hint="Approved, sent or partial"
          tone={openPoCount > 0 ? "info" : "default"}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <StatCard
          label="Receipts"
          value={receipts.length.toLocaleString()}
          hint="Most recent deliveries"
          icon={<Inbox className="h-4 w-4" />}
        />
        <StatCard
          label="Registered"
          value={formatDate(supplier.createdAt)}
          hint="Supplier since"
          icon={<Truck className="h-4 w-4" />}
        />
      </div>

      <SectionCard title="Contact & details" description="How to reach this supplier.">
        <DetailGrid>
          <DetailItem label="Contact person">{supplier.contactPerson || "—"}</DetailItem>
          <DetailItem label="Email">{supplier.email || "—"}</DetailItem>
          <DetailItem label="Phone">{supplier.phone || "—"}</DetailItem>
          <DetailItem label="Website">{supplier.website || "—"}</DetailItem>
          <DetailItem label="Tax ID" mono>
            {supplier.taxId || "—"}
          </DetailItem>
          <DetailItem label="Products supplied">{supplier.productsSupplied || "—"}</DetailItem>
          <DetailItem label="Address" className="sm:col-span-2 lg:col-span-3">
            {supplier.address || "—"}
          </DetailItem>
          <DetailItem label="Notes" className="sm:col-span-2 lg:col-span-3">
            {supplier.notes || "—"}
          </DetailItem>
        </DetailGrid>
      </SectionCard>

      <SectionCard
        title="Stock items"
        description={`${itemTotal.toLocaleString()} item${itemTotal === 1 ? "" : "s"} prefer this supplier.`}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-8 w-8" />}
            title="No stock items linked"
            description="Set this supplier as the preferred source on an inventory item."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Reorder at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/inventory/${item.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.sku}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{item.name}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.site.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatNumber(Number(item.currentQty), 3)} {item.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                      {formatNumber(Number(item.reorderLevel), 3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Purchase orders"
        description={`${openPoCount} open order${openPoCount === 1 ? "" : "s"}.`}
      >
        {purchaseOrders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-8 w-8" />}
            title="No purchase orders yet"
            description="Purchase orders raised against this supplier will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Order date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-sm">{po.poNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{po.site.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(po.orderDate)}
                    </TableCell>
                    <TableCell>
                      <PoStatusBadge status={po.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {formatCurrency(Number(po.totalAmount))} <span className="text-xs text-muted-foreground">{po.currency}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Receipts" description="Deliveries received against this supplier.">
        {receipts.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-8 w-8" />}
            title="No receipts yet"
            description="Recorded deliveries from this supplier will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Delivery date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((receipt) => (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      <Link
                        href={`/inventory/receive/${receipt.id}`}
                        className="font-mono text-sm font-medium text-primary hover:underline"
                      >
                        {receipt.receiptNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {receipt.site.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(receipt.deliveryDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {formatCurrency(Number(receipt.totalCost))}
                    </TableCell>
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
