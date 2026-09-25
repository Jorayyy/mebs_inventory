"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, getSessionUser, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { z } from "zod";

const returnSchema = z.object({
  assignmentIds: z.array(z.string().min(1)).min(1, "Select at least one assignment"),
  condition: z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "POOR", "DAMAGED"]).default("GOOD"),
  outcome: z.enum(["RETURNED", "DAMAGED", "MISSING"]).default("RETURNED"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

const requestReturnSchema = z.object({
  assignmentId: z.string().min(1),
  reason: z.string().max(1000).optional().or(z.literal("")),
});

export type ReturnInput = z.infer<typeof returnSchema>;

/**
 * Closes assignments during a return / clearance / offboarding flow.
 * Writes an immutable RETURN transaction per asset and updates status.
 */
export async function returnAssets(raw: unknown): Promise<ActionResult<{ processed: number }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_RETURN);
      const input = returnSchema.parse(raw);

      const assignments = await prisma.assetAssignment.findMany({
        where: { id: { in: input.assignmentIds }, status: { in: ["ACTIVE", "RETURN_PENDING"] } },
        include: {
          asset: { select: { id: true, assetTag: true, status: true, siteId: true, assignedEmployeeId: true } },
          employee: { select: { id: true, firstName: true, lastName: true, siteId: true } },
        },
      });
      if (assignments.length === 0) throw new AppError("No open assignments matched.");
      assignments.forEach((a) => assertSiteAccess(user, a.asset.siteId));

      const nextAssetStatus =
        input.outcome === "MISSING" ? "LOST" : input.outcome === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        for (const assignment of assignments) {
          await tx.assetAssignment.update({
            where: { id: assignment.id },
            data: {
              status: input.outcome,
              returnedAt: now,
              returnedById: user.id,
              returnCondition: input.condition,
              returnNotes: input.notes || null,
            },
          });
          await tx.asset.update({
            where: { id: assignment.asset.id },
            data: {
              status: nextAssetStatus as never,
              condition: input.condition,
              assignedEmployeeId: null,
            },
          });
          await tx.assetTransaction.create({
            data: {
              assetId: assignment.asset.id,
              type: "RETURN",
              fromStatus: "ASSIGNED",
              toStatus: nextAssetStatus as never,
              fromEmployeeId: assignment.employeeId,
              fromSiteId: assignment.asset.siteId,
              toSiteId: assignment.asset.siteId,
              performedById: user.id,
              referenceType: "ASSIGNMENT",
              referenceId: assignment.id,
              previousValue: { status: "ASSIGNED", assignedEmployeeId: assignment.employeeId },
              newValue: { status: nextAssetStatus, condition: input.condition },
              notes: input.notes || `Returned by ${assignment.employee.firstName} ${assignment.employee.lastName}`,
            },
          });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "ASSIGNMENT_RETURNED",
        entityType: "AssetAssignment",
        entityId: input.assignmentIds.join(","),
        description: `Returned ${assignments.length} asset(s) — outcome ${input.outcome}`,
        previousValue: assignments.map((a) => ({ id: a.id, status: a.status })),
        newValue: { outcome: input.outcome, condition: input.condition },
        ip: await getClientIp(),
      });

      await notify({
        userIds: [assignments[0].asset.assignedEmployeeId].filter(Boolean) as string[],
        type: "ASSIGNMENT_RETURNED",
        title: `Asset return recorded (${input.outcome})`,
        body: input.notes || "Thank you — your equipment return has been logged.",
        entityType: "AssetAssignment",
        entityId: input.assignmentIds[0],
        link: "/my",
      });

      revalidatePath("/assignments");
      revalidatePath("/assets");
      revalidatePath("/my");
      return { processed: assignments.length };
    },
    { action: "returnAssets" }
  );
}

/** Employee-initiated return request → moves the assignment to RETURN_PENDING. */
export async function requestAssetReturn(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.SELF_SERVICE_REQUEST);
      const input = requestReturnSchema.parse(raw);

      const assignment = await prisma.assetAssignment.findUnique({
        where: { id: input.assignmentId },
        include: { asset: true, employee: true },
      });
      if (!assignment) throw new AppError("Assignment not found.", { status: 404 });
      if (assignment.status !== "ACTIVE") {
        throw new AppError("This assignment is not active.");
      }

      const employee = await prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!employee || employee.id !== assignment.employeeId) {
        throw new AppError("You can only request a return for your own assets.", {
          status: 403,
          code: "FORBIDDEN",
        });
      }

      await prisma.assetAssignment.update({
        where: { id: assignment.id },
        data: { status: "RETURN_PENDING", notes: input.reason || assignment.notes },
      });

      await recordAudit({
        userId: user.id,
        action: "ASSIGNMENT_RETURNED",
        entityType: "AssetAssignment",
        entityId: assignment.id,
        siteId: assignment.asset.siteId,
        description: `Return requested for ${assignment.asset.assetTag}`,
        previousValue: { status: assignment.status },
        newValue: { status: "RETURN_PENDING" },
        ip: await getClientIp(),
      });

      const stewards = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          role: { key: { in: ["INVENTORY_ADMIN", "SITE_ADMIN", "INVENTORY_STAFF"] } },
        },
        select: { id: true },
      });
      await notify({
        userIds: stewards.map((s) => s.id),
        type: "ASSIGNMENT_RETURN_DUE",
        title: `Return requested: ${assignment.asset.assetTag}`,
        body: `${employee.firstName} ${employee.lastName} requested to return this asset.`,
        entityType: "AssetAssignment",
        entityId: assignment.id,
        link: `/assignments`,
      });

      revalidatePath("/my");
      revalidatePath("/assignments");
      return { id: assignment.id };
    },
    { action: "requestAssetReturn" }
  );
}

/** Employee acknowledges an assignment (signature substitute). */
export async function acknowledgeAssignment(assignmentId: string): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.SELF_SERVICE_REQUEST);
      const assignment = await prisma.assetAssignment.findUnique({
        where: { id: assignmentId },
        select: { id: true, status: true, employee: { select: { userId: true } } },
      });
      if (!assignment) throw new AppError("Assignment not found.", { status: 404 });
      if (assignment.employee.userId !== user.id) {
        throw new AppError("You can only acknowledge your own assignments.", { status: 403 });
      }

      await prisma.assetAssignment.update({
        where: { id: assignmentId },
        data: { acknowledgedAt: new Date() },
      });

      await recordAudit({
        userId: user.id,
        action: "ASSIGNMENT_ACKNOWLEDGED",
        entityType: "AssetAssignment",
        entityId: assignmentId,
        description: "Employee acknowledged asset assignment",
        ip: await getClientIp(),
      });

      revalidatePath("/my");
      return { id: assignmentId };
    },
    { action: "acknowledgeAssignment", assignmentId }
  );
}

/** Reports a damaged / lost asset from the self-service portal. */
export async function reportAssetIssue(raw: unknown) {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.SELF_SERVICE_REQUEST);
      const input = z
        .object({
          assetId: z.string().min(1),
          kind: z.enum(["DAMAGED", "LOST"]),
          details: z.string().min(5, "Describe the issue").max(2000),
        })
        .parse(raw);

      const employee = await prisma.employee.findUnique({ where: { userId: user.id } });
      if (!employee) throw new AppError("No employee profile is linked to your account.", { status: 403 });

      const assignment = await prisma.assetAssignment.findFirst({
        where: { assetId: input.assetId, employeeId: employee.id, status: { in: ["ACTIVE", "RETURN_PENDING"] } },
        select: { id: true },
      });
      if (!assignment) throw new AppError("This asset is not assigned to you.", { status: 403 });

      const asset = await prisma.asset.update({
        where: { id: input.assetId },
        data: { status: input.kind },
        select: { id: true, assetTag: true, siteId: true, status: true },
      });

      await prisma.assetTransaction.create({
        data: {
          assetId: asset.id,
          type: "ADJUSTMENT",
          toStatus: input.kind,
          toSiteId: asset.siteId,
          performedById: user.id,
          referenceType: "SELF_SERVICE",
          newValue: { status: input.kind },
          notes: input.details,
        },
      });

      await prisma.maintenanceRecord.create({
        data: {
          assetId: asset.id,
          referenceNo: `RPT-${Date.now().toString(36).toUpperCase()}`,
          issue: input.kind === "LOST" ? `Reported lost: ${input.details}` : `Damage report: ${input.details}`,
          reportedById: user.id,
          status: "REPORTED",
        },
      });

      await recordAudit({
        userId: user.id,
        action: input.kind === "LOST" ? "ASSET_STATUS_CHANGED" : "ASSET_STATUS_CHANGED",
        entityType: "Asset",
        entityId: asset.id,
        siteId: asset.siteId,
        description: `Employee reported ${input.kind.toLowerCase()} for ${asset.assetTag}`,
        newValue: { status: input.kind, details: input.details },
        ip: await getClientIp(),
      });

      const stewards = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          role: { key: { in: ["INVENTORY_ADMIN", "SITE_ADMIN", "TECHNICIAN"] } },
        },
        select: { id: true },
      });
      await notify({
        userIds: stewards.map((s) => s.id),
        type: input.kind === "LOST" ? "ASSET_LOST" : "ASSET_DAMAGED",
        title: `${input.kind === "LOST" ? "Lost" : "Damaged"}: ${asset.assetTag}`,
        body: input.details,
        entityType: "Asset",
        entityId: asset.id,
        link: `/assets/${asset.id}`,
      });

      revalidatePath("/my");
      revalidatePath("/assets");
      return { assetId: asset.id };
    },
    { action: "reportAssetIssue" }
  );
}

/** Clearance helper: every open assignment for an employee. */
export async function getEmployeeOpenAssignments(employeeId: string) {
  await requirePermission(PERMISSIONS.ASSIGNMENTS_VIEW);
  return prisma.assetAssignment.findMany({
    where: { employeeId, status: { in: ["ACTIVE", "RETURN_PENDING"] } },
    include: {
      asset: { select: { id: true, assetTag: true, name: true, condition: true, status: true } },
      assignedBy: { select: { name: true } },
    },
    orderBy: { assignedAt: "desc" },
  });
}

/** Single assignment with its asset ledger excerpt — drives the detail drawer. */
export async function getAssignmentDetail(assignmentId: string) {
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_VIEW);

  const assignment = await prisma.assetAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      asset: {
        select: {
          id: true,
          assetTag: true,
          name: true,
          serialNumber: true,
          status: true,
          condition: true,
          siteId: true,
          site: { select: { id: true, name: true, code: true } },
          department: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
      employee: {
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          jobTitle: true,
          email: true,
          employmentStatus: true,
          department: { select: { name: true } },
        },
      },
      assignedBy: { select: { id: true, name: true } },
      returnedBy: { select: { id: true, name: true } },
    },
  });
  if (!assignment) throw new AppError("Assignment not found.", { status: 404 });
  assertSiteAccess(user, assignment.asset.siteId);

  const transactions = await prisma.assetTransaction.findMany({
    where: { assetId: assignment.assetId },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      notes: true,
      createdAt: true,
      performedBy: { select: { name: true } },
      toEmployee: { select: { firstName: true, lastName: true } },
      fromEmployee: { select: { firstName: true, lastName: true } },
    },
  });

  return { assignment, transactions };
}

export { getSessionUser };
