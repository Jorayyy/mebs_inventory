"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, isGlobal, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

import { employeeCreateSchema } from "@/lib/validations/employee";

/** Lightweight picker source used by assignment / transfer forms. */
export async function searchEmployees(query: string, limit = 25) {
  const user = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW);
  const q = (query ?? "").trim();

  const employees = await prisma.employee.findMany({
    where: {
      ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
      deletedAt: null,
      employmentStatus: { not: "EXITED" },
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
      site: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: Math.min(limit, 100),
  });

  return employees.map((e) => ({
    id: e.id,
    label: `${e.firstName} ${e.lastName} · ${e.employeeNo} · ${e.department.name}`,
    firstName: e.firstName,
    lastName: e.lastName,
    employeeNo: e.employeeNo,
    siteName: e.site.name,
    departmentName: e.department.name,
    jobTitle: e.jobTitle,
  }));
}

export async function createEmployee(raw: unknown) {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
      const input = employeeCreateSchema.parse(raw);
      assertSiteAccess(user, input.siteId);

      const company = await prisma.company.findFirstOrThrow({ select: { id: true } });

      const duplicate = await prisma.employee.findFirst({
        where: { companyId: company.id, employeeNo: input.employeeNo },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That employee number already exists.", { code: "DUPLICATE" });

      const employee = await prisma.employee.create({
        data: {
          companyId: company.id,
          employeeNo: input.employeeNo,
          siteId: input.siteId,
          departmentId: input.departmentId,
          teamId: input.teamId || null,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email || null,
          phone: input.phone || null,
          jobTitle: input.jobTitle || null,
          hireDate: input.hireDate ? new Date(input.hireDate) : null,
          employmentStatus: input.employmentStatus,
          notes: input.notes || null,
        },
        include: { site: true, department: true },
      });

      await recordAudit({
        userId: user.id,
        action: "USER_CREATED",
        entityType: "Employee",
        entityId: employee.id,
        siteId: employee.siteId,
        description: `Created employee ${employee.firstName} ${employee.lastName} (${employee.employeeNo})`,
        newValue: { employeeNo: employee.employeeNo, name: `${employee.firstName} ${employee.lastName}` },
        ip: await getClientIp(),
      });

      revalidatePath("/employees");
      return employee;
    },
    { action: "createEmployee" }
  );
}

export async function setEmployeeExit(id: string, exitDate?: string | null) {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.EMPLOYEES_MANAGE);
      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) throw new AppError("Employee not found.", { status: 404 });
      assertSiteAccess(user, employee.siteId);

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          employmentStatus: "EXITED",
          exitDate: exitDate ? new Date(exitDate) : new Date(),
        },
      });

      await recordAudit({
        userId: user.id,
        action: "USER_STATUS_CHANGED",
        entityType: "Employee",
        entityId: id,
        siteId: employee.siteId,
        description: `Marked ${employee.firstName} ${employee.lastName} as exited`,
        previousValue: { employmentStatus: employee.employmentStatus, exitDate: employee.exitDate },
        newValue: { employmentStatus: "EXITED" },
        ip: await getClientIp(),
      });

      revalidatePath("/employees");
      revalidatePath("/assignments");
      revalidatePath(`/employees/${id}`);
      return updated;
    },
    { action: "setEmployeeExit", employeeId: id }
  );
}

export type EmployeeExitSummary = {
  employeeId: string;
  name: string;
  employmentStatus: string;
  hireDate: Date | null;
  exitDate: Date | null;
  linkedUserId: string | null;
  openAssignments: {
    id: string;
    assetId: string;
    assetTag: string;
    assetName: string;
    status: string;
    assignedAt: Date;
    expectedReturnAt: Date | null;
    acknowledgedAt: Date | null;
  }[];
  assignedAssets: { id: string; assetTag: string; name: string; status: string; condition: string }[];
};

/**
 * Everything that must be settled before an employee exits: open assignment
 * rows plus assets still carrying `assignedEmployeeId`. Surfaced by the
 * mark-exit confirmation flow and the clearance card on the profile page.
 */
export async function getEmployeeExitSummary(
  employeeId: string
): Promise<ActionResult<EmployeeExitSummary>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.EMPLOYEES_VIEW);
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employmentStatus: true,
          hireDate: true,
          exitDate: true,
          siteId: true,
          userId: true,
        },
      });
      if (!employee) throw new AppError("Employee not found.", { status: 404 });
      assertSiteAccess(user, employee.siteId);

      const [assignments, assets] = await Promise.all([
        prisma.assetAssignment.findMany({
          where: { employeeId: employee.id, status: { in: ["ACTIVE", "RETURN_PENDING"] } },
          select: {
            id: true,
            assetId: true,
            status: true,
            assignedAt: true,
            expectedReturnAt: true,
            acknowledgedAt: true,
            asset: { select: { assetTag: true, name: true } },
          },
          orderBy: { assignedAt: "desc" },
        }),
        prisma.asset.findMany({
          where: { assignedEmployeeId: employee.id, deletedAt: null },
          select: { id: true, assetTag: true, name: true, status: true, condition: true },
          orderBy: { assetTag: "asc" },
        }),
      ]);

      return {
        employeeId: employee.id,
        name: `${employee.firstName} ${employee.lastName}`,
        employmentStatus: employee.employmentStatus,
        hireDate: employee.hireDate,
        exitDate: employee.exitDate,
        linkedUserId: employee.userId,
        openAssignments: assignments.map((row) => ({
          id: row.id,
          assetId: row.assetId,
          assetTag: row.asset.assetTag,
          assetName: row.asset.name,
          status: row.status,
          assignedAt: row.assignedAt,
          expectedReturnAt: row.expectedReturnAt,
          acknowledgedAt: row.acknowledgedAt,
        })),
        assignedAssets: assets,
      };
    },
    { action: "getEmployeeExitSummary", employeeId }
  );
}
