import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess, can, requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { TransferDetail, type TransferDetailData } from "@/components/transfers/transfer-detail";
import { TransferStatusToolbar } from "@/components/transfers/transfer-status-toolbar";

export const metadata: Metadata = { title: "Transfer" };

export default async function TransferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.TRANSFERS_VIEW);

  const transfer = await prisma.transfer.findUnique({
    where: { id: params.id },
    include: {
      fromSite: { select: { id: true, name: true, code: true } },
      toSite: { select: { id: true, name: true, code: true } },
      requestedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
      assets: {
        include: {
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              serialNumber: true,
              condition: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      items: {
        include: {
          inventoryItem: {
            select: { id: true, sku: true, name: true, unit: true, currentQty: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!transfer) notFound();
  assertSiteAccess(user, transfer.fromSiteId);
  assertSiteAccess(user, transfer.toSiteId);

  const [locations, activity] = await Promise.all([
    prisma.stockLocation.findMany({
      where: {
        id: {
          in: [transfer.fromLocationId, transfer.toLocationId].filter(
            (id): id is string => Boolean(id)
          ),
        },
      },
      select: { id: true, name: true },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "Transfer", entityId: transfer.id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  const data: TransferDetailData = {
    id: transfer.id,
    transferNumber: transfer.transferNumber,
    status: transfer.status,
    notes: transfer.notes,
    fromSite: transfer.fromSite,
    toSite: transfer.toSite,
    fromLocation: locations.find((l) => l.id === transfer.fromLocationId) ?? null,
    toLocation: locations.find((l) => l.id === transfer.toLocationId) ?? null,
    requestedBy: transfer.requestedBy,
    requestedAt: transfer.requestedAt,
    approvedBy: transfer.approvedBy,
    approvedAt: transfer.approvedAt,
    shippedAt: transfer.shippedAt,
    expectedArrival: transfer.expectedArrival,
    actualArrival: transfer.actualArrival,
    courier: transfer.courier,
    referenceNumber: transfer.referenceNumber,
    assets: transfer.assets.map((line) => ({
      id: line.asset.id,
      assetTag: line.asset.assetTag,
      name: line.asset.name,
      serialNumber: line.asset.serialNumber,
      status: line.status,
      conditionAtSend: line.conditionAtSend,
      conditionAtReceive: line.conditionAtReceive,
      currentCondition: line.asset.condition,
      currentStatus: line.asset.status,
    })),
    items: transfer.items.map((line) => ({
      id: line.id,
      sku: line.inventoryItem.sku,
      name: line.inventoryItem.name,
      unit: line.inventoryItem.unit,
      quantity: Number(line.quantity),
      receivedQuantity: line.receivedQuantity === null ? null : Number(line.receivedQuantity),
      status: line.status,
      availableAtSource: Number(line.inventoryItem.currentQty),
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      description: entry.description,
      createdAt: entry.createdAt,
      userName: entry.user?.name ?? null,
    })),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/transfers" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Transfers
          </Link>
        }
        title={transfer.transferNumber}
        description={`${transfer.fromSite.name} → ${transfer.toSite.name}`}
        actions={
          can(user, PERMISSIONS.REPORTS_EXPORT) ? (
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/export/transfers?id=${transfer.id}`}>
                <Download /> Export
              </a>
            </Button>
          ) : undefined
        }
      />

      <TransferStatusToolbar
        transfer={{
          id: transfer.id,
          status: transfer.status,
          transferNumber: transfer.transferNumber,
          assetCount: transfer.assets.length,
          itemCount: transfer.items.length,
          courier: transfer.courier,
          referenceNumber: transfer.referenceNumber,
        }}
        assets={transfer.assets.map((line) => ({
          id: line.asset.id,
          assetTag: line.asset.assetTag,
          condition: line.conditionAtReceive ?? line.asset.condition,
        }))}
        can={{
          act: can(user, PERMISSIONS.TRANSFERS_CREATE),
          approve: can(user, PERMISSIONS.TRANSFERS_APPROVE),
          ship: can(user, PERMISSIONS.TRANSFERS_SHIP),
          receive: can(user, PERMISSIONS.TRANSFERS_RECEIVE),
        }}
      />

      <TransferDetail data={data} />
    </div>
  );
}
