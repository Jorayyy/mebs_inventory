"use server";

import { revalidatePath } from "next/cache";
import { prisma, withTx } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, getClientIp, isGlobal } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { clearEmployeeSchema } from "@/lib/validations/clearance";

const OPEN_ASSIGNMENT_STATUSES = ["ACTIVE", "RETURN_PENDING"] as const;

export type ClearanceCandidate = {
  id: string;
  employeeNo: string;
  label: string;
  jobTitle: string | null;
  employmentStatus: string;
  exitDate: Date | null;
  siteName: string;
  departmentName: string;
  openAssignments: number;
};

/**
 * Employee picker for the clearance desk — unlike `searchEmployees` it includes
 * exiting/exited staff, which is exactly who needs clearing.
 */
export async function searchEmployeesForClearance(query: string, limit = 25): Promise<ClearanceCandidate[]> {
  const user = await requirePermission(
    PERMISSIONS.ASSIGNMENTS_CLEARANCE,
    PERMISSIONS.ASSIGNMENTS_VIEW
  );
  const q = (query ?? "").trim();

  const employees = await prisma.employee.findMany({
    where: {
      ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { employeeNo: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      employmentStatus: true,
      exitDate: true,
      site: { select: { name: true } },
      department: { select: { name: true } },
      _count: {
        select: { assignments: { where: { status: { in: [...OPEN_ASSIGNMENT_STATUSES] } } } },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });

  return employees.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    label: `${e.firstName} ${e.lastName} · ${e.employeeNo}`,
    jobTitle: e.jobTitle,
    employmentStatus: e.employmentStatus,
    exitDate: e.exitDate,
    siteName: e.site.name,
    departmentName: e.department.name,
    openAssignments: e._count.assignments,
  }));
}

/** Employees who still owe assets — the starting list on the clearance desk. */
export async function getClearanceCandidates(limit = 50): Promise<ClearanceCandidate[]> {
  const user = await requirePermission(
    PERMISSIONS.ASSIGNMENTS_CLEARANCE,
    PERMISSIONS.ASSIGNMENTS_VIEW
  );

  const employees = await prisma.employee.findMany({
    where: {
      ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
      deletedAt: null,
      assignments: { some: { status: { in: [...OPEN_ASSIGNMENT_STATUSES] } } },
    },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      employmentStatus: true,
      exitDate: true,
      site: { select: { name: true } },
      department: { select: { name: true } },
      _count: {
        select: { assignments: { where: { status: { in: [...OPEN_ASSIGNMENT_STATUSES] } } } },
      },
    },
    orderBy: [{ exitDate: "asc" }, { lastName: "asc" }],
    take: Math.min(Math.max(limit, 1), 200),
  });

  return employees.map((e) => ({
    id: e.id,
    employeeNo: e.employeeNo,
    label: `${e.firstName} ${e.lastName} · ${e.employeeNo}`,
    jobTitle: e.jobTitle,
    employmentStatus: e.employmentStatus,
    exitDate: e.exitDate,
    siteName: e.site.name,
    departmentName: e.department.name,
    openAssignments: e._count.assignments,
  }));
}

/** Offboarding checklist: open assignments plus stock issued to the employee. */
export async function getClearanceChecklist(employeeId: string) {
  const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_CLEARANCE, PERMISSIONS.ASSIGNMENTS_VIEW);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      employeeNo: true,
      firstName: true,
      lastName: true,
      email: true,
      jobTitle: true,
      employmentStatus: true,
      exitDate: true,
      siteId: true,
      userId: true,
      deletedAt: true,
      site: { select: { id: true, name: true, code: true } },
      department: { select: { id: true, name: true } },
    },
  });
  if (!employee || employee.deletedAt) throw new AppError("Employee not found.", { status: 404 });
  assertSiteAccess(user, employee.siteId);

  const [assignments, transactions] = await Promise.all([
    prisma.assetAssignment.findMany({
      where: { employeeId: employee.id, status: { in: [...OPEN_ASSIGNMENT_STATUSES] } },
      include: {
        asset: {
          select: {
            id: true,
            assetTag: true,
            name: true,
            serialNumber: true,
            condition: true,
            status: true,
            siteId: true,
          },
        },
        assignedBy: { select: { name: true } },
      },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.inventoryTransaction.findMany({
      where: { referenceId: employee.id },
      include: { inventoryItem: { select: { id: true, sku: true, name: true, unit: true } } },
      orderBy: { createdAt: "desc" },
      take: 250,
    }),
  ]);

  assignments.forEach((row) => assertSiteAccess(user, row.asset.siteId));

  const outstanding = new Map<
    string,
    { sku: string; name: string; unit: string; net: number; lastType: string; lastAt: Date }
  >();
  for (const tx of transactions) {
    const key = tx.inventoryItem.id;
    const entry = outstanding.get(key) ?? {
      sku: tx.inventoryItem.sku,
      name: tx.inventoryItem.name,
      unit: tx.inventoryItem.unit,
      net: 0,
      lastType: tx.type,
      lastAt: tx.createdAt,
    };
    entry.net += Number(tx.quantity);
    if (tx.createdAt > entry.lastAt) {
      entry.lastAt = tx.createdAt;
      entry.lastType = tx.type;
    }
    outstanding.set(key, entry);
  }

  return {
    employee: {
      id: employee.id,
      employeeNo: employee.employeeNo,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      jobTitle: employee.jobTitle,
      employmentStatus: employee.employmentStatus,
      exitDate: employee.exitDate,
      site: employee.site,
      department: employee.department,
    },
    assignments: assignments.map((row) => ({
      id: row.id,
      status: row.status,
      assignedAt: row.assignedAt,
      expectedReturnAt: row.expectedReturnAt,
      conditionAtAssignment: row.conditionAtAssignment,
      notes: row.notes,
      assignedBy: row.assignedBy.name,
      asset: row.asset,
    })),
    issues: Array.from(outstanding.entries())
      .filter(([, entry]) => entry.net !== 0)
      .map(([inventoryItemId, entry]) => ({ inventoryItemId, ...entry })),
  };
}

/** One-shot offboarding: closes every open assignment and frees the assets. */
export async function clearEmployee(raw: unknown): Promise<ActionResult<{ returned: number }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ASSIGNMENTS_CLEARANCE);
      const input = clearEmployeeSchema.parse(raw);

      const employee = await prisma.employee.findUnique({
        where: { id: input.employeeId },
        select: {
          id: true,
          employeeNo: true,
          firstName: true,
          lastName: true,
          siteId: true,
          userId: true,
          deletedAt: true,
        },
      });
      if (!employee || employee.deletedAt) throw new AppError("Employee not found.", { status: 404 });
      assertSiteAccess(user, employee.siteId);

      const assignments = await prisma.assetAssignment.findMany({
        where: { employeeId: employee.id, status: { in: [...OPEN_ASSIGNMENT_STATUSES] } },
        include: {
          asset: { select: { id: true, assetTag: true, status: true, siteId: true } },
        },
      });
      if (assignments.length === 0) {
        throw new AppError("This employee has no open assignments to clear.", { code: "NOTHING_TO_CLEAR" });
      }
      assignments.forEach((row) => assertSiteAccess(user, row.asset.siteId));

      const now = new Date();
      const name = `${employee.firstName} ${employee.lastName}`;

      await withTx(async (tx) => {
        for (const assignment of assignments) {
          const released = ["UNDER_MAINTENANCE", "FOR_REPAIR", "RETIRED", "DISPOSED"].includes(
            assignment.asset.status
          );
          const nextAssetStatus = released
            ? assignment.asset.status
            : input.condition === "DAMAGED"
              ? "DAMAGED"
              : "AVAILABLE";

          await tx.assetAssignment.update({
            where: { id: assignment.id },
            data: {
              status: "RETURNED",
              returnedAt: now,
              returnedById: user.id,
              returnCondition: input.condition,
              returnNotes: input.notes || `Clearance for ${name}`,
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
              fromEmployeeId: employee.id,
              fromSiteId: assignment.asset.siteId,
              toSiteId: assignment.asset.siteId,
              performedById: user.id,
              referenceType: "CLEARANCE",
              referenceId: assignment.id,
              previousValue: { status: "ASSIGNED", assignedEmployeeId: employee.id },
              newValue: { status: nextAssetStatus, condition: input.condition },
              notes: input.notes || `Returned during clearance of ${name}`,
            },
          });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "ASSIGNMENT_RETURNED",
        entityType: "Employee",
        entityId: employee.id,
        siteId: employee.siteId,
        description: `Cleared ${assignments.length} assignment(s) for ${name} (${employee.employeeNo})`,
        previousValue: assignments.map((a) => ({ id: a.id, assetId: a.asset.assetTag, status: a.status })),
        newValue: { condition: input.condition, returned: assignments.length },
        ip: await getClientIp(),
      });

      const stewards = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          deletedAt: null,
          OR: [
            { role: { key: { in: ["SUPER_ADMIN", "INVENTORY_ADMIN"] } } },
            { siteScopes: { some: { siteId: employee.siteId } } },
          ],
        },
        select: { id: true },
      });

      await notify({
        userIds: Array.from(
          new Set([...stewards.map((s) => s.id), ...(employee.userId ? [employee.userId] : [])])
        ),
        type: "ASSIGNMENT_RETURNED",
        title: `Clearance completed for ${name}`,
        body: `${assignments.length} asset(s) were returned and freed during offboarding clearance.`,
        entityType: "Employee",
        entityId: employee.id,
        link: "/assignments",
      });

      revalidatePath("/assignments");
      revalidatePath("/assignments/clearance");
      revalidatePath("/assets");
      revalidatePath("/my");
      return { returned: assignments.length };
    },
    { action: "clearEmployee" }
  );
}
