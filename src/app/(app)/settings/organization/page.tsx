import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, can, isGlobal } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import {
  OrganizationView,
  type OrgAddress,
  type OrgData,
} from "@/components/organization/organization-view";
import type { Prisma } from "@/generated/prisma";

export const metadata: Metadata = { title: "Organization settings" };

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

export default async function OrganizationSettingsPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.ORG_VIEW);

  const company = await prisma.company.findFirst({
    select: {
      id: true,
      name: true,
      legalName: true,
      taxId: true,
      logoUrl: true,
      currency: true,
    },
  });

  const companyId = company?.id ?? "";
  const siteFilter: Prisma.SiteWhereInput = {
    deletedAt: null,
    ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }),
  };

  const [settingRows, sites, buildings, locations, departments, costCenters, categories, headcounts] =
    await Promise.all([
      companyId
        ? prisma.systemSetting.findMany({
            where: { companyId },
            select: { key: true, value: true },
          })
        : Promise.resolve([]),
      prisma.site.findMany({ where: siteFilter, orderBy: { name: "asc" } }),
      prisma.building.findMany({
        where: { site: siteFilter },
        include: {
          floors: {
            orderBy: { level: "asc" },
            include: { rooms: { orderBy: { code: "asc" } } },
          },
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
    ]);

  const headcountBySite = new Map(
    headcounts.map((entry) => [entry.siteId, entry._count._all])
  );

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

  const canManage = can(user, PERMISSIONS.ORG_MANAGE);
  const canCatalog = can(user, PERMISSIONS.CATALOG_MANAGE);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organization settings"
        description="Company profile, sites, facilities, stock locations, structure and the shared catalogue."
        actions={
          <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
            {data.sites.length} site{data.sites.length === 1 ? "" : "s"} ·{" "}
            {data.categories.length} categor{data.categories.length === 1 ? "y" : "ies"}
          </span>
        }
      />
      <OrganizationView data={data} canManage={canManage} canCatalog={canCatalog} />
    </div>
  );
}
