import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma";
import type {
  AssetCondition,
  AssetStatus,
  CategoryGroup,
  MaintenanceStatus,
  TrackingMode,
  TransferStatus,
} from "../src/generated/prisma";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS, ROLE_KEYS } from "../src/lib/permissions";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "ChangeMe123!";
const RESET_PASSWORD = process.env.SEED_RESET_PASSWORD === "1";

/**
 * `tsx prisma/seed.ts`        -> bootstrap only (permissions, roles, company, admin login)
 * `tsx prisma/seed.ts demo`   -> bootstrap + the demo dataset
 */
const mode: "bootstrap" | "demo" = process.argv[2] === "demo" ? "demo" : "bootstrap";

const PERMISSION_GROUPS: Record<string, string> = {
  dashboard: "Overview",
  search: "Overview",
  assets: "Assets",
  inventory: "Inventory",
  assignments: "Assignments",
  transfers: "Transfers",
  maintenance: "Maintenance",
  suppliers: "Procurement",
  purchase_orders: "Procurement",
  employees: "People",
  org: "Organisation",
  catalog: "Organisation",
  reports: "Reports",
  audit: "Reports",
  users: "Administration",
  roles: "Administration",
  notifications: "Administration",
  diagnostics: "Administration",
  settings: "Administration",
  selfservice: "Self service",
};

function pretty(key: string): string {
  const [group, action] = key.split(".");
  return `${(action ?? group)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())} ${group.replace(/_/g, " ")}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

let seed = 20260926;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(values: T[]): T {
  return values[Math.floor(rand() * values.length)];
}
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}
function daysAhead(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

const created = {
  users: 0,
  sites: 0,
  categories: 0,
  employees: 0,
  assets: 0,
  inventory: 0,
  transfers: 0,
  maintenance: 0,
  suppliers: 0,
};

async function main() {
  console.log(mode === "demo" ? "Seeding demo dataset…" : "Bootstrapping system…");
  if (RESET_PASSWORD) console.log("SEED_RESET_PASSWORD=1 — existing users will get a new password.");

  const company =
    (await prisma.company.findFirst({ where: { name: "MEBS Business Process Solutions" } })) ??
    (await prisma.company.create({
      data: {
        name: "MEBS Business Process Solutions",
        legalName: "MEBS Business Process Solutions Inc.",
        currency: "PHP",
        logoUrl: null,
      },
    }));

  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { name: pretty(key), group: PERMISSION_GROUPS[key.split(".")[0]] ?? "general" },
      create: { key, name: pretty(key), group: PERMISSION_GROUPS[key.split(".")[0]] ?? "general" },
    });
  }
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionId = new Map(permissions.map((p) => [p.key, p.id]));

  for (const roleKey of ROLE_KEYS) {
    const definition = ROLE_DEFINITIONS[roleKey];
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: definition.name, description: definition.description, scope: definition.siteScoped ? "site" : "global" },
      create: {
        key: roleKey,
        name: definition.name,
        description: definition.description,
        scope: definition.siteScoped ? "site" : "global",
      },
    });

    const wanted = definition.permissions.map((key) => permissionId.get(key)!).filter(Boolean);
    const existing = await prisma.rolePermission.findMany({ where: { roleId: role.id } });
    const wantedSet = new Set(wanted);
    for (const row of existing) {
      if (!wantedSet.has(row.permissionId)) {
        await prisma.rolePermission.delete({ where: { id: row.id } });
      }
    }
    const existingSet = new Set(existing.map((row) => row.permissionId));
    for (const permissionId of wanted) {
      if (!existingSet.has(permissionId)) {
        await prisma.rolePermission.create({ data: { roleId: role.id, permissionId } });
      }
    }
  }

  const roles = new Map((await prisma.role.findMany()).map((r) => [r.key, r.id]));

  // --- bootstrap: the one account that must always exist -------------------
  const ADMIN = { email: "admin@mebs.local", name: "System Administrator" };
  const adminPassword = await bcrypt.hash(SEED_PASSWORD, 12);
  const adminRole = roles.get("SUPER_ADMIN")!;
  const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  const adminUser =
    existingAdmin ??
    (await prisma.user.create({
      data: {
        email: ADMIN.email,
        name: ADMIN.name,
        passwordHash: adminPassword,
        roleId: adminRole,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    }));
  if (existingAdmin && RESET_PASSWORD) {
    await prisma.user.update({ where: { id: adminUser.id }, data: { passwordHash: adminPassword } });
  }

  if (mode !== "demo") {
    console.log(`  ${ALL_PERMISSIONS.length} permissions · ${ROLE_KEYS.length} roles`);
    console.log(`  admin account: ${ADMIN.email} (password: ${RESET_PASSWORD ? "reset" : "unchanged on re-run"})`);
    return;
  }

  const siteSeeds = [
    {
      code: "MNL",
      name: "Manila — Main Campus",
      city: "Manila",
      address: "12th Floor Cyber Sigma, Lawton Avenue, Taguig City",
      contactEmail: "mnl@mebs.example",
      contactPhone: "+63 2 8888 1000",
    },
    {
      code: "CEB",
      name: "Cebu IT Park",
      city: "Cebu City",
      address: "Level 5, Cebu IT Park, Lahug, Cebu City 6000",
      contactEmail: "ceb@mebs.example",
      contactPhone: "+63 32 320 4000",
    },
    {
      code: "DVO",
      name: "Davao Annex",
      city: "Davao City",
      address: "3rd Floor Matina Town Square, Davao City 8000",
      contactEmail: "dvo@mebs.example",
      contactPhone: "+63 82 227 5000",
    },
  ];

  const sites: { id: string; code: string; name: string }[] = [];
  for (const seed of siteSeeds) {
    const existing = await prisma.site.findFirst({ where: { companyId: company.id, code: seed.code } });
    const site =
      existing ??
      (await prisma.site.create({
        data: { companyId: company.id, ...seed, status: "ACTIVE", timezone: "Asia/Manila" },
      }));
    if (!existing) created.sites += 1;
    sites.push({ id: site.id, code: site.code, name: site.name });
  }
  const [mnl, ceb, dvo] = sites;

  const locationIds: Record<string, string[]> = {};
  const departmentIds: Record<string, string[]> = {};
  const buildingIds: Record<string, string[]> = {};

  for (const site of sites) {
    const building =
      (await prisma.building.findFirst({ where: { siteId: site.id, code: "A" } })) ??
      (await prisma.building.create({
        data: { siteId: site.id, code: "A", name: `${site.code} Tower A` },
      }));
    buildingIds[site.code] = [building.id];

    const floor =
      (await prisma.floor.findFirst({ where: { buildingId: building.id, code: "GF" } })) ??
      (await prisma.floor.create({
        data: { buildingId: building.id, code: "GF", name: "Ground Floor", level: 0 },
      }));

    const rooms: string[] = [];
    for (const [code, name] of [
      ["OPS-1", "Operations Floor"],
      ["WH-1", "Warehouse Bay"],
      ["IT-1", "Server / IT Room"],
    ]) {
      const room =
        (await prisma.room.findFirst({ where: { floorId: floor.id, code } })) ??
        (await prisma.room.create({ data: { floorId: floor.id, code, name, capacity: 60 } }));
      rooms.push(room.id);
    }

    const locations: string[] = [];
    for (const [code, name, type] of [
      ["WH-MAIN", "Main Warehouse", "WAREHOUSE"],
      ["STORE-1", "Supply Cabinet", "CABINET"],
      ["IT-ROOM", "IT Store", "IT_ROOM"],
    ]) {
      const location =
        (await prisma.stockLocation.findFirst({ where: { siteId: site.id, code } })) ??
        (await prisma.stockLocation.create({
          data: { siteId: site.id, code, name, type: type as never },
        }));
      locations.push(location.id);
    }
    locationIds[site.code] = locations;

    const departments: string[] = [];
    for (const [code, name] of [
      ["OPS", "Operations"],
      ["IT", "Information Technology"],
      ["HR", "Human Resources"],
      ["FIN", "Finance & Accounting"],
    ]) {
      const department =
        (await prisma.department.findFirst({ where: { siteId: site.id, code } })) ??
        (await prisma.department.create({
          data: { companyId: company.id, siteId: site.id, code, name },
        }));
      departments.push(department.id);

      if (code === "OPS") {
        const team =
          (await prisma.team.findFirst({ where: { departmentId: department.id, code: "TL-A" } })) ??
          (await prisma.team.create({
            data: { departmentId: department.id, code: "TL-A", name: "Team Alpha" },
          }));
        void team;
      }
    }
    departmentIds[site.code] = departments;

    const costCenter =
      (await prisma.costCenter.findFirst({ where: { companyId: company.id, code: `CC-${site.code}` } })) ??
      (await prisma.costCenter.create({
        data: { companyId: company.id, code: `CC-${site.code}`, name: `${site.code} Operations`, budget: 2_500_000 },
      }));
    void costCenter;
  }
  console.log(`  ${sites.length} sites · hierarchy`);

  const categorySeeds: { name: string; group: CategoryGroup; prefix: string; mode: TrackingMode; types?: { name: string; months?: number }[] }[] = [
    { name: "Laptop", group: "IT_EQUIPMENT", prefix: "LAP", mode: "BOTH", types: [{ name: "Standard Laptop", months: 36 }, { name: "Executive Laptop", months: 36 }] },
    { name: "Desktop", group: "IT_EQUIPMENT", prefix: "DT", mode: "BOTH", types: [{ name: "Workstation", months: 36 }] },
    { name: "Monitor", group: "IT_EQUIPMENT", prefix: "MON", mode: "BOTH", types: [{ name: '24" LED', months: 36 }, { name: '27" LED', months: 36 }] },
    { name: "Headset", group: "IT_EQUIPMENT", prefix: "HST", mode: "ASSET", types: [{ name: "USB Noise Cancelling", months: 12 }] },
    { name: "Mobile Phone", group: "IT_EQUIPMENT", prefix: "MOB", mode: "ASSET", types: [{ name: "Company Handset", months: 24 }] },
    { name: "Printer", group: "OFFICE_EQUIPMENT", prefix: "PRT", mode: "BOTH" },
    { name: "Office Furniture", group: "OFFICE_EQUIPMENT", prefix: "FUR", mode: "ASSET" },
    { name: "Toner & Ink", group: "OFFICE_SUPPLIES", prefix: "TNR", mode: "CONSUMABLE" },
    { name: "Paper & Printing", group: "OFFICE_SUPPLIES", prefix: "PPR", mode: "CONSUMABLE" },
    { name: "Cables & Adapters", group: "IT_EQUIPMENT", prefix: "CBL", mode: "CONSUMABLE" },
    { name: "Safety & PPE", group: "FACILITIES_SAFETY", prefix: "PPE", mode: "CONSUMABLE" },
  ];

  const categories: Record<string, { id: string; prefix: string; types: { id: string; name: string }[] }> = {};
  for (const seed of categorySeeds) {
    const slug = slugify(seed.name);
    const category =
      (await prisma.category.findFirst({ where: { companyId: company.id, slug } })) ??
      (await prisma.category.create({
        data: {
          companyId: company.id,
          name: seed.name,
          slug,
          group: seed.group,
          trackingMode: seed.mode,
          tagPrefix: seed.prefix,
          sortOrder: categorySeeds.indexOf(seed),
        },
      }));
    if (categorySeeds.indexOf(seed) >= 0 && !(seed.name in categories)) created.categories += 1;

    const types: { id: string; name: string }[] = [];
    for (const typeSeed of seed.types ?? []) {
      const typeSlug = slugify(typeSeed.name);
      const type =
        (await prisma.itemType.findFirst({ where: { categoryId: category.id, slug: typeSlug } })) ??
        (await prisma.itemType.create({
          data: {
            categoryId: category.id,
            name: typeSeed.name,
            slug: typeSlug,
            tagPrefix: seed.prefix,
            defaultWarrantyMonths: typeSeed.months ?? null,
          },
        }));
      types.push({ id: type.id, name: type.name });
    }
    categories[seed.name] = { id: category.id, prefix: seed.prefix, types };
  }
  console.log(`  ${categorySeeds.length} categories`);

  const userSeeds = [
    { email: "admin@mebs.local", name: "Amelia Reyes", role: "SUPER_ADMIN", sites: [] as string[] },
    { email: "inventory.admin@mebs.local", name: "Paolo Domingo", role: "INVENTORY_ADMIN", sites: [] as string[] },
    { email: "site.admin@mebs.local", name: "Maricel Tan", role: "SITE_ADMIN", sites: ["MNL", "CEB"] },
    { email: "technician@mebs.local", name: "Joel Villanueva", role: "TECHNICIAN", sites: ["MNL"] },
    { email: "manager@mebs.local", name: "Rhea Salazar", role: "DEPARTMENT_MANAGER", sites: ["MNL"] },
    { email: "staff@mebs.local", name: "Kevin Bautista", role: "INVENTORY_STAFF", sites: ["MNL"] },
    { email: "auditor@mebs.local", name: "Lorna Mercado", role: "AUDITOR", sites: [] as string[] },
    { email: "employee@mebs.local", name: "Dianne Cruz", role: "EMPLOYEE", sites: [] as string[] },
  ];

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  const users: Record<string, string> = {};
  for (const seed of userSeeds) {
    const existing = await prisma.user.findUnique({ where: { email: seed.email } });
    const user =
      existing ??
      (await prisma.user.create({
        data: {
          email: seed.email,
          name: seed.name,
          passwordHash,
          roleId: roles.get(seed.role)!,
          status: "ACTIVE",
          mustChangePassword: false,
        },
      }));
    if (!existing) created.users += 1;
    if (existing && RESET_PASSWORD) {
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    }
    await prisma.user.update({ where: { id: user.id }, data: { roleId: roles.get(seed.role)! } });
    users[seed.email] = user.id;

    for (const code of seed.sites) {
      const site = sites.find((s) => s.code === code)!;
      await prisma.userSite.upsert({
        where: { userId_siteId: { userId: user.id, siteId: site.id } },
        update: {},
        create: { userId: user.id, siteId: site.id },
      });
    }
  }
  console.log(`  ${userSeeds.length} users (password: ${RESET_PASSWORD ? "reset" : "set on first creation"})`);

  const employeeSeeds: { first: string; last: string; no: string; site: string; dept: number; email?: string; user?: string; title?: string }[] = [
    { first: "Dianne", last: "Cruz", no: "EMP-0001", site: "MNL", dept: 0, email: "employee@mebs.local", user: "employee@mebs.local", title: "Customer Service Associate" },
    { first: "Amelia", last: "Reyes", no: "EMP-0002", site: "MNL", dept: 2, email: "admin@mebs.local", user: "admin@mebs.local", title: "Operations Director" },
    { first: "Joel", last: "Villanueva", no: "EMP-0003", site: "MNL", dept: 1, email: "technician@mebs.local", user: "technician@mebs.local", title: "IT Support Engineer" },
    { first: "Rhea", last: "Salazar", no: "EMP-0004", site: "MNL", dept: 0, email: "manager@mebs.local", user: "manager@mebs.local", title: "Team Manager" },
    { first: "Kevin", last: "Bautista", no: "EMP-0005", site: "MNL", dept: 1, email: "staff@mebs.local", user: "staff@mebs.local", title: "Inventory Clerk" },
    { first: "Maricel", last: "Tan", no: "EMP-0006", site: "CEB", dept: 0, email: "site.admin@mebs.local", user: "site.admin@mebs.local", title: "Site Manager" },
    { first: "Paolo", last: "Domingo", no: "EMP-0007", site: "CEB", dept: 1, email: "inventory.admin@mebs.local", user: "inventory.admin@mebs.local", title: "Inventory Administrator" },
    { first: "Lorna", last: "Mercado", no: "EMP-0008", site: "MNL", dept: 3, email: "auditor@mebs.local", user: "auditor@mebs.local", title: "Internal Auditor" },
    { first: "Arnel", last: "Panganiban", no: "EMP-0009", site: "MNL", dept: 0, title: "Customer Service Associate" },
    { first: "Bea", last: "Gonzales", no: "EMP-0010", site: "MNL", dept: 0, title: "Quality Analyst" },
    { first: "Carlo", last: "Mendoza", no: "EMP-0011", site: "CEB", dept: 0, title: "Customer Service Associate" },
    { first: "Daniela", last: "Lopez", no: "EMP-0012", site: "CEB", dept: 1, title: "Systems Administrator" },
    { first: "Emmanuel", last: "Santos", no: "EMP-0013", site: "DVO", dept: 0, title: "Customer Service Associate" },
    { first: "Fatima", last: "Abubakar", no: "EMP-0014", site: "DVO", dept: 3, title: "Payroll Specialist" },
    { first: "Gabriel", last: "Lim", no: "EMP-0015", site: "MNL", dept: 3, title: "Financial Analyst" },
    { first: "Hannah", last: "Dela Peña", no: "EMP-0016", site: "MNL", dept: 2, title: "HR Generalist" },
  ];

  const employees: { id: string; siteCode: string; deptIndex: number }[] = [];
  for (const seed of employeeSeeds) {
    const site = sites.find((s) => s.code === seed.site)!;
    const departmentId = departmentIds[seed.site][seed.dept];
    const existing = await prisma.employee.findFirst({
      where: { companyId: company.id, employeeNo: seed.no },
    });
    const employee =
      existing ??
      (await prisma.employee.create({
        data: {
          companyId: company.id,
          employeeNo: seed.no,
          siteId: site.id,
          departmentId,
          firstName: seed.first,
          lastName: seed.last,
          email: seed.email ?? `${seed.first.toLowerCase()}.${seed.last.toLowerCase()}@mebs.example`,
          jobTitle: seed.title ?? null,
          employmentStatus: "ACTIVE",
          hireDate: daysAgo(200 + Math.floor(rand() * 800)),
          userId: seed.user ? users[seed.user] : null,
        },
      }));
    if (!existing) created.employees += 1;
    employees.push({ id: employee.id, siteCode: seed.site, deptIndex: seed.dept });
  }
  console.log(`  ${employeeSeeds.length} employees`);

  const supplierSeeds = [
    { name: "Pacific IT Distribution", contactPerson: "Mia Fernandez", email: "sales@pacificit.example", phone: "+63 2 8555 2020", productsSupplied: "Laptops, monitors, peripherals" },
    { name: "Sunrise Office Supplies", contactPerson: "Nestor Aguilar", email: "orders@sunriseoffice.example", phone: "+63 2 8111 7788", productsSupplied: "Paper, toner, stationery" },
    { name: "NorthPoint Logistics", contactPerson: "Grace Yap", email: "ops@northpoint.example", phone: "+63 32 444 9090", productsSupplied: "Courier and freight" },
    { name: "Shield Safety Products", contactPerson: "Omar Rahman", email: "info@shieldsafety.example", phone: "+63 82 333 1212", productsSupplied: "PPE and facility safety" },
  ];
  const suppliers: string[] = [];
  for (const seed of supplierSeeds) {
    const existing = await prisma.supplier.findFirst({ where: { name: seed.name } });
    const supplier = existing ?? (await prisma.supplier.create({ data: seed }));
    if (!existing) created.suppliers += 1;
    suppliers.push(supplier.id);
  }

  const brandPool: Record<string, string[]> = {
    Laptop: ["Lenovo", "HP", "Dell"],
    Desktop: ["Dell", "HP", "Lenovo"],
    Monitor: ["Samsung", "LG", "Dell"],
    Headset: ["Jabra", "Logitech", "Poly"],
    "Mobile Phone": ["Samsung", "Apple", "Xiaomi"],
    Printer: ["HP", "Canon", "Epson"],
    "Office Furniture": ["Steelcase", "IKEA", "Davana"],
  };
  const modelPool: Record<string, string[]> = {
    Laptop: ["ThinkPad E14", "ProBook 450", "Inspiron 15"],
    Desktop: ["OptiPlex 7010", "ProDesk 400", "ThinkCentre M70"],
    Monitor: ["S24R650", "24MK430H", "P2419H"],
    Headset: ["Evolve2 40", "H390", "EncorePro"],
    "Mobile Phone": ["Galaxy A15", "iPhone 13", "Redmi Note 13"],
    Printer: ["LaserJet M211", "imageCLASS MF3010", "EcoTank L3250"],
    "Office Furniture": ["Task Chair", "Sit-Stand Desk", "3-Drawer Pedestal"],
  };

  const tagCounters = new Map<string, number>();
  function nextTag(prefix: string, siteCode: string): string {
    const key = `${prefix}-${siteCode}`;
    const value = (tagCounters.get(key) ?? 0) + 1;
    tagCounters.set(key, value);
    return `${key}-${String(value).padStart(5, "0")}`;
  }

  const assetSeeds: { category: string; site: string; days: number; status: AssetStatus; condition: AssetCondition; assigned: boolean }[] = [];  const statuses: AssetStatus[] = [
    "AVAILABLE", "AVAILABLE", "AVAILABLE", "ASSIGNED", "ASSIGNED", "ASSIGNED",
    "ASSIGNED", "ASSIGNED", "IN_STORAGE", "IN_STORAGE", "UNDER_MAINTENANCE",
    "DAMAGED", "RETIRED", "AVAILABLE", "ASSIGNED", "IN_STORAGE",
  ];
  for (let i = 0; i < 72; i++) {
    const category = pick(["Laptop", "Laptop", "Laptop", "Monitor", "Monitor", "Desktop", "Headset", "Mobile Phone", "Printer", "Office Furniture"]);
    const site = pick(["MNL", "MNL", "MNL", "CEB", "CEB", "DVO"]);
    const status = statuses[i % statuses.length];
    const assigned = status === "ASSIGNED";
    assetSeeds.push({
      category,
      site,
      days: Math.floor(rand() * 700),
      status,
      condition: assigned ? pick(["NEW", "EXCELLENT", "GOOD", "GOOD", "FAIR"]) : pick(["GOOD", "GOOD", "FAIR", "POOR", "EXCELLENT"]),
      assigned,
    });
  }

  const adminId = users["admin@mebs.local"];
  const technicianId = users["technician@mebs.local"];
  const staffId = users["staff@mebs.local"];
  const mnlId = mnl.id;
  const employeesMnl = employees.filter((e) => e.siteCode === "MNL");
  const employeesCeb = employees.filter((e) => e.siteCode === "CEB");

  const assetIds: { id: string; siteCode: string; assignedTo?: string; status: AssetStatus }[] = [];
  for (const seed of assetSeeds) {
    const site = sites.find((s) => s.code === seed.site)!;
    const category = categories[seed.category];
    const purchasedAt = daysAgo(seed.days);
    const warrantyMonths = seed.category === "Office Furniture" ? null : pick([12, 24, 36]);
    const tag = nextTag(category.prefix, seed.site);
    const alreadyExists = await prisma.asset.findUnique({
      where: { companyId_assetTag: { companyId: company.id, assetTag: tag } },
      select: { id: true },
    });
    if (alreadyExists) {
      assetIds.push({ id: alreadyExists.id, siteCode: seed.site, status: seed.status });
      continue;
    }

    const employeePool = seed.site === "MNL" ? employeesMnl : seed.site === "CEB" ? employeesCeb : employees;
    const assignee = seed.assigned && employeePool.length ? pick(employeePool) : null;

    const asset = await prisma.asset.create({
      data: {
        companyId: company.id,
        assetTag: tag,
        barcode: tag,
        qrCode: tag,
        serialNumber: `SN${seed.site}${String(Math.floor(rand() * 9_000_000) + 1_000_000)}`,
        name: `${seed.category} — ${pick(modelPool[seed.category] ?? ["Standard"])}`,
        description: null,
        categoryId: category.id,
        itemTypeId: category.types[0]?.id ?? null,
        manufacturer: pick(brandPool[seed.category] ?? ["Generic"]),
        brand: pick(brandPool[seed.category] ?? ["Generic"]),
        model: pick(modelPool[seed.category] ?? ["Standard"]),
        purchaseDate: purchasedAt,
        purchasePrice: Math.round(rand() * 45_000 + 3_500),
        currency: "PHP",
        supplierId: pick(suppliers),
        warrantyStart: purchasedAt,
        warrantyEnd: warrantyMonths ? new Date(purchasedAt.getTime() + warrantyMonths * 30 * 86_400_000) : null,
        warrantyMonths,
        siteId: site.id,
        roomId: null,
        stockLocationId: seed.assigned ? null : pick(locationIds[seed.site]),
        departmentId: pick(departmentIds[seed.site]),
        assignedEmployeeId: assignee?.id ?? null,
        createdById: adminId,
        status: seed.status,
        condition: seed.condition,
        receivedAt: purchasedAt,
        notes: null,
      },
    });
    created.assets += 1;
    assetIds.push({ id: asset.id, siteCode: seed.site, assignedTo: assignee?.id, status: seed.status });

    await prisma.assetTransaction.create({
      data: {
        assetId: asset.id,
        type: "RECEIVE",
        toStatus: "IN_STORAGE",
        toSiteId: site.id,
        performedById: adminId,
        referenceType: "SEED",
        notes: "Initial registration",
        createdAt: purchasedAt,
      },
    });

    if (assignee) {
      const assignedAt = daysAgo(Math.floor(rand() * Math.max(1, seed.days - 1)));
      await prisma.assetAssignment.create({
        data: {
          assetId: asset.id,
          employeeId: assignee.id,
          assignedById: adminId,
          assignedAt,
          siteId: site.id,
          departmentId: pick(departmentIds[seed.site]),
          conditionAtAssignment: asset.condition,
          status: rand() > 0.85 ? "RETURN_PENDING" : "ACTIVE",
          expectedReturnAt: daysAhead(Math.floor(rand() * 120) - 30),
          notes: null,
        },
      });
      await prisma.assetTransaction.create({
        data: {
          assetId: asset.id,
          type: "ASSIGN",
          fromStatus: "IN_STORAGE",
          toStatus: "ASSIGNED",
          toEmployeeId: assignee.id,
          performedById: adminId,
          referenceType: "SEED",
          createdAt: assignedAt,
        },
      });
    }
  }
  console.log(`  ${created.assets} assets`);

  const consumableSeeds = [
    { sku: "PPR-A4-80GSM", name: "A4 Bond Paper 80gsm (Ream)", category: "Paper & Printing", qty: 180, reorder: 60, unit: "REAM", cost: 210 },
    { sku: "PPR-A4-70GSM", name: "A4 Bond Paper 70gsm (Ream)", category: "Paper & Printing", qty: 44, reorder: 50, unit: "REAM", cost: 175 },
    { sku: "TNR-HP-85A", name: "HP 85A Toner Cartridge", category: "Toner & Ink", qty: 26, reorder: 10, unit: "EACH", cost: 4150 },
    { sku: "TNR-CE255X", name: "Canon CE255X Toner", category: "Toner & Ink", qty: 7, reorder: 10, unit: "EACH", cost: 6900 },
    { sku: "CBL-USBC-2M", name: "USB-C Cable 2m", category: "Cables & Adapters", qty: 320, reorder: 100, unit: "EACH", cost: 180 },
    { sku: "CBL-HDMI-3M", name: "HDMI Cable 3m", category: "Cables & Adapters", qty: 96, reorder: 40, unit: "EACH", cost: 320 },
    { sku: "PPE-MASK-BOX", name: "Surgical Mask (Box of 50)", category: "Safety & PPE", qty: 18, reorder: 25, unit: "BOX", cost: 145 },
    { sku: "PPE-GLOVE-M", name: "Nitrile Gloves Medium (Box)", category: "Safety & PPE", qty: 60, reorder: 20, unit: "BOX", cost: 320 },
  ];

  const inventoryIds: string[] = [];
  for (const [index, seed] of consumableSeeds.entries()) {
    const site = sites[index % sites.length];
    const locationId = locationIds[site.code][index % locationIds[site.code].length];
    const category = categories[seed.category];
    const existing = await prisma.inventoryItem.findFirst({
      where: { companyId: company.id, sku: seed.sku, siteId: site.id, stockLocationId: locationId },
    });
    const item =
      existing ??
      (await prisma.inventoryItem.create({
        data: {
          companyId: company.id,
          sku: seed.sku,
          name: seed.name,
          categoryId: category.id,
          siteId: site.id,
          stockLocationId: locationId,
          unit: seed.unit,
          currentQty: seed.qty,
          minQty: Math.floor(seed.reorder / 2),
          reorderLevel: seed.reorder,
          unitCost: seed.cost,
          supplierId: pick(suppliers),
          lastMovementAt: daysAgo(Math.floor(rand() * 30)),
        },
      }));
    if (!existing) created.inventory += 1;
    inventoryIds.push(item.id);

    const existingTx = await prisma.inventoryTransaction.count({ where: { inventoryItemId: item.id } });
    if (existingTx === 0) {
      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          type: "RECEIVE",
          quantity: seed.qty,
          balanceAfter: seed.qty,
          unitCost: seed.cost,
          toSiteId: site.id,
          toLocationId: locationId,
          performedById: staffId,
          referenceType: "SEED",
          notes: "Opening balance",
          createdAt: daysAgo(120),
        },
      });
      const issued = Math.floor(seed.qty * 0.15);
      if (issued > 0) {
        await prisma.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            type: "ISSUE",
            quantity: -issued,
            balanceAfter: seed.qty - issued,
            unitCost: seed.cost,
            fromSiteId: site.id,
            fromLocationId: locationId,
            performedById: staffId,
            referenceType: "SEED",
            notes: "Issued to operations",
            createdAt: daysAgo(30),
          },
        });
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { currentQty: seed.qty - issued },
        });
      }
    }
  }
  console.log(`  ${inventoryIds.length} inventory items`);

  const supplierId = suppliers[0];
  const poNumber = `PO-${mnl.code}-202609-0001`;
  const existingPo = await prisma.purchaseOrder.findFirst({ where: { poNumber } });
  const po =
    existingPo ??
    (await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        siteId: mnlId,
        status: "RECEIVED",
        orderDate: daysAgo(45),
        expectedDate: daysAgo(30),
        requestedById: staffId,
        approvedById: adminId,
        currency: "PHP",
        subtotal: 402_000,
        taxAmount: 48_240,
        totalAmount: 450_240,
        notes: "Q3 workstation refresh",
        items: {
          create: [
            { categoryId: categories["Laptop"].id, description: "Standard business laptop", quantity: 6, receivedQty: 6, unitCost: 62_000, totalCost: 372_000 },
            { categoryId: categories["Monitor"].id, description: '24" LED monitor', quantity: 6, receivedQty: 6, unitCost: 5_000, totalCost: 30_000 },
          ],
        },
      },
    }));
  if (!existingPo) created.suppliers += 0;

  const receiptNumber = `RCV-${mnl.code}-202609-0001`;
  const existingReceipt = await prisma.receiving.findFirst({ where: { receiptNumber } });
  if (!existingReceipt) {
    await prisma.receiving.create({
      data: {
        receiptNumber,
        poId: po.id,
        supplierId,
        siteId: mnlId,
        stockLocationId: locationIds[mnl.code][0],
        receivedById: staffId,
        deliveryDate: daysAgo(30),
        invoiceNumber: "INV-2026-0912",
        totalCost: 450_240,
        notes: "Delivered and verified",
        items: {
          create: [
            { kind: "ASSET", categoryId: categories["Laptop"].id, description: "Standard business laptop", quantity: 6, unitCost: 62_000, totalCost: 372_000 },
            { kind: "ASSET", categoryId: categories["Monitor"].id, description: '24" LED monitor', quantity: 6, unitCost: 5_000, totalCost: 30_000 },
          ],
        },
      },
    });
  }

  const transferSeeds: { from: string; to: string; status: TransferStatus; assets: number; items: number; days: number }[] = [
    { from: "MNL", to: "CEB", status: "COMPLETED", assets: 3, items: 1, days: 60 },
    { from: "CEB", to: "MNL", status: "IN_TRANSIT", assets: 2, items: 1, days: 6 },
    { from: "MNL", to: "DVO", status: "PENDING_APPROVAL", assets: 2, items: 0, days: 2 },
  ];
  for (const [index, seed] of transferSeeds.entries()) {
    const transferNumber = `TRF-${seed.from}-${seed.to}-20260${9 - index}-000${index + 1}`;
    const existing = await prisma.transfer.findFirst({ where: { transferNumber } });
    if (existing) continue;
    const fromSite = sites.find((s) => s.code === seed.from)!;
    const toSite = sites.find((s) => s.code === seed.to)!;
    const candidates = assetIds.filter((a) => a.siteCode === seed.from && a.status !== "ASSIGNED").slice(index * 3, index * 3 + seed.assets);
    const requestedAt = daysAgo(seed.days);

    const transfer = await prisma.transfer.create({
      data: {
        transferNumber,
        fromSiteId: fromSite.id,
        toSiteId: toSite.id,
        fromLocationId: locationIds[seed.from][0],
        toLocationId: locationIds[seed.to][0],
        status: seed.status,
        requestedById: staffId,
        approvedById: seed.status === "PENDING_APPROVAL" ? null : adminId,
        requestedAt,
        approvedAt: seed.status === "PENDING_APPROVAL" ? null : daysAgo(seed.days - 1),
        shippedAt: ["IN_TRANSIT", "COMPLETED"].includes(seed.status) ? daysAgo(Math.max(1, seed.days - 2)) : null,
        actualArrival: seed.status === "COMPLETED" ? daysAgo(seed.days - 1) : null,
        expectedArrival: daysAhead(seed.status === "COMPLETED" ? -seed.days + 1 : 3),
        courier: "NorthPoint Logistics",
        notes: index === 0 ? "Quarterly reallocation of spare units" : null,
      },
    });

    for (const asset of candidates) {
      await prisma.transferAsset.create({
        data: {
          transferId: transfer.id,
          assetId: asset.id,
          status: seed.status === "COMPLETED" ? "RECEIVED" : seed.status === "IN_TRANSIT" ? "SENT" : "PENDING",
          conditionAtSend: "GOOD",
          conditionAtReceive: seed.status === "COMPLETED" ? "GOOD" : null,
          receivedAt: seed.status === "COMPLETED" ? daysAgo(seed.days - 1) : null,
        },
      });
      if (seed.status === "COMPLETED") {
        await prisma.asset.update({
          where: { id: asset.id },
          data: { siteId: toSite.id, stockLocationId: locationIds[seed.to][0] },
        });
        await prisma.assetTransaction.create({
          data: {
            assetId: asset.id,
            type: "TRANSFER",
            fromSiteId: fromSite.id,
            toSiteId: toSite.id,
            performedById: adminId,
            referenceType: "TRANSFER",
            referenceId: transfer.id,
            notes: transferNumber,
            createdAt: daysAgo(seed.days - 1),
          },
        });
      }
    }

    if (seed.items > 0) {
      const inventoryId = inventoryIds[index % inventoryIds.length];
      const quantity = 25 + index * 5;
      await prisma.transferItem.create({
        data: {
          transferId: transfer.id,
          inventoryItemId: inventoryId,
          quantity,
          receivedQuantity: seed.status === "COMPLETED" ? quantity : null,
          status: seed.status === "COMPLETED" ? "RECEIVED" : seed.status === "IN_TRANSIT" ? "SENT" : "PENDING",
          receivedAt: seed.status === "COMPLETED" ? daysAgo(seed.days - 1) : null,
        },
      });
    }
    created.transfers += 1;
  }

  const maintenanceSeeds: { assetIndex: number; status: MaintenanceStatus; days: number; issue: string; cost: number }[] = [
    { assetIndex: 2, status: "IN_REPAIR", days: 5, issue: "Laptop will not power on; suspected motherboard failure", cost: 6500 },
    { assetIndex: 7, status: "REPORTED", days: 1, issue: "Monitor flickers intermittently when cold", cost: 0 },
    { assetIndex: 11, status: "AWAITING_PARTS", days: 12, issue: "Printer pickup roller worn, parts on order", cost: 1800 },
    { assetIndex: 15, status: "RETURNED_TO_SERVICE", days: 45, issue: "Battery swollen — replaced under warranty", cost: 0 },
    { assetIndex: 19, status: "COMPLETED", days: 70, issue: "Headset microphone not detected", cost: 950 },
  ];
  for (const [index, seed] of maintenanceSeeds.entries()) {
    const asset = assetIds[seed.assetIndex % assetIds.length];
    const referenceNo = `MNT-2026${String(9 - index).padStart(2, "0")}-000${index + 1}`;
    const existing = await prisma.maintenanceRecord.findFirst({ where: { referenceNo } });
    if (existing) continue;
    await prisma.maintenanceRecord.create({
      data: {
        assetId: asset.id,
        referenceNo,
        issue: seed.issue,
        reportedById: technicianId,
        technicianId: ["IN_REPAIR", "AWAITING_PARTS"].includes(seed.status) ? technicianId : null,
        vendorId: seed.cost > 0 ? pick(suppliers) : null,
        status: seed.status,
        diagnosis: ["IN_REPAIR", "COMPLETED", "RETURNED_TO_SERVICE"].includes(seed.status) ? "Fault confirmed by technician inspection." : null,
        repairAction: seed.status === "RETURNED_TO_SERVICE" ? "Replaced failed component and stress tested for 24 hours." : null,
        partsUsed: seed.cost > 0 ? "Replacement unit + thermal paste" : null,
        cost: seed.cost,
        reportedAt: daysAgo(seed.days),
        startedAt: seed.status === "REPORTED" ? null : daysAgo(Math.max(0, seed.days - 1)),
        completedAt: ["COMPLETED", "RETURNED_TO_SERVICE"].includes(seed.status) ? daysAgo(Math.max(0, seed.days - 3)) : null,
        returnedAt: seed.status === "RETURNED_TO_SERVICE" ? daysAgo(Math.max(0, seed.days - 2)) : null,
        notes: null,
      },
    });
    if (["IN_REPAIR", "AWAITING_PARTS"].includes(seed.status)) {
      await prisma.asset.update({ where: { id: asset.id }, data: { status: "UNDER_MAINTENANCE" } });
    }
    created.maintenance += 1;
  }

  const notificationSeeds: { userId: string; type: "LOW_STOCK" | "PENDING_APPROVAL" | "WARRANTY_EXPIRING" | "MAINTENANCE_UPDATE" | "GENERAL"; title: string; body: string; link: string; days: number }[] = [
    { userId: adminId, type: "PENDING_APPROVAL", title: "Transfer awaiting approval", body: "TRF-MNL-DVO-202609-0003 needs your approval.", link: "/transfers", days: 2 },
    { userId: users["inventory.admin@mebs.local"], type: "LOW_STOCK", title: "Low stock: A4 Bond Paper 70gsm", body: "On hand is below the reorder level.", link: "/inventory", days: 3 },
    { userId: users["inventory.admin@mebs.local"], type: "LOW_STOCK", title: "Low stock: Canon CE255X Toner", body: "On hand is below the reorder level.", link: "/inventory", days: 4 },
    { userId: technicianId, type: "MAINTENANCE_UPDATE", title: "Ticket in repair", body: "MNT-202609-0001 is now In Repair.", link: "/maintenance", days: 5 },
    { userId: users["site.admin@mebs.local"], type: "WARRANTY_EXPIRING", title: "Warranty expiring soon", body: "Several assets at Cebu IT Park expire within 90 days.", link: "/reports/warranty-expiry", days: 6 },
    { userId: users["employee@mebs.local"], type: "GENERAL", title: "Welcome to MEBS Inventory", body: "Review the assets assigned to you from the My Assets page.", link: "/my", days: 9 },
  ];
  for (const seed of notificationSeeds) {
    await prisma.notification.create({
      data: {
        userId: seed.userId,
        type: seed.type,
        title: seed.title,
        body: seed.body,
        link: seed.link,
        createdAt: daysAgo(seed.days),
        readAt: seed.days > 6 ? daysAgo(seed.days - 1) : null,
      },
    });
  }

  const auditSeeds: { userId: string; action: "LOGIN" | "ASSET_CREATED" | "STOCK_RECEIVED" | "TRANSFER_COMPLETED" | "USER_CREATED"; days: number; description: string }[] = [
    { userId: adminId, action: "LOGIN", days: 0.2, description: "Amelia Reyes signed in" },
    { userId: staffId, action: "ASSET_CREATED", days: 1, description: "Registered new asset" },
    { userId: adminId, action: "STOCK_RECEIVED", days: 3, description: `Completed receipt ${receiptNumber}` },
    { userId: adminId, action: "TRANSFER_COMPLETED", days: 59, description: "Transfer TRF-MNL-CEB-202609-0001 received" },
    { userId: adminId, action: "USER_CREATED", days: 7, description: "Created user account" },
  ];
  for (const seed of auditSeeds) {
    await prisma.auditLog.create({
      data: {
        userId: seed.userId,
        action: seed.action,
        entityType: "System",
        description: seed.description,
        ip: "127.0.0.1",
        createdAt: daysAgo(seed.days),
      },
    });
  }

  console.log("\nSeed complete:");
  console.table(created);
  console.log("\nSign in with any of these accounts:");
  console.log(`  ${userSeeds.map((u) => `${u.email} (${u.role})`).join("\n  ")}`);
  console.log(`  Password: ${SEED_PASSWORD}`);
  console.log("  Change it after first login, or re-run with SEED_RESET_PASSWORD=1.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
