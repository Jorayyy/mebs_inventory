"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, isGlobal, assertSiteAccess } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { slugify } from "@/lib/utils";

export type FormOptions = {
  sites: { id: string; name: string; code: string }[];
  categories: {
    id: string;
    name: string;
    group: string;
    trackingMode: string;
    tagPrefix: string | null;
    itemTypes: { id: string; name: string; tagPrefix: string | null; defaultWarrantyMonths: number | null }[];
  }[];
  departments: { id: string; name: string; siteId: string }[];
  teams: { id: string; name: string; departmentId: string }[];
  rooms: { id: string; name: string; code: string; siteId: string; path: string }[];
  stockLocations: { id: string; name: string; code: string; siteId: string; type: string }[];
  suppliers: { id: string; name: string }[];
  costCenters: { id: string; name: string; code: string }[];
  employees: { id: string; label: string }[];
  users: { id: string; name: string; email: string }[];
};

/** One round-trip payload for all catalog dropdowns used by asset/stock/transfer forms. */
export async function getFormOptions(): Promise<FormOptions> {
  const user = await requirePermission(PERMISSIONS.ASSETS_VIEW, PERMISSIONS.INVENTORY_VIEW);
  const global = isGlobal(user);
  const siteScope = global ? {} : { id: { in: user.siteIds } };

  const [sites, categories, departments, teams, rooms, stockLocations, suppliers, costCenters, employees, users] =
    await Promise.all([
      prisma.site.findMany({
        where: { status: "ACTIVE", ...siteScope },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          group: true,
          trackingMode: true,
          tagPrefix: true,
          itemTypes: {
            where: { isActive: true },
            select: { id: true, name: true, tagPrefix: true, defaultWarrantyMonths: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ group: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.department.findMany({
        where: { isActive: true, ...(global ? {} : { siteId: { in: user.siteIds } }) },
        select: { id: true, name: true, siteId: true },
        orderBy: { name: "asc" },
      }),
      prisma.team.findMany({
        where: {
          isActive: true,
          ...(global ? {} : { department: { siteId: { in: user.siteIds } } }),
        },
        select: { id: true, name: true, departmentId: true },
        orderBy: { name: "asc" },
      }),
      prisma.room.findMany({
        where: { floor: { building: { site: siteScope } } },
        select: {
          id: true,
          name: true,
          code: true,
          floor: { select: { building: { select: { siteId: true, name: true } } } },
        },
        orderBy: { code: "asc" },
      }),
      prisma.stockLocation.findMany({
        where: { isActive: true, ...(global ? {} : { siteId: { in: user.siteIds } }) },
        select: { id: true, name: true, code: true, siteId: true, type: true },
        orderBy: { name: "asc" },
      }),
      prisma.supplier.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.costCenter.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
      }),
      prisma.employee.findMany({
        where: {
          deletedAt: null,
          employmentStatus: { not: "EXITED" },
          ...(global ? {} : { siteId: { in: user.siteIds } }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeNo: true,
          department: { select: { name: true } },
        },
        orderBy: [{ lastName: "asc" }],
        take: 500,
      }),
      prisma.user.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 300,
      }),
    ]);

  return {
    sites: sites.map((s) => ({ id: s.id, name: s.name, code: s.code })),
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group,
      trackingMode: c.trackingMode,
      tagPrefix: c.tagPrefix,
      itemTypes: c.itemTypes.map((t) => ({
        id: t.id,
        name: t.name,
        tagPrefix: t.tagPrefix,
        defaultWarrantyMonths: t.defaultWarrantyMonths,
      })),
    })),
    departments: departments.map((d) => ({ id: d.id, name: d.name, siteId: d.siteId })),
    teams: teams.map((t) => ({ id: t.id, name: t.name, departmentId: t.departmentId })),
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      siteId: r.floor.building.siteId,
      path: `${r.floor.building.name} · ${r.name}`,
    })),
    stockLocations: stockLocations.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      siteId: s.siteId,
      type: s.type,
    })),
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    costCenters: costCenters.map((c) => ({ id: c.id, name: c.name, code: c.code })),
    employees: employees.map((e) => ({
      id: e.id,
      label: `${e.firstName} ${e.lastName} · ${e.employeeNo} · ${e.department.name}`,
    })),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
  };
}

import { categoryCreateSchema, itemTypeCreateSchema } from "@/lib/validations/catalog";

export async function createCategory(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
      const input = categoryCreateSchema.parse(raw);
      const company = await prisma.company.findFirstOrThrow({ select: { id: true } });

      const category = await prisma.category.create({
        data: {
          companyId: company.id,
          name: input.name,
          slug: slugify(input.name),
          group: input.group,
          trackingMode: input.trackingMode,
          tagPrefix: input.tagPrefix ? input.tagPrefix.toUpperCase() : null,
          description: input.description || null,
        },
      });

      await recordAudit({
        userId: user.id,
        action: "CATEGORY_UPDATED",
        entityType: "Category",
        entityId: category.id,
        description: `Created category ${category.name}`,
        newValue: { name: category.name, group: category.group },
      });

      revalidatePath("/settings/organization");
      revalidatePath("/assets");
      revalidatePath("/inventory");
      return { id: category.id };
    },
    { action: "createCategory" }
  );
}

export async function createItemType(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.CATALOG_MANAGE);
      const input = itemTypeCreateSchema.parse(raw);
      const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new AppError("Category not found.", { status: 404 });

      const itemType = await prisma.itemType.create({
        data: {
          categoryId: category.id,
          name: input.name,
          slug: slugify(input.name),
          tagPrefix: input.tagPrefix ? input.tagPrefix.toUpperCase() : category.tagPrefix,
          defaultWarrantyMonths: input.defaultWarrantyMonths
            ? Number(input.defaultWarrantyMonths)
            : null,
        },
      });

      await recordAudit({
        userId: user.id,
        action: "CATEGORY_UPDATED",
        entityType: "ItemType",
        entityId: itemType.id,
        description: `Created item type ${itemType.name} under ${category.name}`,
        newValue: { name: itemType.name, categoryId: category.id },
      });

      revalidatePath("/settings/organization");
      return { id: itemType.id };
    },
    { action: "createItemType" }
  );
}

