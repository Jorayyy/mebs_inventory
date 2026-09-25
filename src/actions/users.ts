"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS, ALL_PERMISSIONS, type RoleKey } from "@/lib/permissions";

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  password: z.string().min(8, "At least 8 characters").max(200),
  roleKey: z.string().trim().min(1, "Role is required"),
  siteIds: z.array(z.string().min(1)).default([]),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "OFFBOARDED"]).default("ACTIVE"),
});

const userStatusSchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED", "OFFBOARDED"]),
});

const userRoleSchema = z.object({
  userId: z.string().min(1),
  roleKey: z.string().trim().min(1),
});

const userSiteScopesSchema = z.object({
  userId: z.string().min(1),
  siteIds: z.array(z.string().min(1)),
});

const rolePermissionsSchema = z.object({
  roleKey: z.string().trim().min(1),
  permissionKeys: z.array(z.string().min(1)),
});

async function ensureRole(roleKey: string) {
  const existing = await prisma.role.findUnique({ where: { key: roleKey } });
  if (existing) return existing;

  const definition = ROLE_DEFINITIONS[roleKey as RoleKey];
  if (!definition) throw new AppError("Unknown role.", { status: 404, code: "UNKNOWN_ROLE" });
  return prisma.role.create({
    data: { key: roleKey, name: definition.name, description: definition.description, isSystem: true },
  });
}

async function assertNotLastSuperAdmin(targetUserId: string) {
  const superAdmins = await prisma.user.count({
    where: { role: { key: "SUPER_ADMIN" }, status: "ACTIVE", deletedAt: null },
  });
  if (superAdmins <= 1) {
    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: { select: { key: true } } },
    });
    if (target?.role.key === "SUPER_ADMIN") {
      throw new AppError("This is the only active Super Admin. Promote another user first.", {
        code: "LAST_ADMIN",
      });
    }
  }
}

/** Creates a user account with hashed credentials and optional site scopes. */
export async function createUser(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.USERS_MANAGE);
      const input = createUserSchema.parse(raw);

      if (!ROLE_KEYS.includes(input.roleKey as RoleKey)) {
        throw new AppError("Unknown role.", { status: 404, code: "UNKNOWN_ROLE" });
      }
      input.siteIds.forEach((siteId) => assertSiteAccess(user, siteId));

      const duplicate = await prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (duplicate) throw new AppError("An account with that email already exists.", { code: "DUPLICATE" });

      const role = await ensureRole(input.roleKey);
      const passwordHash = await bcrypt.hash(input.password, 12);

      const created = await prisma.$transaction(async (tx) => {
        const account = await tx.user.create({
          data: {
            name: input.name,
            email: input.email,
            passwordHash,
            roleId: role.id,
            status: input.status,
            employeeNumber: null,
          },
          select: { id: true, email: true, name: true },
        });
        if (input.siteIds.length > 0) {
          await tx.userSite.createMany({
            data: input.siteIds.map((siteId) => ({ userId: account.id, siteId })),
            skipDuplicates: true,
          });
        }
        return account;
      });

      await recordAudit({
        userId: user.id,
        action: "USER_CREATED",
        entityType: "User",
        entityId: created.id,
        description: `Created user ${created.name} (${created.email}) with role ${role.key}`,
        newValue: { email: created.email, name: created.name, roleKey: role.key, siteIds: input.siteIds, status: input.status },
        ip: await getClientIp(),
      });

      revalidatePath("/settings/users");
      return { id: created.id };
    },
    { action: "createUser" }
  );
}

/** Activates / suspends / offboards an account. Self-service changes are rejected. */
export async function setUserStatus(raw: unknown): Promise<ActionResult<{ id: string; status: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.USERS_MANAGE);
      const input = userStatusSchema.parse(raw);

      if (input.userId === user.id) {
        throw new AppError("You cannot change your own account status.", { code: "SELF_CHANGE" });
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, status: true, deletedAt: true, role: { select: { key: true } } },
      });
      if (!target || target.deletedAt) throw new AppError("User not found.", { status: 404 });
      if (input.status !== "ACTIVE" && target.role.key === "SUPER_ADMIN") {
        await assertNotLastSuperAdmin(target.id);
      }

      await prisma.user.update({ where: { id: target.id }, data: { status: input.status } });

      await recordAudit({
        userId: user.id,
        action: "USER_STATUS_CHANGED",
        entityType: "User",
        entityId: target.id,
        description: `Changed ${target.name}'s status from ${target.status} to ${input.status}`,
        previousValue: { status: target.status },
        newValue: { status: input.status },
        ip: await getClientIp(),
      });

      revalidatePath("/settings/users");
      return { id: target.id, status: input.status };
    },
    { action: "setUserStatus" }
  );
}

/** Moves a user to another role. Changing your own role is rejected. */
export async function changeUserRole(raw: unknown): Promise<ActionResult<{ id: string; roleKey: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.USERS_MANAGE);
      const input = userRoleSchema.parse(raw);

      if (input.userId === user.id) {
        throw new AppError("You cannot change your own role.", { code: "SELF_CHANGE" });
      }
      if (!ROLE_KEYS.includes(input.roleKey as RoleKey)) {
        throw new AppError("Unknown role.", { status: 404, code: "UNKNOWN_ROLE" });
      }

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, roleId: true, deletedAt: true, role: { select: { key: true } } },
      });
      if (!target || target.deletedAt) throw new AppError("User not found.", { status: 404 });
      if (target.role.key === "SUPER_ADMIN") await assertNotLastSuperAdmin(target.id);

      const role = await ensureRole(input.roleKey);
      if (role.id === target.roleId) return { id: target.id, roleKey: role.key };

      await prisma.user.update({ where: { id: target.id }, data: { roleId: role.id } });

      await recordAudit({
        userId: user.id,
        action: "ROLE_CHANGED",
        entityType: "User",
        entityId: target.id,
        description: `Changed ${target.name}'s role from ${target.role.key} to ${role.key}`,
        previousValue: { roleKey: target.role.key },
        newValue: { roleKey: role.key },
        ip: await getClientIp(),
      });

      revalidatePath("/settings/users");
      return { id: target.id, roleKey: role.key };
    },
    { action: "changeUserRole" }
  );
}

/** Replaces the site scope rows attached to a user. */
export async function setUserSiteScopes(raw: unknown): Promise<ActionResult<{ id: string; count: number }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.USERS_MANAGE);
      const input = userSiteScopesSchema.parse(raw);
      input.siteIds.forEach((siteId) => assertSiteAccess(user, siteId));

      const target = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, deletedAt: true },
      });
      if (!target || target.deletedAt) throw new AppError("User not found.", { status: 404 });

      const previous = await prisma.userSite.findMany({
        where: { userId: target.id },
        select: { siteId: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.userSite.deleteMany({ where: { userId: target.id } });
        if (input.siteIds.length > 0) {
          await tx.userSite.createMany({
            data: input.siteIds.map((siteId) => ({ userId: target.id, siteId })),
            skipDuplicates: true,
          });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "USER_UPDATED",
        entityType: "User",
        entityId: target.id,
        description: `Updated site scopes for ${target.name}`,
        previousValue: { siteIds: previous.map((p) => p.siteId) },
        newValue: { siteIds: input.siteIds },
        ip: await getClientIp(),
      });

      revalidatePath("/settings/users");
      return { id: target.id, count: input.siteIds.length };
    },
    { action: "setUserSiteScopes" }
  );
}

/**
 * Writes the Role ↔ Permission rows for a role (grants on top of the read-only
 * ROLE_DEFINITIONS baseline). Every change is audited as PERMISSION_CHANGED.
 */
export async function setRoleCustomPermissions(raw: unknown): Promise<ActionResult<{ roleKey: string; count: number }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ROLES_MANAGE);
      const input = rolePermissionsSchema.parse(raw);

      const invalid = input.permissionKeys.filter(
        (key) => !ALL_PERMISSIONS.includes(key as never)
      );
      if (invalid.length > 0) {
        throw new AppError(`Unknown permission${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`, {
          code: "UNKNOWN_PERMISSION",
        });
      }

      const role = await ensureRole(input.roleKey);
      const existing = await prisma.rolePermission.findMany({
        where: { roleId: role.id },
        select: { id: true, permissionId: true, permission: { select: { key: true } } },
      });
      const existingKeys = new Set(existing.map((row) => row.permission.key));

      const desired = new Set(input.permissionKeys);
      const keysToAdd = input.permissionKeys.filter((key) => !existingKeys.has(key));
      const rowsToRemove = existing.filter((row) => !desired.has(row.permission.key));

      await prisma.$transaction(async (tx) => {
        if (rowsToRemove.length > 0) {
          await tx.rolePermission.deleteMany({ where: { id: { in: rowsToRemove.map((r) => r.id) } } });
        }
        for (const key of keysToAdd) {
          const permission = await tx.permission.upsert({
            where: { key },
            create: { key, name: key, group: key.split(".")[0] },
            update: {},
          });
          await tx.rolePermission.create({
            data: { roleId: role.id, permissionId: permission.id },
          });
        }
      });

      await recordAudit({
        userId: user.id,
        action: "PERMISSION_CHANGED",
        entityType: "Role",
        entityId: role.id,
        description: `Updated permissions for ${role.key}: +${keysToAdd.length} / -${rowsToRemove.length}`,
        previousValue: { permissionKeys: [...existingKeys].sort() },
        newValue: { permissionKeys: [...desired].sort() },
        ip: await getClientIp(),
      });

      revalidatePath("/settings/users");
      return { roleKey: role.key, count: desired.size };
    },
    { action: "setRoleCustomPermissions" }
  );
}
