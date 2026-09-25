"use server";

import { revalidatePath } from "next/cache";
import { prisma, withTx } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, isGlobal, getClientIp, type SessionUser } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit, snapshot } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { nextAssetTag } from "@/lib/ids";
import { assetCreateSchema, assetUpdateSchema, assetStatusChangeSchema, assetAssignmentSchema } from "@/lib/validations/asset";
import type { Asset, Prisma } from "@/generated/prisma";
import { logger } from "@/lib/logger";

type AssetInclude = Prisma.AssetInclude;

const ASSET_INCLUDE: AssetInclude = {
  category: true,
  itemType: true,
  site: true,
  room: { include: { floor: { include: { building: true } } } },
  stockLocation: true,
  department: true,
  assignedEmployee: true,
  supplier: true,
  costCenter: true,
};

function numberOrNull(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveCompanyId(): Promise<string> {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) throw new AppError("No company is configured. Contact your administrator.", { status: 500 });
  return company.id;
}

async function assertUniqueTag(
  companyId: string,
  assetTag: string,
  ignoreId?: string
): Promise<void> {
  const existing = await prisma.asset.findFirst({
    where: { companyId, assetTag, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new AppError("That asset tag is already in use.", { code: "DUPLICATE_TAG" });
}

async function assertUniqueSerial(
  companyId: string,
  serialNumber: string | null | undefined,
  ignoreId?: string
): Promise<void> {
  if (!serialNumber) return;
  const existing = await prisma.asset.findFirst({
    where: {
      companyId,
      serialNumber,
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
    },
    select: { assetTag: true },
  });
  if (existing) {
    throw new AppError(`Serial number already registered to ${existing.assetTag}.`, {
      code: "DUPLICATE_SERIAL",
    });
  }
}

/** Reads request context for audit records. */
async function auditContext() {
  return { ip: await getClientIp() };
}

export async function createAsset(raw: unknown): Promise<ActionResult<Asset>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSETS_CREATE);
      const input = assetCreateSchema.parse(raw);
      assertSiteAccess(user, input.siteId);

      const companyId = await resolveCompanyId();
      const site = await prisma.site.findUnique({ where: { id: input.siteId }, select: { code: true } });
      if (!site) throw new AppError("Site not found.", { status: 404 });
      const category = await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { tagPrefix: true },
      });
      const itemType = input.itemTypeId
        ? await prisma.itemType.findUnique({
            where: { id: input.itemTypeId },
            select: { tagPrefix: true },
          })
        : null;

      const suppliedTag = input.assetTag?.trim().toUpperCase() ?? "";
      if (suppliedTag) await assertUniqueTag(companyId, suppliedTag);
      await assertUniqueSerial(companyId, input.serialNumber);

      const prefix = (itemType?.tagPrefix || category?.tagPrefix || "AST").toUpperCase();
      const purchasePrice = numberOrNull(input.purchasePrice);
      const warrantyMonths = numberOrNull(input.warrantyMonths);
      const purchaseDate = dateOrNull(input.purchaseDate);
      const warrantyStart = dateOrNull(input.warrantyStart) ?? purchaseDate;

      let asset: Asset | null = null;
      let attempts = 0;
      while (!asset && attempts < 3) {
        attempts += 1;
        try {
          asset = await prisma.$transaction(
            async (tx) => {
          // Tag sequence is allocated inside the transaction; unique constraint is the
          // final arbiter, so a concurrent insert triggers one retry below.
          const assetTag = suppliedTag || (await nextAssetTag(tx, companyId, prefix, site.code));

          const created = await tx.asset.create({
            data: {
              companyId,
              assetTag,
              barcode: input.barcode || null,
              qrCode: assetTag,
              serialNumber: input.serialNumber || null,
              name: input.name,
              description: input.description || null,
              categoryId: input.categoryId,
              itemTypeId: input.itemTypeId || null,
              manufacturer: input.manufacturer || null,
              brand: input.brand || null,
              model: input.model || null,
              purchaseDate,
              purchasePrice,
              supplierId: input.supplierId || null,
              warrantyStart,
              warrantyEnd:
                warrantyStart && warrantyMonths
                  ? new Date(warrantyStart.getTime() + warrantyMonths * 30.44 * 86_400_000)
                  : null,
              warrantyMonths,
              siteId: input.siteId,
              roomId: input.roomId || null,
              stockLocationId: input.stockLocationId || null,
              departmentId: input.departmentId || null,
              costCenterId: input.costCenterId || null,
              status: input.status,
              condition: input.condition,
              notes: input.notes || null,
              createdById: user.id,
              receivedAt: new Date(),
            },
            include: ASSET_INCLUDE,
          });

          await tx.assetTransaction.create({
            data: {
              assetId: created.id,
              type: "RECEIVE",
              toStatus: created.status,
              toSiteId: created.siteId,
              performedById: user.id,
              referenceType: "MANUAL",
              newValue: { status: created.status, condition: created.condition },
              notes: input.notes || "Asset registered",
            },
          });

          return created;
        },
        { isolationLevel: "ReadCommitted" }
          );
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (code === "P2002" && attempts < 3) continue;
          throw error;
        }
      }
      if (!asset) throw new AppError("Could not allocate a unique asset tag. Please retry.");

      await recordAudit({
        userId: user.id,
        action: "ASSET_CREATED",
        entityType: "Asset",
        entityId: asset.id,
        siteId: asset.siteId,
        description: `Created asset ${asset.assetTag}`,
        newValue: snapshot(asset, ["assetTag", "name", "serialNumber", "status", "condition", "siteId"]),
        ...(await auditContext()),
      });

      logger.info("asset.created", { assetId: asset.id, assetTag: asset.assetTag, userId: user.id });
      revalidatePath("/assets");
      revalidatePath("/dashboard");
      return asset;
    },
    { action: "createAsset" }
  );
}

export async function updateAsset(raw: unknown): Promise<ActionResult<Asset>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSETS_UPDATE);
      const input = assetUpdateSchema.parse(raw);

      const existing = await prisma.asset.findUnique({ where: { id: input.id } });
      if (!existing || existing.deletedAt) {
        throw new AppError("Asset not found.", { status: 404, code: "NOT_FOUND" });
      }
      assertSiteAccess(user, existing.siteId);
      if (input.siteId) assertSiteAccess(user, input.siteId);

      const companyId = existing.companyId;
      await assertUniqueTag(companyId, input.assetTag ?? existing.assetTag, existing.id);
      await assertUniqueSerial(companyId, input.serialNumber ?? existing.serialNumber, existing.id);

      const purchasePrice = input.purchasePrice !== undefined ? numberOrNull(input.purchasePrice) : undefined;
      const warrantyMonths = input.warrantyMonths !== undefined ? numberOrNull(input.warrantyMonths) : undefined;

      const before = snapshot(existing, [
        "name",
        "status",
        "condition",
        "siteId",
        "departmentId",
        "roomId",
        "serialNumber",
        "assetTag",
        "model",
        "notes",
      ]);

      const asset = await prisma.$transaction(async (tx) => {
        const updated = await tx.asset.update({
          where: { id: existing.id },
          data: {
            assetTag: input.assetTag ? input.assetTag.toUpperCase() : undefined,
            barcode: input.barcode !== undefined ? input.barcode || null : undefined,
            name: input.name ?? undefined,
            description: input.description !== undefined ? input.description || null : undefined,
            categoryId: input.categoryId || undefined,
            itemTypeId: input.itemTypeId !== undefined ? input.itemTypeId || null : undefined,
            manufacturer: input.manufacturer !== undefined ? input.manufacturer || null : undefined,
            brand: input.brand !== undefined ? input.brand || null : undefined,
            model: input.model !== undefined ? input.model || null : undefined,
            serialNumber: input.serialNumber !== undefined ? input.serialNumber || null : undefined,
            purchaseDate: input.purchaseDate !== undefined ? dateOrNull(input.purchaseDate) : undefined,
            purchasePrice,
            supplierId: input.supplierId !== undefined ? input.supplierId || null : undefined,
            warrantyMonths,
            siteId: input.siteId ?? undefined,
            roomId: input.roomId !== undefined ? input.roomId || null : undefined,
            stockLocationId:
              input.stockLocationId !== undefined ? input.stockLocationId || null : undefined,
            departmentId: input.departmentId !== undefined ? input.departmentId || null : undefined,
            costCenterId: input.costCenterId !== undefined ? input.costCenterId || null : undefined,
            status: input.status ?? undefined,
            condition: input.condition ?? undefined,
            notes: input.notes !== undefined ? input.notes || null : undefined,
          },
          include: ASSET_INCLUDE,
        });

        const statusChanged = updated.status !== existing.status || updated.siteId !== existing.siteId;
        if (statusChanged || updated.condition !== existing.condition) {
          await tx.assetTransaction.create({
            data: {
              assetId: updated.id,
              type: "ADJUSTMENT",
              fromStatus: existing.status,
              toStatus: updated.status,
              fromSiteId: existing.siteId,
              toSiteId: updated.siteId,
              performedById: user.id,
              previousValue: { status: existing.status, condition: existing.condition },
              newValue: { status: updated.status, condition: updated.condition },
              notes: "Asset record updated",
            },
          });
        }
        return updated;
      });

      await recordAudit({
        userId: user.id,
        action: "ASSET_UPDATED",
        entityType: "Asset",
        entityId: asset.id,
        siteId: asset.siteId,
        description: `Updated asset ${asset.assetTag}`,
        previousValue: before,
        newValue: snapshot(asset, Object.keys(before) as (keyof Asset)[]),
        ...(await auditContext()),
      });

      revalidatePath("/assets");
      revalidatePath(`/assets/${asset.id}`);
      return asset;
    },
    { action: "updateAsset", assetId: String((raw as { id?: string })?.id ?? "") }
  );
}

export async function deleteAsset(id: string): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSETS_DELETE);
      const asset = await prisma.asset.findUnique({ where: { id } });
      if (!asset || asset.deletedAt) throw new AppError("Asset not found.", { status: 404 });
      assertSiteAccess(user, asset.siteId);

      if (asset.status === "ASSIGNED") {
        throw new AppError("Return this asset before deleting it.", { code: "ASSIGNED" });
      }

      await prisma.asset.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });

      await recordAudit({
        userId: user.id,
        action: "ASSET_DELETED",
        entityType: "Asset",
        entityId: asset.id,
        siteId: asset.siteId,
        description: `Soft-deleted asset ${asset.assetTag}`,
        previousValue: { status: asset.status, deletedAt: null },
        newValue: { deletedAt: new Date().toISOString() },
        ...(await auditContext()),
      });

      revalidatePath("/assets");
      return { id };
    },
    { action: "deleteAsset", assetId: id }
  );
}

export async function changeAssetStatus(raw: unknown): Promise<ActionResult<{ updated: number }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSETS_UPDATE);
      const input = assetStatusChangeSchema.parse(raw);

      const assets = await prisma.asset.findMany({
        where: { id: { in: input.ids }, deletedAt: null },
        select: { id: true, assetTag: true, status: true, condition: true, siteId: true },
      });
      if (assets.length === 0) throw new AppError("No matching assets found.");
      assets.forEach((a) => assertSiteAccess(user, a.siteId));

      await prisma.$transaction(async (tx) => {
        await tx.asset.updateMany({
          where: { id: { in: assets.map((a) => a.id) } },
          data: { status: input.status, condition: input.condition ?? undefined },
        });
        for (const asset of assets) {
          await tx.assetTransaction.create({
            data: {
              assetId: asset.id,
              type: "ADJUSTMENT",
              fromStatus: asset.status,
              toStatus: input.status,
              fromSiteId: asset.siteId,
              toSiteId: asset.siteId,
              performedById: user.id,
              previousValue: { status: asset.status, condition: asset.condition },
              newValue: { status: input.status, condition: input.condition ?? asset.condition },
              notes: input.notes || "Bulk status change",
            },
          });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "ASSET_STATUS_CHANGED",
        entityType: "Asset",
        entityId: input.ids.join(","),
        description: `Changed status of ${assets.length} asset(s) to ${input.status}`,
        previousValue: assets.map((a) => ({ id: a.id, status: a.status })),
        newValue: { status: input.status, condition: input.condition },
        ...(await auditContext()),
      });

      revalidatePath("/assets");
      return { updated: assets.length };
    },
    { action: "changeAssetStatus" }
  );
}

export async function assignAssets(raw: unknown): Promise<ActionResult<{ assigned: number }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSETS_ASSIGN);
      const input = assetAssignmentSchema.parse(raw);

      const employee = await prisma.employee.findUnique({
        where: { id: input.employeeId },
        select: { id: true, siteId: true, firstName: true, lastName: true, employmentStatus: true, deletedAt: true },
      });
      if (!employee || employee.deletedAt) throw new AppError("Employee not found.", { status: 404 });
      if (employee.employmentStatus === "EXITED") {
        throw new AppError("Cannot assign assets to an exited employee.", { code: "EMPLOYEE_EXITED" });
      }
      assertSiteAccess(user, employee.siteId);

      const assets = await prisma.asset.findMany({
        where: { id: { in: input.assetIds }, deletedAt: null },
        select: { id: true, assetTag: true, status: true, siteId: true, assignedEmployeeId: true },
      });
      if (assets.length === 0) throw new AppError("No matching assets selected.");

      const blocking = assets.filter(
        (a) => a.status === "ASSIGNED" || a.status === "DISPOSED" || a.status === "RETIRED" || a.status === "LOST"
      );
      if (blocking.length > 0) {
        throw new AppError(
          `Unavailable: ${blocking.map((b) => b.assetTag).join(", ")}. Only available/storage assets can be assigned.`,
          { code: "UNAVAILABLE" }
        );
      }

      const expectedReturnAt = input.expectedReturnAt ? new Date(input.expectedReturnAt) : null;
      const condition = input.conditionAtAssignment;

      await prisma.$transaction(async (tx) => {
        for (const asset of assets) {
          await tx.assetAssignment.create({
            data: {
              assetId: asset.id,
              employeeId: employee.id,
              assignedById: user.id,
              siteId: asset.siteId,
              conditionAtAssignment: condition,
              expectedReturnAt,
              status: "ACTIVE",
              notes: input.notes || null,
            },
          });
          await tx.asset.update({
            where: { id: asset.id },
            data: { status: "ASSIGNED", assignedEmployeeId: employee.id, condition },
          });
          await tx.assetTransaction.create({
            data: {
              assetId: asset.id,
              type: "ASSIGN",
              fromStatus: asset.status,
              toStatus: "ASSIGNED",
              fromSiteId: asset.siteId,
              toSiteId: asset.siteId,
              toEmployeeId: employee.id,
              performedById: user.id,
              previousValue: { status: asset.status, assignedEmployeeId: asset.assignedEmployeeId },
              newValue: { status: "ASSIGNED", assignedEmployeeId: employee.id },
              notes: input.notes || `Assigned to ${employee.firstName} ${employee.lastName}`,
            },
          });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "ASSIGNMENT_CREATED",
        entityType: "AssetAssignment",
        entityId: input.assetIds.join(","),
        siteId: employee.siteId,
        description: `Assigned ${assets.length} asset(s) to ${employee.firstName} ${employee.lastName}`,
        newValue: { employeeId: employee.id, assetIds: input.assetIds, condition },
        ...(await auditContext()),
      });

      revalidatePath("/assets");
      revalidatePath("/assignments");
      revalidatePath("/my");
      return { assigned: assets.length };
    },
    { action: "assignAssets" }
  );
}

/** Regenerates the QR payload for an asset (e.g. after a tag change). */
export async function regenerateAssetQr(assetId: string): Promise<ActionResult<{ qrCode: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSETS_UPDATE);
      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw new AppError("Asset not found.", { status: 404 });
      assertSiteAccess(user, asset.siteId);

      await prisma.asset.update({ where: { id: assetId }, data: { qrCode: asset.assetTag } });
      await recordAudit({
        userId: user.id,
        action: "ASSET_UPDATED",
        entityType: "Asset",
        entityId: assetId,
        siteId: asset.siteId,
        description: `Regenerated QR code for ${asset.assetTag}`,
        ...(await auditContext()),
      });
      return { qrCode: asset.assetTag };
    },
    { action: "regenerateAssetQr", assetId }
  );
}

/** Site-scoped asset lookup used by pickers (assign / transfer / label printing). */
export async function searchAssetsForPicker(
  query: string,
  limit = 20
): Promise<{ id: string; assetTag: string; name: string; status: string }[]> {
  const user = await requirePermission(PERMISSIONS.ASSETS_VIEW);
  const scope = isGlobal(user) ? {} : { siteId: { in: user.siteIds } };
  const q = query.trim();
  if (q.length < 2) return [];

  const assets = await prisma.asset.findMany({
    where: {
      ...scope,
      deletedAt: null,
      OR: [
        { assetTag: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, assetTag: true, name: true, status: true },
    take: Math.min(limit, 50),
    orderBy: { assetTag: "asc" },
  });
  return assets;
}

export type { SessionUser };
