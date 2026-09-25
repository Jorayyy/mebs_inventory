"use server";

import { revalidatePath } from "next/cache";
import { prisma, withTx } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { nextMaintenanceRef } from "@/lib/ids";
import type { AssetStatus } from "@/generated/prisma";
import { maintenanceCreateSchema, maintenanceUpdateSchema } from "@/lib/validations/maintenance";

/** Statuses that pull an asset out of service and back in. */
const OUT_OF_SERVICE = new Set(["IN_REPAIR", "AWAITING_PARTS", "DIAGNOSED", "REPORTED"]);
const BACK_IN_SERVICE = new Set(["COMPLETED", "RETURNED_TO_SERVICE"]);

export async function createMaintenance(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
      const input = maintenanceCreateSchema.parse(raw);

      const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
      if (!asset || asset.deletedAt) throw new AppError("Asset not found.", { status: 404 });
      assertSiteAccess(user, asset.siteId);

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
          await tx.asset.update({
            where: { id: asset.id },
            data: { status: "UNDER_MAINTENANCE" },
          });
          await tx.assetTransaction.create({
            data: {
              assetId: asset.id,
              type: "MAINTENANCE",
              fromStatus: asset.status,
              toStatus: "UNDER_MAINTENANCE",
              toSiteId: asset.siteId,
              performedById: user.id,
              referenceType: "MAINTENANCE",
              referenceId: record.id,
              previousValue: { status: asset.status },
              newValue: { status: "UNDER_MAINTENANCE" },
              notes: input.issue,
            },
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
          if (record.asset.status !== "UNDER_MAINTENANCE") {
            await tx.asset.update({
              where: { id: record.asset.id },
              data: { status: "UNDER_MAINTENANCE" },
            });
            await tx.assetTransaction.create({
              data: {
                assetId: record.asset.id,
                type: "MAINTENANCE",
                fromStatus: record.asset.status,
                toStatus: "UNDER_MAINTENANCE",
                toSiteId: record.asset.siteId,
                performedById: user.id,
                referenceType: "MAINTENANCE",
                referenceId: record.id,
                previousValue: { status: record.asset.status },
                newValue: { status: "UNDER_MAINTENANCE" },
                notes: `Maintenance ${input.status}`,
              },
            });
          }
        }

        if (input.status === "RETURNED_TO_SERVICE" || input.status === "COMPLETED") {
          const release = input.status === "RETURNED_TO_SERVICE";
          if (release) {
            await tx.asset.update({
              where: { id: record.asset.id },
              data: { status: "AVAILABLE" },
            });
            await tx.assetTransaction.create({
              data: {
                assetId: record.asset.id,
                type: "MAINTENANCE",
                fromStatus: record.asset.status,
                toStatus: "AVAILABLE",
                toSiteId: record.asset.siteId,
                performedById: user.id,
                referenceType: "MAINTENANCE",
                referenceId: record.id,
                previousValue: { status: record.asset.status },
                newValue: { status: "AVAILABLE" },
                notes: "Returned to service",
              },
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
        description: `Maintenance ${record.referenceNo} → ${input.status}`,
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

const OUT_OF_SERVICE_STATUSES = ["REPORTED", "DIAGNOSED", "IN_REPAIR", "AWAITING_PARTS"];
const RELEASED_STATUSES = ["COMPLETED", "RETURNED_TO_SERVICE"];

/**
 * Reconciles an asset's service status with its maintenance ticket.
 * Run after `updateMaintenance`: released tickets free the asset (ASSIGNED while an
 * assignment is still open, otherwise AVAILABLE) and open tickets pull it out of service.
 */
export async function syncMaintenanceAssetStatus(
  maintenanceId: string
): Promise<ActionResult<{ id: string; assetStatus: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.MAINTENANCE_MANAGE);
      const record = await prisma.maintenanceRecord.findUnique({
        where: { id: maintenanceId },
        select: {
          id: true,
          referenceNo: true,
          status: true,
          reportedById: true,
          technicianId: true,
          asset: { select: { id: true, assetTag: true, status: true, siteId: true, assignedEmployeeId: true } },
        },
      });
      if (!record) throw new AppError("Maintenance record not found.", { status: 404 });
      assertSiteAccess(user, record.asset.siteId);

      const active = await prisma.assetAssignment.findFirst({
        where: { assetId: record.asset.id, status: { in: ["ACTIVE", "RETURN_PENDING"] } },
        select: { id: true, employeeId: true },
      });

      let desired: AssetStatus;
      if (OUT_OF_SERVICE_STATUSES.includes(record.status)) {
        desired = "UNDER_MAINTENANCE";
      } else if (RELEASED_STATUSES.includes(record.status)) {
        desired = active ? "ASSIGNED" : "AVAILABLE";
      } else if (active) {
        desired = "ASSIGNED";
      } else {
        desired = ["UNDER_MAINTENANCE", "FOR_REPAIR"].includes(record.asset.status)
          ? "AVAILABLE"
          : record.asset.status;
      }

      const sameEmployee = (record.asset.assignedEmployeeId ?? null) === (active?.employeeId ?? null);
      if (desired === record.asset.status && sameEmployee) {
        return { id: record.id, assetStatus: desired };
      }

      await withTx(async (tx) => {
        await tx.asset.update({
          where: { id: record.asset.id },
          data: { status: desired, assignedEmployeeId: active?.employeeId ?? null },
        });
        await tx.assetTransaction.create({
          data: {
            assetId: record.asset.id,
            type: "MAINTENANCE",
            fromStatus: record.asset.status,
            toStatus: desired,
            toSiteId: record.asset.siteId,
            performedById: user.id,
            referenceType: "MAINTENANCE",
            referenceId: record.id,
            previousValue: { status: record.asset.status },
            newValue: { status: desired },
            notes: `${record.referenceNo} → ${record.status}`,
          },
        });
      });

      await recordAudit({
        userId: user.id,
        action: "MAINTENANCE_UPDATED",
        entityType: "Asset",
        entityId: record.asset.id,
        siteId: record.asset.siteId,
        description: `Asset ${record.asset.assetTag} → ${desired} after ${record.referenceNo} reached ${record.status}`,
        previousValue: { status: record.asset.status },
        newValue: { status: desired },
        ip: await getClientIp(),
      });

      const parties = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          id: { in: [record.reportedById, record.technicianId].filter(Boolean) as string[] },
        },
        select: { id: true },
      });
      await notify({
        userIds: parties.map((p) => p.id),
        type: "MAINTENANCE_UPDATE",
        title: `${record.asset.assetTag} is now ${desired.toLowerCase().replace("_", " ")}`,
        body: `${record.referenceNo} moved to ${record.status.toLowerCase().replace("_", " ")}.`,
        entityType: "MaintenanceRecord",
        entityId: record.id,
        link: `/maintenance/${record.id}`,
      });

      revalidatePath("/maintenance");
      revalidatePath(`/maintenance/${record.id}`);
      revalidatePath(`/assets/${record.asset.id}`);
      return { id: record.id, assetStatus: desired };
    },
    { action: "syncMaintenanceAssetStatus", maintenanceId }
  );
}
