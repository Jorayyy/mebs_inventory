import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertSiteAccess, can, type SessionUser } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import type { AssetDetailData } from "@/components/assets/asset-detail";

/** Loads everything the asset profile needs in one place (profile page + scan view). */
export async function loadAssetDetail(
  assetId: string,
  user: SessionUser
): Promise<AssetDetailData> {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      category: true,
      itemType: true,
      site: true,
      room: { include: { floor: { include: { building: true } } } },
      stockLocation: true,
      department: true,
      assignedEmployee: true,
      supplier: true,
      costCenter: true,
      custodian: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      disposal: true,
    },
  });

  if (!asset || asset.deletedAt) notFound();
  assertSiteAccess(user, asset.siteId);

  const [assignments, transactions, maintenance, transfers, attachments] = await Promise.all([
    prisma.assetAssignment.findMany({
      where: { assetId: asset.id },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
        assignedBy: { select: { name: true } },
        returnedBy: { select: { name: true } },
      },
      orderBy: { assignedAt: "desc" },
      take: 50,
    }),
    prisma.assetTransaction.findMany({
      where: { assetId: asset.id },
      include: {
        performedBy: { select: { name: true } },
        toEmployee: { select: { firstName: true, lastName: true } },
        fromEmployee: { select: { firstName: true, lastName: true } },
        toSite: { select: { name: true } },
        fromSite: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.maintenanceRecord.findMany({
      where: { assetId: asset.id },
      include: {
        reportedBy: { select: { name: true } },
        technician: { select: { name: true } },
        vendor: { select: { name: true } },
      },
      orderBy: { reportedAt: "desc" },
    }),
    prisma.transferAsset.findMany({
      where: { assetId: asset.id },
      include: {
        transfer: {
          include: {
            fromSite: { select: { name: true, code: true } },
            toSite: { select: { name: true, code: true } },
            requestedBy: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.attachment.findMany({
      where: { entityType: "Asset", entityId: asset.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    asset: JSON.parse(
      JSON.stringify({
        ...asset,
        purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : null,
        salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
      })
    ),
    assignments: JSON.parse(JSON.stringify(assignments)),
    transactions: JSON.parse(JSON.stringify(transactions)),
    maintenance: JSON.parse(JSON.stringify(maintenance)),
    transfers: JSON.parse(JSON.stringify(transfers)),
    attachments: JSON.parse(JSON.stringify(attachments)),
    permissions: {
      update: can(user, PERMISSIONS.ASSETS_UPDATE),
      assign: can(user, PERMISSIONS.ASSETS_ASSIGN),
      transfer: can(user, PERMISSIONS.ASSETS_TRANSFER),
      print: can(user, PERMISSIONS.ASSETS_PRINT_LABELS),
      maintenance: can(user, PERMISSIONS.MAINTENANCE_MANAGE),
      dispose: can(user, PERMISSIONS.ASSETS_DISPOSE),
      viewAll: can(user, PERMISSIONS.ASSIGNMENTS_VIEW),
    },
  };
}
