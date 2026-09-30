"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePermission, assertSiteAccess, getClientIp } from "@/lib/session";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma";

const LOCATION_TYPES = [
  "WAREHOUSE",
  "STORAGE_ROOM",
  "RACK",
  "CABINET",
  "BIN",
  "PANTRY",
  "IT_ROOM",
  "MAILROOM",
  "FLOOR_GENERAL",
  "OTHER",
] as const;

const text = (max: number, label: string) => z.string().trim().min(1, `${label} is required`).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

const siteSchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  code: text(16, "Site code"),
  name: text(120, "Site name"),
  city: optionalText(80),
  address: optionalText(240),
  timezone: text(60, "Timezone"),
  contactPhone: optionalText(60),
  contactEmail: optionalText(160),
  notes: optionalText(2000),
});

const siteStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

const buildingSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  code: text(16, "Building code"),
  name: text(120, "Building name"),
});

const floorSchema = z.object({
  buildingId: z.string().min(1, "Building is required"),
  code: text(16, "Floor code"),
  name: text(120, "Floor name"),
  level: z.coerce.number().int().min(-20).max(200).default(0),
});

const roomSchema = z.object({
  floorId: z.string().min(1, "Floor is required"),
  code: text(16, "Room code"),
  name: text(120, "Room name"),
  capacity: z.union([z.string(), z.number()]).optional(),
});

const stockLocationSchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  siteId: z.string().min(1, "Site is required"),
  code: text(24, "Location code"),
  name: text(120, "Location name"),
  type: z.enum(LOCATION_TYPES).default("STORAGE_ROOM"),
  description: optionalText(500),
  isActive: z.boolean().default(true),
});

const activeFlagSchema = z.object({
  id: z.string().min(1),
  isActive: z.boolean(),
});

const departmentSchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  siteId: z.string().min(1, "Site is required"),
  code: text(24, "Department code"),
  name: text(120, "Department name"),
  description: optionalText(500),
  costCenterId: z.string().trim().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

const teamSchema = z.object({
  departmentId: z.string().min(1, "Department is required"),
  code: text(24, "Team code"),
  name: text(120, "Team name"),
  isActive: z.boolean().default(true),
});

const costCenterSchema = z.object({
  id: z.string().trim().optional().or(z.literal("")),
  code: text(24, "Cost centre code"),
  name: text(120, "Cost centre name"),
  budget: z.union([z.string(), z.number()]).optional(),
  isActive: z.boolean().default(true),
});

const companySchema = z.object({
  name: text(160, "Company name"),
  legalName: optionalText(200),
  taxId: optionalText(60),
  logoUrl: optionalText(500),
  currency: text(8, "Currency"),
});

/** Address of record + formatting locale. */
const regionalSchema = z.object({
  addressLine1: optionalText(200),
  city: optionalText(80),
  region: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
  locale: text(20, "Locale"),
});

/** Alerting windows applied across stock and warranty screens. */
const defaultsSchema = z.object({
  lowStockThreshold: z.coerce.number().int().min(0).max(1_000_000),
  warrantyWarningDays: z.coerce.number().int().min(1).max(3650),
});

async function resolveCompanyId(): Promise<string> {
  const company = await prisma.company.findFirst({ select: { id: true } });
  if (!company) {
    throw new AppError("No company is configured. Contact your administrator.", { status: 500 });
  }
  return company.id;
}

async function auditOrg(
  user: { id: string },
  entityType: string,
  entityId: string,
  description: string,
  siteId?: string | null,
  previousValue?: unknown,
  newValue?: unknown
) {
  await recordAudit({
    userId: user.id,
    action: "ORG_UPDATED",
    entityType,
    entityId,
    siteId: siteId ?? null,
    description,
    previousValue,
    newValue,
    ip: await getClientIp(),
  });
}

async function assertSiteCodeFree(companyId: string, code: string, ignoreId?: string) {
  const existing = await prisma.site.findFirst({
    where: { companyId, code, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    select: { id: true },
  });
  if (existing) throw new AppError("That site code is already in use.", { code: "DUPLICATE" });
}

export async function saveSite(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = siteSchema.parse(raw);
      const companyId = await resolveCompanyId();
      const code = input.code.trim().toUpperCase();
      const id = input.id || undefined;

      await assertSiteCodeFree(companyId, code, id);

      const data = {
        code,
        name: input.name,
        city: input.city || null,
        address: input.address || null,
        timezone: input.timezone,
        contactPhone: input.contactPhone || null,
        contactEmail: input.contactEmail || null,
        notes: input.notes || null,
      };

      let siteId: string;
      if (id) {
        const existing = await prisma.site.findUnique({ where: { id }, select: { id: true, code: true, name: true } });
        if (!existing) throw new AppError("Site not found.", { status: 404 });
        assertSiteAccess(user, id);
        await prisma.site.update({ where: { id }, data });
        siteId = id;
        await auditOrg(user, "Site", id, `Updated site ${data.name} (${code})`, id, { code: existing.code, name: existing.name }, { code, name: data.name });
      } else {
        const created = await prisma.site.create({ data: { ...data, companyId } });
        siteId = created.id;
        await auditOrg(user, "Site", created.id, `Created site ${created.name} (${created.code})`, created.id, null, { code, name: data.name });
      }

      revalidatePath("/settings/organization", "layout");
      revalidatePath("/employees");
      return { id: siteId };
    },
    { action: "saveSite" }
  );
}

export async function setSiteStatus(raw: unknown): Promise<ActionResult<{ id: string; status: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = siteStatusSchema.parse(raw);

      const site = await prisma.site.findUnique({ where: { id: input.id }, select: { id: true, name: true, status: true } });
      if (!site) throw new AppError("Site not found.", { status: 404 });
      assertSiteAccess(user, site.id);

      await prisma.site.update({ where: { id: site.id }, data: { status: input.status } });
      await auditOrg(
        user,
        "Site",
        site.id,
        `${input.status === "INACTIVE" ? "Archived" : "Reactivated"} site ${site.name}`,
        site.id,
        { status: site.status },
        { status: input.status }
      );

      revalidatePath("/settings/organization", "layout");
      return { id: site.id, status: input.status };
    },
    { action: "setSiteStatus" }
  );
}

export async function createBuilding(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = buildingSchema.parse(raw);
      assertSiteAccess(user, input.siteId);
      const code = input.code.toUpperCase();

      const duplicate = await prisma.building.findFirst({
        where: { siteId: input.siteId, code },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That building code already exists on this site.", { code: "DUPLICATE" });

      const building = await prisma.building.create({
        data: { siteId: input.siteId, code, name: input.name },
      });
      await auditOrg(user, "Building", building.id, `Created building ${building.name} (${code})`, input.siteId, null, { code, name: input.name });

      revalidatePath("/settings/organization", "layout");
      return { id: building.id };
    },
    { action: "createBuilding" }
  );
}

export async function createFloor(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = floorSchema.parse(raw);

      const building = await prisma.building.findUnique({
        where: { id: input.buildingId },
        select: { id: true, siteId: true, name: true },
      });
      if (!building) throw new AppError("Building not found.", { status: 404 });
      assertSiteAccess(user, building.siteId);
      const code = input.code.toUpperCase();

      const duplicate = await prisma.floor.findFirst({
        where: { buildingId: building.id, code },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That floor code already exists in this building.", { code: "DUPLICATE" });

      const floor = await prisma.floor.create({
        data: { buildingId: building.id, code, name: input.name, level: input.level },
      });
      await auditOrg(user, "Floor", floor.id, `Created floor ${floor.name} in ${building.name}`, building.siteId, null, { code, level: input.level });

      revalidatePath("/settings/organization", "layout");
      return { id: floor.id };
    },
    { action: "createFloor" }
  );
}

export async function createRoom(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = roomSchema.parse(raw);

      const floor = await prisma.floor.findUnique({
        where: { id: input.floorId },
        select: { id: true, building: { select: { siteId: true, name: true } } },
      });
      if (!floor) throw new AppError("Floor not found.", { status: 404 });
      assertSiteAccess(user, floor.building.siteId);
      const code = input.code.toUpperCase();
      const capacity =
        input.capacity === undefined || input.capacity === "" ? null : Number(input.capacity);

      const duplicate = await prisma.room.findFirst({
        where: { floorId: floor.id, code },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That room code already exists on this floor.", { code: "DUPLICATE" });

      const room = await prisma.room.create({
        data: {
          floorId: floor.id,
          code,
          name: input.name,
          capacity: capacity !== null && Number.isFinite(capacity) ? capacity : null,
        },
      });
      await auditOrg(user, "Room", room.id, `Created room ${room.name} (${code})`, floor.building.siteId, null, { code, name: input.name });

      revalidatePath("/settings/organization", "layout");
      return { id: room.id };
    },
    { action: "createRoom" }
  );
}

export async function saveStockLocation(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = stockLocationSchema.parse(raw);
      const id = input.id || undefined;
      assertSiteAccess(user, input.siteId);
      const code = input.code.toUpperCase();

      const duplicate = await prisma.stockLocation.findFirst({
        where: { siteId: input.siteId, code, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That location code already exists on this site.", { code: "DUPLICATE" });

      const data = {
        code,
        name: input.name,
        type: input.type,
        description: input.description || null,
        isActive: input.isActive,
      };

      let locationId: string;
      if (id) {
        const existing = await prisma.stockLocation.findUnique({ where: { id }, select: { id: true, siteId: true } });
        if (!existing) throw new AppError("Location not found.", { status: 404 });
        assertSiteAccess(user, existing.siteId);
        await prisma.stockLocation.update({ where: { id }, data });
        locationId = id;
        await auditOrg(user, "StockLocation", id, `Updated stock location ${data.name}`, existing.siteId, null, data);
      } else {
        const created = await prisma.stockLocation.create({ data: { ...data, siteId: input.siteId } });
        locationId = created.id;
        await auditOrg(user, "StockLocation", created.id, `Created stock location ${created.name}`, input.siteId, null, data);
      }

      revalidatePath("/settings/organization", "layout");
      revalidatePath("/inventory");
      return { id: locationId };
    },
    { action: "saveStockLocation" }
  );
}

export async function setStockLocationActive(raw: unknown): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = activeFlagSchema.parse(raw);

      const location = await prisma.stockLocation.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, siteId: true, isActive: true },
      });
      if (!location) throw new AppError("Location not found.", { status: 404 });
      assertSiteAccess(user, location.siteId);

      await prisma.stockLocation.update({ where: { id: location.id }, data: { isActive: input.isActive } });
      await auditOrg(
        user,
        "StockLocation",
        location.id,
        `${input.isActive ? "Activated" : "Deactivated"} stock location ${location.name}`,
        location.siteId,
        { isActive: location.isActive },
        { isActive: input.isActive }
      );

      revalidatePath("/settings/organization", "layout");
      revalidatePath("/inventory");
      return { id: location.id, isActive: input.isActive };
    },
    { action: "setStockLocationActive" }
  );
}

export async function saveDepartment(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = departmentSchema.parse(raw);
      const companyId = await resolveCompanyId();
      const id = input.id || undefined;
      assertSiteAccess(user, input.siteId);
      const code = input.code.toUpperCase();

      const duplicate = await prisma.department.findFirst({
        where: { siteId: input.siteId, code, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That department code already exists on this site.", { code: "DUPLICATE" });

      const data = {
        code,
        name: input.name,
        description: input.description || null,
        costCenterId: input.costCenterId || null,
        isActive: input.isActive,
      };

      let departmentId: string;
      if (id) {
        const existing = await prisma.department.findUnique({ where: { id }, select: { id: true, siteId: true, name: true } });
        if (!existing) throw new AppError("Department not found.", { status: 404 });
        assertSiteAccess(user, existing.siteId);
        await prisma.department.update({ where: { id }, data });
        departmentId = id;
        await auditOrg(user, "Department", id, `Updated department ${data.name}`, existing.siteId, null, data);
      } else {
        const created = await prisma.department.create({
          data: { ...data, companyId, siteId: input.siteId },
        });
        departmentId = created.id;
        await auditOrg(user, "Department", created.id, `Created department ${created.name}`, input.siteId, null, data);
      }

      revalidatePath("/settings/organization", "layout");
      revalidatePath("/employees");
      return { id: departmentId };
    },
    { action: "saveDepartment" }
  );
}

export async function setDepartmentActive(raw: unknown): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = activeFlagSchema.parse(raw);

      const department = await prisma.department.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, siteId: true, isActive: true },
      });
      if (!department) throw new AppError("Department not found.", { status: 404 });
      assertSiteAccess(user, department.siteId);

      await prisma.department.update({ where: { id: department.id }, data: { isActive: input.isActive } });
      await auditOrg(
        user,
        "Department",
        department.id,
        `${input.isActive ? "Activated" : "Deactivated"} department ${department.name}`,
        department.siteId,
        { isActive: department.isActive },
        { isActive: input.isActive }
      );

      revalidatePath("/settings/organization", "layout");
      revalidatePath("/employees");
      return { id: department.id, isActive: input.isActive };
    },
    { action: "setDepartmentActive" }
  );
}

export async function createTeam(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = teamSchema.parse(raw);

      const department = await prisma.department.findUnique({
        where: { id: input.departmentId },
        select: { id: true, siteId: true, name: true },
      });
      if (!department) throw new AppError("Department not found.", { status: 404 });
      assertSiteAccess(user, department.siteId);
      const code = input.code.toUpperCase();

      const duplicate = await prisma.team.findFirst({
        where: { departmentId: department.id, code },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That team code already exists in this department.", { code: "DUPLICATE" });

      const team = await prisma.team.create({
        data: { departmentId: department.id, code, name: input.name, isActive: input.isActive },
      });
      await auditOrg(user, "Team", team.id, `Created team ${team.name} under ${department.name}`, department.siteId, null, { code, name: input.name });

      revalidatePath("/settings/organization", "layout");
      revalidatePath("/employees");
      return { id: team.id };
    },
    { action: "createTeam" }
  );
}

export async function setTeamActive(raw: unknown): Promise<ActionResult<{ id: string; isActive: boolean }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = activeFlagSchema.parse(raw);

      const team = await prisma.team.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, isActive: true, department: { select: { siteId: true } } },
      });
      if (!team) throw new AppError("Team not found.", { status: 404 });
      assertSiteAccess(user, team.department.siteId);

      await prisma.team.update({ where: { id: team.id }, data: { isActive: input.isActive } });
      await auditOrg(
        user,
        "Team",
        team.id,
        `${input.isActive ? "Activated" : "Deactivated"} team ${team.name}`,
        team.department.siteId,
        { isActive: team.isActive },
        { isActive: input.isActive }
      );

      revalidatePath("/settings/organization", "layout");
      return { id: team.id, isActive: input.isActive };
    },
    { action: "setTeamActive" }
  );
}

export async function saveCostCenter(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = costCenterSchema.parse(raw);
      const companyId = await resolveCompanyId();
      const id = input.id || undefined;
      const code = input.code.toUpperCase();
      const budget =
        input.budget === undefined || input.budget === "" ? null : Number(input.budget);

      const duplicate = await prisma.costCenter.findFirst({
        where: { companyId, code, ...(id ? { id: { not: id } } : {}) },
        select: { id: true },
      });
      if (duplicate) throw new AppError("That cost centre code is already in use.", { code: "DUPLICATE" });

      const data = {
        code,
        name: input.name,
        budget: budget !== null && Number.isFinite(budget) ? budget : null,
        isActive: input.isActive,
      };

      let costCenterId: string;
      if (id) {
        const existing = await prisma.costCenter.findUnique({ where: { id }, select: { id: true, name: true } });
        if (!existing) throw new AppError("Cost centre not found.", { status: 404 });
        await prisma.costCenter.update({ where: { id }, data });
        costCenterId = id;
        await auditOrg(user, "CostCenter", id, `Updated cost centre ${data.name}`, null, null, data);
      } else {
        const created = await prisma.costCenter.create({ data: { ...data, companyId } });
        costCenterId = created.id;
        await auditOrg(user, "CostCenter", created.id, `Created cost centre ${created.name}`, null, null, data);
      }

      revalidatePath("/settings/organization", "layout");
      revalidatePath("/assets");
      return { id: costCenterId };
    },
    { action: "saveCostCenter" }
  );
}

export async function saveCompany(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = companySchema.parse(raw);

      const existing = await prisma.company.findFirst();
      const data = {
        name: input.name,
        legalName: input.legalName || null,
        taxId: input.taxId || null,
        logoUrl: input.logoUrl || null,
        currency: input.currency.toUpperCase(),
      };

      let companyId: string;
      if (existing) {
        await prisma.company.update({ where: { id: existing.id }, data });
        companyId = existing.id;
        await auditOrg(user, "Company", existing.id, `Updated company profile ${data.name}`, null, { name: existing.name, currency: existing.currency }, { name: data.name, currency: data.currency });
      } else {
        const created = await prisma.company.create({ data });
        companyId = created.id;
        await auditOrg(user, "Company", created.id, `Created company profile ${data.name}`, null, null, { name: data.name });
      }

      revalidatePath("/settings/organization", "layout");
      return { id: companyId };
    },
    { action: "saveCompany" }
  );
}

/** Upserts the organisation-wide SystemSetting rows (address, locale, thresholds). */
async function writeSystemSettings(
  user: { id: string },
  payload: { key: string; value: Prisma.InputJsonValue; description: string }[]
): Promise<{ updated: string[] }> {
  const companyId = await resolveCompanyId();

  const previous = await prisma.systemSetting.findMany({
    where: { companyId, key: { in: payload.map((p) => p.key) } },
    select: { key: true, value: true },
  });
  const previousMap = Object.fromEntries(previous.map((row) => [row.key, row.value]));

  for (const entry of payload) {
    await prisma.systemSetting.upsert({
      where: { companyId_key: { companyId, key: entry.key } },
      create: {
        companyId,
        key: entry.key,
        value: entry.value,
        description: entry.description,
        updatedById: user.id,
      },
      update: { value: entry.value, description: entry.description, updatedById: user.id },
    });
  }

  await recordAudit({
    userId: user.id,
    action: "SETTINGS_UPDATED",
    entityType: "SystemSetting",
    entityId: companyId,
    description: `Updated system settings: ${payload.map((p) => p.key).join(", ")}`,
    previousValue: previousMap as Record<string, unknown>,
    newValue: Object.fromEntries(payload.map((p) => [p.key, p.value])),
    ip: await getClientIp(),
  });

  revalidatePath("/settings/organization", "layout");
  return { updated: payload.map((p) => p.key) };
}

/** Upserts the address of record and the default formatting locale. */
export async function saveRegionalSettings(raw: unknown): Promise<ActionResult<{ updated: string[] }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = regionalSchema.parse(raw);

      return await writeSystemSettings(user, [
        {
          key: "address",
          value: {
            line1: input.addressLine1 || "",
            city: input.city || "",
            region: input.region || "",
            postalCode: input.postalCode || "",
            country: input.country || "",
          } as Prisma.InputJsonValue,
          description: "Registered / postal address of the company",
        },
        { key: "locale", value: input.locale, description: "Default locale for formatting" },
      ]);
    },
    { action: "saveRegionalSettings" }
  );
}

/** Upserts the alerting windows used by stock and warranty screens. */
export async function saveInventoryDefaults(raw: unknown): Promise<ActionResult<{ updated: string[] }>> {
  return withAction(
    async () => {
      const user = await requirePermission(PERMISSIONS.ORG_MANAGE);
      const input = defaultsSchema.parse(raw);

      return await writeSystemSettings(user, [
        {
          key: "lowStockThreshold",
          value: input.lowStockThreshold,
          description: "Default reorder alert threshold for new items",
        },
        {
          key: "warrantyWarningDays",
          value: input.warrantyWarningDays,
          description: "Days before warranty expiry to raise a warning",
        },
      ]);
    },
    { action: "saveInventoryDefaults" }
  );
}
