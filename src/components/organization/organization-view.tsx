"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyPanel } from "@/components/organization/company-panel";
import { SitesPanel } from "@/components/organization/sites-panel";
import { FacilitiesPanel } from "@/components/organization/facilities-panel";
import { LocationsPanel } from "@/components/organization/locations-panel";
import { StructurePanel } from "@/components/organization/structure-panel";
import { CatalogPanel } from "@/components/organization/catalog-panel";

export type OrgAddress = {
  line1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

export type OrgSite = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  timezone: string;
  status: string;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  buildingCount: number;
  locationCount: number;
  employeeCount: number;
};

export type OrgRoom = { id: string; code: string; name: string; capacity: number | null };
export type OrgFloor = { id: string; code: string; name: string; level: number; rooms: OrgRoom[] };
export type OrgBuilding = { id: string; siteId: string; code: string; name: string; floors: OrgFloor[] };

export type OrgLocation = {
  id: string;
  siteId: string;
  siteName: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  isActive: boolean;
};

export type OrgTeam = { id: string; code: string; name: string; isActive: boolean; departmentId: string };

export type OrgDepartment = {
  id: string;
  siteId: string;
  siteName: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  costCenter: { code: string; name: string } | null;
  teams: OrgTeam[];
};

export type OrgCostCenter = {
  id: string;
  code: string;
  name: string;
  budget: number | null;
  isActive: boolean;
  departmentCount: number;
};

export type OrgCategory = {
  id: string;
  name: string;
  group: string;
  trackingMode: string;
  tagPrefix: string | null;
  itemTypes: { id: string; name: string; tagPrefix: string | null; defaultWarrantyMonths: number | null }[];
};

export type OrgSettings = {
  address: OrgAddress;
  locale: string;
  lowStockThreshold: number;
  warrantyWarningDays: number;
};

export type OrgData = {
  company: {
    id: string;
    name: string;
    legalName: string | null;
    taxId: string | null;
    logoUrl: string | null;
    currency: string;
  } | null;
  settings: OrgSettings;
  sites: OrgSite[];
  buildings: OrgBuilding[];
  locations: OrgLocation[];
  departments: OrgDepartment[];
  costCenters: OrgCostCenter[];
  categories: OrgCategory[];
};

export function OrganizationView({
  data,
  canManage,
  canCatalog,
}: {
  data: OrgData;
  canManage: boolean;
  canCatalog: boolean;
}) {
  const [tab, setTab] = React.useState("company");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="h-9 w-full justify-start overflow-x-auto">
        <TabsTrigger value="company">Company &amp; settings</TabsTrigger>
        <TabsTrigger value="sites">Sites</TabsTrigger>
        <TabsTrigger value="facilities">Buildings &amp; rooms</TabsTrigger>
        <TabsTrigger value="locations">Stock locations</TabsTrigger>
        <TabsTrigger value="structure">Departments &amp; teams</TabsTrigger>
        <TabsTrigger value="catalog">Categories &amp; item types</TabsTrigger>
      </TabsList>

      <TabsContent value="company">
        <CompanyPanel data={data} canManage={canManage} />
      </TabsContent>
      <TabsContent value="sites">
        <SitesPanel sites={data.sites} canManage={canManage} />
      </TabsContent>
      <TabsContent value="facilities">
        <FacilitiesPanel sites={data.sites} buildings={data.buildings} canManage={canManage} />
      </TabsContent>
      <TabsContent value="locations">
        <LocationsPanel locations={data.locations} sites={data.sites} canManage={canManage} />
      </TabsContent>
      <TabsContent value="structure">
        <StructurePanel
          departments={data.departments}
          costCenters={data.costCenters}
          sites={data.sites}
          canManage={canManage}
        />
      </TabsContent>
      <TabsContent value="catalog">
        <CatalogPanel categories={data.categories} canCatalog={canCatalog} />
      </TabsContent>
    </Tabs>
  );
}
