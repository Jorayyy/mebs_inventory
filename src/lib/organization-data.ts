import { prisma } from "@/lib/prisma";
import { can, isGlobal, type SessionUser } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma";
import type { OrgAddress, OrgCounts, OrgData } from "@/lib/organization-types";

const EMPTY_ADDRESS: OrgAddress = {
  line1: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export type OrgBundle = { data: OrgData; counts: OrgCounts };

/**
 * Loads everything the Organization setup area needs in one pass: the company
 * profile, its system defaults and the structural entities (sites, places,
 * storage locations, departments, catalogue). Asset and stock totals are only
 * counted when the caller can actually view them.
 */
export async function loadOrganization(user: SessionUser): Promise<OrgBundle> {
  const company = await prisma.company.findFirst({
    select: { id: true, name: true, legalName: true, taxId: true, logoUrl: true, currency: true },
  });

  const companyId = company?.id ?? "";
  const siteFilter: Prisma.SiteWhereInput = {
    deletedAt: null,
    ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }),
  };
  const softScope = isGlobal(user) ? {} : { siteId: { in: user.siteIds } };

  const [
    settingRows,
    sites,
    buildings,
    locations,
    departments,
    costCenters,
    categories,
    headcounts,
    suppliers,
    users,
    assets,
    stockItems,
  ] = await Promise.all([
    companyId
      ? prisma.systemSetting.findMany({ where: { companyId }, select: { key: true, value: true } })
      : Promise.resolve([]),
    prisma.site.findMany({ where: siteFilter, orderBy: { name: "asc" } }),
    prisma.building.findMany({
      where: { site: siteFilter },
      include: {
        floors: { orderBy: { level: "asc" }, include: { rooms: { orderBy: { code: "asc" } } } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockLocation.findMany({
      where: { site: siteFilter },
      include: { site: { select: { id: true, name: true } } },
      orderBy: [{ siteId: "asc" }, { code: "asc" }],
    }),
    prisma.department.findMany({
      where: { site: siteFilter },
      include: {
        site: { select: { id: true, name: true } },
        costCenter: { select: { code: true, name: true } },
        teams: { orderBy: { name: "asc" } },
      },
      orderBy: [{ siteId: "asc" }, { name: "asc" }],
    }),
    companyId
      ? prisma.costCenter.findMany({
          where: { companyId },
          include: { _count: { select: { departments: true } } },
          orderBy: { code: "asc" },
        })
      : Promise.resolve([]),
    companyId
      ? prisma.category.findMany({
          where: { companyId },
          include: { itemTypes: { orderBy: { name: "asc" } } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    prisma.employee.groupBy({
      by: ["siteId"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    can(user, PERMISSIONS.SUPPLIERS_VIEW)
      ? prisma.supplier.count({ where: { deletedAt: null } })
      : Promise.resolve(null),
    can(user, PERMISSIONS.USERS_MANAGE)
      ? prisma.user.count({ where: { deletedAt: null } })
      : Promise.resolve(null),
    can(user, PERMISSIONS.ASSETS_VIEW)
      ? prisma.asset.count({ where: { deletedAt: null, ...softScope } })
      : Promise.resolve(null),
    can(user, PERMISSIONS.INVENTORY_VIEW)
      ? prisma.inventoryItem.count({ where: { deletedAt: null, ...softScope } })
      : Promise.resolve(null),
  ]);

  const headcountBySite = new Map(headcounts.map((entry) => [entry.siteId, entry._count._all]));

  const settingsMap = new Map(settingRows.map((row) => [row.key, row.value as unknown]));
  const addressValue = settingsMap.get("address");
  const addressRecord =
    typeof addressValue === "object" && addressValue !== null
      ? (addressValue as Record<string, unknown>)
      : {};
  const address: OrgAddress = {
    line1: readString(addressRecord.line1) || EMPTY_ADDRESS.line1,
    city: readString(addressRecord.city),
    region: readString(addressRecord.region),
    postalCode: readString(addressRecord.postalCode),
    country: readString(addressRecord.country),
  };

  const floors = buildings.flatMap((building) => building.floors);
  const teams = departments.flatMap((department) => department.teams);
  const itemTypes = categories.flatMap((category) => category.itemTypes);
  const employees = headcounts.reduce((total, entry) => total + entry._count._all, 0);

  const data: OrgData = {
    company,
    settings: {
      address,
      locale: readString(settingsMap.get("locale")) || "en-PH",
      lowStockThreshold: readNumber(settingsMap.get("lowStockThreshold"), 5),
      warrantyWarningDays: readNumber(settingsMap.get("warrantyWarningDays"), 30),
    },
    sites: sites.map((site) => ({
      id: site.id,
      code: site.code,
      name: site.name,
      city: site.city,
      address: site.address,
      timezone: site.timezone,
      status: site.status,
      contactPhone: site.contactPhone,
      contactEmail: site.contactEmail,
      notes: site.notes,
      buildingCount: buildings.filter((building) => building.siteId === site.id).length,
      locationCount: locations.filter((location) => location.siteId === site.id).length,
      employeeCount: headcountBySite.get(site.id) ?? 0,
    })),
    buildings: buildings.map((building) => ({
      id: building.id,
      siteId: building.siteId,
      code: building.code,
      name: building.name,
      floors: building.floors.map((floor) => ({
        id: floor.id,
        code: floor.code,
        name: floor.name,
        level: floor.level,
        rooms: floor.rooms.map((room) => ({
          id: room.id,
          code: room.code,
          name: room.name,
          capacity: room.capacity,
        })),
      })),
    })),
    locations: locations.map((location) => ({
      id: location.id,
      siteId: location.siteId,
      siteName: location.site.name,
      code: location.code,
      name: location.name,
      type: location.type,
      description: location.description,
      isActive: location.isActive,
    })),
    departments: departments.map((department) => ({
      id: department.id,
      siteId: department.siteId,
      siteName: department.site.name,
      code: department.code,
      name: department.name,
      description: department.description,
      isActive: department.isActive,
      costCenter: department.costCenter,
      teams: department.teams.map((team) => ({
        id: team.id,
        code: team.code,
        name: team.name,
        isActive: team.isActive,
        departmentId: team.departmentId,
      })),
    })),
    costCenters: costCenters.map((costCenter) => ({
      id: costCenter.id,
      code: costCenter.code,
      name: costCenter.name,
      budget: costCenter.budget === null ? null : Number(costCenter.budget.toString()),
      isActive: costCenter.isActive,
      departmentCount: costCenter._count.departments,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      group: category.group,
      trackingMode: category.trackingMode,
      tagPrefix: category.tagPrefix,
      itemTypes: category.itemTypes.map((itemType) => ({
        id: itemType.id,
        name: itemType.name,
        tagPrefix: itemType.tagPrefix,
        defaultWarrantyMonths: itemType.defaultWarrantyMonths,
      })),
    })),
  };

  const counts: OrgCounts = {
    sites: sites.length,
    buildings: buildings.length,
    floors: floors.length,
    rooms: floors.reduce((total, floor) => total + floor.rooms.length, 0),
    storageLocations: locations.length,
    departments: departments.length,
    teams: teams.length,
    costCenters: costCenters.length,
    categories: categories.length,
    itemTypes: itemTypes.length,
    suppliers,
    users,
    employees,
    assets,
    stockItems,
  };

  return { data, counts };
}
