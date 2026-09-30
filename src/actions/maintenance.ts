"use server";

import { revalidatePath } from "next/cache";
import { prisma, withTx, type Tx } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { nextMaintenanceRef } from "@/lib/ids";
import type { AssetStatus } from "@/generated/prisma";
import { assertAssetTransition, isTerminal } from "@/lib/lifecycle";
import { maintenanceCreateSchema, maintenanceUpdateSchema } from "@/lib/validations/maintenance";

/** Statuses that pull an asset out of service and back in. */
const OUT_OF_SERVICE = new Set(["IN_REPAIR", "AWAITING_PARTS", "DIAGNOSED", "REPORTED"]);
const BACK_IN_SERVICE = new Set(["COMPLETED", "RETURNED_TO_SERVICE"]);

type MovableAsset = { id: string; assetTag: string; status: AssetStatus; siteId: string };

/**
 * The one place maintenance moves an asset. Validates the transition, updates
 * custody when required and appends the immutable ledger row.
 * Returns the asset's resulting status so callers can chain moves safely.
 */
async function moveAsset(
  tx: Tx,
  input: {
    asset: MovableAsset;
    from: AssetStatus;
    to: AssetStatus;
    userId: string;
    referenceId: string;
    notes: string;
    assignedEmployeeId?: string | null;
  }
): Promise<AssetStatus> {
  const { asset, from, to } = input;
  if (from === to && input.assignedEmployeeId === undefined) return to;
  assertAssetTransition(from, to, asset.assetTag);

  await tx.asset.update({
    where: { id: asset.id },
    data: {
      status: to,
      ...(input.assignedEmployeeId !== undefined ? { assignedEmployeeId: input.assignedEmployeeId } : {}),
    },
  });
  await tx.assetTransaction.create({
    data: {
      assetId: asset.id,
      type: "MAINTENANCE",
      fromStatus: from,
      toStatus: to,
      toSiteId: asset.siteId,
      performedById: input.userId,
      referenceType: "MAINTENANCE",
      referenceId: input.referenceId,
      previousValue: { status: from },
      newValue: { status: to },
      notes: input.notes,
    },
  });
  return to;
}


export async function createMaintenance(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
      const input = maintenanceCreateSchema.parse(raw);

      const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
      if (!asset || asset.deletedAt) throw new AppError("Asset not found.", { status: 404 });
      assertSiteAccess(user, asset.siteId);

      if (isTerminal(asset.status)) {
        throw new AppError(
          `${asset.assetTag} is ${asset.status === "DISPOSED" ? "disposed" : "retired"} â€” it cannot be sent to maintenance.`,
          { code: "INVALID_TRANSITION" }
        );
      }

      const open = await prisma.maintenanceRecord.findFirst({
        where: { assetId: asset.id, status: { notIn: ["COMPLETED", "RETURNED_TO_SERVICE", "CANCELLED"] } },
        select: { referenceNo: true },
      });
      if (open) {
        throw new AppError(`An open maintenance ticket already exists (${open.referenceNo}).`, {
          code: "DUPLICATE_TICKET",
        });
      }

      const id = await prisma.$transaction(async (tx) => {
        const referenceNo = await nextMaintenanceRef(tx);
        const record = await tx.maintenanceRecord.create({
          data: {
            assetId: asset.id,
            referenceNo,
            issue: input.issue,
            reportedById: user.id,
            technicianId: input.technicianId || null,
            vendorId: input.vendorId || null,
            status: "REPORTED",
            notes: input.notes || null,
          },
        });

        if (asset.status !== "UNDER_MAINTENANCE" && asset.status !== "FOR_REPAIR") {
          await moveAsset(tx, {
            asset,
            from: asset.status,
            to: "UNDER_MAINTENANCE",
            userId: user.id,
            referenceId: record.id,
            notes: input.issue,
          });
        }
        return record.id;
      });

      await recordAudit({
        userId: user.id,
        action: "MAINTENANCE_CREATED",
        entityType: "MaintenanceRecord",
        entityId: id,
        siteId: asset.siteId,
        description: `Reported maintenance for ${asset.assetTag}: ${input.issue.slice(0, 80)}`,
        newValue: { assetId: asset.id, issue: input.issue },
        ip: await getClientIp(),
      });

      const stewards = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          role: { key: { in: ["TECHNICIAN", "INVENTORY_ADMIN", "SITE_ADMIN"] } },
        },
        select: { id: true },
      });
      await notify({
        userIds: stewards.map((s) => s.id),
        type: "MAINTENANCE_UPDATE",
        title: `Maintenance reported: ${asset.assetTag}`,
        body: input.issue,
        entityType: "MaintenanceRecord",
        entityId: id,
        link: `/maintenance/${id}`,
      });

      revalidatePath("/maintenance");
      revalidatePath(`/assets/${asset.id}`);
      revalidatePath("/dashboard");
      return { id };
    },
    { action: "createMaintenance" }
  );
}

export async function updateMaintenance(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
      const input = maintenanceUpdateSchema.parse(raw);

      const record = await prisma.maintenanceRecord.findUnique({
        where: { id: input.id },
        include: { asset: { select: { id: true, assetTag: true, siteId: true, status: true } } },
      });
      if (!record) throw new AppError("Maintenance record not found.", { status: 404 });
      assertSiteAccess(user, record.asset.siteId);

      const cost = input.cost === undefined ? undefined : Number(input.cost || 0);
      const now = new Date();
      let assetStatus: AssetStatus = record.asset.status;

      await prisma.$transaction(async (tx) => {
        await tx.maintenanceRecord.update({
          where: { id: record.id },
          data: {
            status: input.status,
            diagnosis: input.diagnosis !== undefined ? input.diagnosis || null : undefined,
            repairAction: input.repairAction !== undefined ? input.repairAction || null : undefined,
            partsUsed: input.partsUsed !== undefined ? input.partsUsed || null : undefined,
            cost,
            notes: input.notes !== undefined ? input.notes || null : undefined,
            startedAt:
              input.status === "IN_REPAIR" && !record.startedAt ? now : undefined,
            completedAt: BACK_IN_SERVICE.has(input.status) || input.status === "COMPLETED" ? now : undefined,
            returnedAt: input.status === "RETURNED_TO_SERVICE" ? now : undefined,
            technicianId: record.technicianId ?? user.id,
          },
        });

        if (OUT_OF_SERVICE.has(input.status) || input.status === "IN_REPAIR") {
          assetStatus = await moveAsset(tx, {
            asset: record.asset,
            from: assetStatus,
            to: "UNDER_MAINTENANCE",
            userId: user.id,
            referenceId: record.id,
            notes: `Maintenance ${input.status}`,
          });
        }

        if (input.status === "RETURNED_TO_SERVICE" || input.status === "COMPLETED") {
          // Releasing an asset must respect custody: an open assignment wins,
          // disposed/retired assets are never resurrected.
          if (!isTerminal(assetStatus)) {
            const open = await tx.assetAssignment.findFirst({
              where: { assetId: record.asset.id, status: { in: ["ACTIVE", "RETURN_PENDING"] } },
              select: { employeeId: true },
            });
            assetStatus = await moveAsset(tx, {
              asset: record.asset,
              from: assetStatus,
              to: open ? "ASSIGNED" : "AVAILABLE",
              userId: user.id,
              referenceId: record.id,
              assignedEmployeeId: open?.employeeId ?? null,
              notes: open ? "Returned to service â€” still assigned" : "Returned to service",
            });
          }
        }
      });

      await recordAudit({
        userId: user.id,
        action: "MAINTENANCE_UPDATED",
        entityType: "MaintenanceRecord",
        entityId: record.id,
        siteId: record.asset.siteId,
        description: `Maintenance ${record.referenceNo} â†’ ${input.status}`,
        previousValue: { status: record.status, cost: Number(record.cost) },
        newValue: { status: input.status, cost },
        ip: await getClientIp(),
      });

      if (BACK_IN_SERVICE.has(input.status)) {
        const reporter = await prisma.user.findUnique({
          where: { id: record.reportedById },
          select: { id: true },
        });
        await notify({
          userIds: reporter ? [reporter.id] : [],
          type: "MAINTENANCE_UPDATE",
          title: `Maintenance completed: ${record.asset.assetTag}`,
          body: `${record.referenceNo} is ${input.status.toLowerCase()}.`,
          entityType: "MaintenanceRecord",
          entityId: record.id,
          link: `/maintenance/${record.id}`,
        });
      }

      revalidatePath("/maintenance");
      revalidatePath(`/maintenance/${record.id}`);
      revalidatePath(`/assets/${record.asset.id}`);
      revalidatePath("/dashboard");
      return { id: record.id };
    },
    { action: "updateMaintenance", maintenanceId: String((raw as { id?: string })?.id ?? "") }
  );
}

