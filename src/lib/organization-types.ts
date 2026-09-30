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

export type OrgCounts = {
  sites: number;
  buildings: number;
  floors: number;
  rooms: number;
  storageLocations: number;
  departments: number;
  teams: number;
  costCenters: number;
  categories: number;
  itemTypes: number;
  suppliers: number | null;
  users: number | null;
  employees: number;
  assets: number | null;
  stockItems: number | null;
};
