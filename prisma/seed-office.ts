import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient, type AssetCondition } from "../src/generated/prisma";

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

/**
 * Office starter dataset — the "first move":
 *   2 sites · 4 departments · 12 categories · 48 assets · 21 stock items · 4 suppliers
 * Nothing is assigned to employees (there are no employee records yet).
 * Idempotent: existing tags/SKUs/sites are skipped, so it is safe to re-run.
 *
 *   npm run db:seed:office
 */
const prisma = new PrismaClient();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@mebs.local";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const created = {
  sites: 0,
  departments: 0,
  categories: 0,
  suppliers: 0,
  assets: 0,
  stockItems: 0,
  stockRows: 0,
};

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Bootstrap missing — run `npm run db:seed` first.");
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error(`Missing ${ADMIN_EMAIL} — run \`npm run db:seed\` first.`);

  console.log("Seeding office starter dataset…");

  // ---------------------------------------------------------------- sites
  const siteSeeds = [
    { code: "HQ", name: "Head Office" },
    { code: "BRN", name: "Branch Office" },
  ];
  const sites: { id: string; code: string; name: string }[] = [];
  for (const seed of siteSeeds) {
    let site = await prisma.site.findFirst({
      where: { companyId: company.id, code: seed.code },
    });
    if (!site) {
      site = await prisma.site.create({
        data: { companyId: company.id, status: "ACTIVE", ...seed },
      });
      created.sites += 1;
    }
    sites.push(site);
  }
  const [hq, brn] = sites;
  const siteByCode = new Map(sites.map((s) => [s.code, s]));

  const locations = new Map<string, string>();
  for (const site of sites) {
    let location = await prisma.stockLocation.findFirst({
      where: { siteId: site.id, code: "STORE" },
    });
    if (!location) {
      location = await prisma.stockLocation.create({
        data: { siteId: site.id, code: "STORE", name: "Main Store", type: "STORAGE_ROOM" },
      });
    }
    locations.set(site.code, location.id);
  }

  // ---------------------------------------------------------- departments
  const DEPARTMENTS: [string, string][] = [
    ["OPS", "Operations"],
    ["IT", "Information Technology"],
    ["HR", "Human Resources"],
    ["FIN", "Finance & Accounting"],
  ];
  const departments = new Map<string, string>(); // `${site}:${code}` -> id
  for (const site of sites) {
    for (const [code, name] of DEPARTMENTS) {
      let department = await prisma.department.findFirst({
        where: { siteId: site.id, code },
      });
      if (!department) {
        department = await prisma.department.create({
          data: { companyId: company.id, siteId: site.id, code, name },
        });
        created.departments += 1;
      }
      departments.set(`${site.code}:${code}`, department.id);
    }
  }
  console.log(`  ${sites.length} sites · ${sites.length * DEPARTMENTS.length} departments`);

  // ----------------------------------------------------------- categories
  type CategorySeed = {
    name: string;
    group: "IT_EQUIPMENT" | "OFFICE_EQUIPMENT" | "OFFICE_SUPPLIES" | "FACILITIES_SAFETY" | "CUSTOM";
    prefix: string;
    mode: "ASSET" | "CONSUMABLE";
    types: { name: string; months?: number }[];
  };
  const CATEGORY_SEEDS: CategorySeed[] = [
    { name: "Desktop", group: "IT_EQUIPMENT", prefix: "DT", mode: "ASSET", types: [{ name: "Desktop PC", months: 36 }, { name: "All-in-One", months: 36 }] },
    { name: "Monitor", group: "IT_EQUIPMENT", prefix: "MON", mode: "ASSET", types: [{ name: '24" Monitor', months: 36 }, { name: '27" Monitor', months: 36 }] },
    { name: "Headset", group: "IT_EQUIPMENT", prefix: "HST", mode: "ASSET", types: [{ name: "USB Wired Headset", months: 12 }] },
    { name: "Printer & Office Machine", group: "OFFICE_EQUIPMENT", prefix: "POF", mode: "ASSET", types: [{ name: "Laser Printer", months: 12 }, { name: "Multifunction Printer", months: 12 }, { name: "Paper Shredder", months: 12 }] },
    { name: "Office Furniture", group: "OFFICE_EQUIPMENT", prefix: "FUR", mode: "ASSET", types: [{ name: "Office Desk" }, { name: "Task Chair" }, { name: "Filing Cabinet" }] },
    { name: "Network & Server Gear", group: "IT_EQUIPMENT", prefix: "NET", mode: "ASSET", types: [{ name: "Network Switch", months: 24 }, { name: "Router", months: 24 }, { name: "Wireless Access Point", months: 24 }] },
    { name: "Paper & Printing", group: "OFFICE_SUPPLIES", prefix: "PPR", mode: "CONSUMABLE", types: [] },
    { name: "Toner & Ink", group: "OFFICE_SUPPLIES", prefix: "TNR", mode: "CONSUMABLE", types: [] },
    { name: "Cables & Peripherals", group: "IT_EQUIPMENT", prefix: "CBL", mode: "CONSUMABLE", types: [] },
    { name: "Spare Parts", group: "CUSTOM", prefix: "SPR", mode: "CONSUMABLE", types: [] },
    { name: "Safety & Cleaning", group: "FACILITIES_SAFETY", prefix: "SAF", mode: "CONSUMABLE", types: [] },
    { name: "Pantry Supplies", group: "CUSTOM", prefix: "PNT", mode: "CONSUMABLE", types: [] },
  ];

  type CategoryRecord = { id: string; prefix: string; types: Map<string, string> };
  const categories = new Map<string, CategoryRecord>();
  for (const [index, seed] of CATEGORY_SEEDS.entries()) {
    const slug = slugify(seed.name);
    let category = await prisma.category.findFirst({
      where: { companyId: company.id, slug },
    });
    if (!category) {
      category = await prisma.category.create({
        data: {
          companyId: company.id,
          name: seed.name,
          slug,
          group: seed.group,
          trackingMode: seed.mode,
          tagPrefix: seed.prefix,
          sortOrder: index,
        },
      });
      created.categories += 1;
    }
    const types = new Map<string, string>();
    for (const typeSeed of seed.types) {
      const typeSlug = slugify(typeSeed.name);
      let type = await prisma.itemType.findFirst({
        where: { categoryId: category.id, slug: typeSlug },
      });
      if (!type) {
        type = await prisma.itemType.create({
          data: {
            categoryId: category.id,
            name: typeSeed.name,
            slug: typeSlug,
            tagPrefix: seed.prefix,
            defaultWarrantyMonths: typeSeed.months ?? null,
          },
        });
      }
      types.set(typeSeed.name, type.id);
    }
    categories.set(seed.name, { id: category.id, prefix: seed.prefix, types });
  }
  console.log(`  ${CATEGORY_SEEDS.length} categories · ${CATEGORY_SEEDS.reduce((n, c) => n + c.types.length, 0)} item types`);

  // ----------------------------------------------------------- suppliers
  const SUPPLIER_SEEDS = [
    { name: "Pacific IT Distribution", contactPerson: "Mia Fernandez", email: "sales@pacificit.example", phone: "+63 2 8555 2020", productsSupplied: "Desktops, monitors, headsets, network gear" },
    { name: "Sunrise Office Supplies", contactPerson: "Nestor Aguilar", email: "orders@sunriseoffice.example", phone: "+63 2 8111 7788", productsSupplied: "Paper, toner, batteries" },
    { name: "Shield Safety Products", contactPerson: "Omar Rahman", email: "info@shieldsafety.example", phone: "+63 82 333 1212", productsSupplied: "PPE, sanitizer, first aid" },
    { name: "Brew & Bite Foods", contactPerson: "Liza Gatchalian", email: "orders@brewbite.example", phone: "+63 2 8222 3344", productsSupplied: "Pantry supplies" },
  ];
  const suppliers = new Map<string, string>();
  for (const seed of SUPPLIER_SEEDS) {
    let supplier = await prisma.supplier.findFirst({ where: { name: seed.name } });
    if (!supplier) {
      supplier = await prisma.supplier.create({ data: seed });
      created.suppliers += 1;
    }
    suppliers.set(seed.name, supplier.id);
  }

  // -------------------------------------------------------------- assets
  type AssetSpec = {
    category: string;
    type: string;
    site: "HQ" | "BRN";
    count: number;
    brands: string[];
    models: string[];
    year: number;
    dept: string;
  };
  const ASSET_SPECS: AssetSpec[] = [
    { category: "Desktop", type: "Desktop PC", site: "HQ", count: 4, brands: ["Dell", "HP", "Lenovo"], models: ["OptiPlex 7010", "ProDesk 400 G6", "ThinkCentre M70"], year: 2022, dept: "IT" },
    { category: "Desktop", type: "All-in-One", site: "HQ", count: 1, brands: ["HP", "Lenovo"], models: ["ProOne 440 G9", "ThinkCentre M70z"], year: 2022, dept: "IT" },
    { category: "Desktop", type: "Desktop PC", site: "BRN", count: 2, brands: ["Dell", "HP"], models: ["OptiPlex 5000", "ProDesk 400 G6"], year: 2022, dept: "IT" },
    { category: "Desktop", type: "All-in-One", site: "BRN", count: 1, brands: ["Lenovo"], models: ["ThinkCentre M70z"], year: 2022, dept: "IT" },
    { category: "Monitor", type: '24" Monitor', site: "HQ", count: 6, brands: ["Dell", "Samsung", "LG"], models: ["P2419H", "S24R650", "24MK430H"], year: 2024, dept: "OPS" },
    { category: "Monitor", type: '27" Monitor', site: "HQ", count: 2, brands: ["Dell", "Samsung"], models: ["P2719H", "S27R650"], year: 2024, dept: "OPS" },
    { category: "Monitor", type: '24" Monitor', site: "BRN", count: 3, brands: ["Samsung", "LG"], models: ["S24R650", "24MK430H"], year: 2024, dept: "OPS" },
    { category: "Monitor", type: '27" Monitor', site: "BRN", count: 1, brands: ["Dell"], models: ["P2719H"], year: 2024, dept: "OPS" },
    { category: "Headset", type: "USB Wired Headset", site: "HQ", count: 10, brands: ["Jabra", "Logitech", "Poly"], models: ["Evolve2 40", "H390", "EncorePro 50"], year: 2023, dept: "OPS" },
    { category: "Headset", type: "USB Wired Headset", site: "BRN", count: 4, brands: ["Jabra", "Logitech"], models: ["Evolve2 40", "H390"], year: 2023, dept: "OPS" },
    { category: "Printer & Office Machine", type: "Laser Printer", site: "HQ", count: 1, brands: ["HP"], models: ["LaserJet M211"], year: 2021, dept: "IT" },
    { category: "Printer & Office Machine", type: "Multifunction Printer", site: "HQ", count: 1, brands: ["Canon"], models: ["imageCLASS MF3010"], year: 2021, dept: "IT" },
    { category: "Printer & Office Machine", type: "Paper Shredder", site: "BRN", count: 1, brands: ["Aurora"], models: ["AU2012SH"], year: 2021, dept: "OPS" },
    { category: "Office Furniture", type: "Office Desk", site: "HQ", count: 2, brands: ["Steelcase", "Davana"], models: ["Series 1 Desk 1.2m", "Work Desk 1.2m"], year: 2021, dept: "OPS" },
    { category: "Office Furniture", type: "Task Chair", site: "HQ", count: 1, brands: ["Ergo"], models: ["Executive Task Chair"], year: 2021, dept: "OPS" },
    { category: "Office Furniture", type: "Filing Cabinet", site: "HQ", count: 1, brands: ["Davana"], models: ["3-Drawer Filing Cabinet"], year: 2021, dept: "HR" },
    { category: "Office Furniture", type: "Office Desk", site: "BRN", count: 1, brands: ["Davana"], models: ["Work Desk 1.2m"], year: 2021, dept: "OPS" },
    { category: "Office Furniture", type: "Task Chair", site: "BRN", count: 1, brands: ["Ergo"], models: ["Executive Task Chair"], year: 2021, dept: "OPS" },
    { category: "Network & Server Gear", type: "Network Switch", site: "HQ", count: 1, brands: ["TP-Link"], models: ["TL-SG1024D"], year: 2022, dept: "IT" },
    { category: "Network & Server Gear", type: "Router", site: "HQ", count: 1, brands: ["MikroTik"], models: ["hEX S RB760iGS"], year: 2022, dept: "IT" },
    { category: "Network & Server Gear", type: "Wireless Access Point", site: "HQ", count: 1, brands: ["Ubiquiti"], models: ["UniFi U6 Lite"], year: 2022, dept: "IT" },
    { category: "Network & Server Gear", type: "Network Switch", site: "BRN", count: 1, brands: ["TP-Link"], models: ["TL-SG1016D"], year: 2022, dept: "IT" },
    { category: "Network & Server Gear", type: "Wireless Access Point", site: "BRN", count: 1, brands: ["TP-Link"], models: ["EAP245"], year: 2022, dept: "IT" },
  ];

  const CONDITION_BY_YEAR: Record<number, AssetCondition[]> = {
    2024: ["NEW", "EXCELLENT"],
    2023: ["EXCELLENT", "GOOD"],
    2022: ["GOOD", "EXCELLENT"],
    2021: ["GOOD", "FAIR"],
  };

  const tagCounters = new Map<string, number>();
  let serial = 0;

  for (const spec of ASSET_SPECS) {
    const category = categories.get(spec.category);
    const site = siteByCode.get(spec.site);
    if (!category || !site) throw new Error(`Missing category/site for ${spec.category}/${spec.site}`);
    const typeId = category.types.get(spec.type) ?? null;
    const warrantyMonths =
      spec.category === "Office Furniture"
        ? null
        : spec.category === "Monitor" || spec.category === "Desktop"
          ? 36
          : spec.category === "Network & Server Gear"
            ? 24
            : 12;

    for (let i = 0; i < spec.count; i++) {
      const counterKey = `${category.prefix}-${site.code}`;
      const next = (tagCounters.get(counterKey) ?? 0) + 1;
      tagCounters.set(counterKey, next);
      const tag = `${category.prefix}-${site.code}-${String(next).padStart(4, "0")}`;

      const existing = await prisma.asset.findUnique({
        where: { companyId_assetTag: { companyId: company.id, assetTag: tag } },
        select: { id: true },
      });
      if (existing) continue;

      serial += 1;
      const brand = spec.brands[i % spec.brands.length];
      const model = spec.models[i % spec.models.length];
      const purchasedAt = new Date(Date.UTC(spec.year, (serial * 5) % 12, ((serial * 7) % 27) + 1));
      const condition = (CONDITION_BY_YEAR[spec.year] ?? ["GOOD"])[i % 2];

      const asset = await prisma.asset.create({
        data: {
          companyId: company.id,
          assetTag: tag,
          barcode: tag,
          qrCode: tag,
          serialNumber: `SN${site.code}${String(serial).padStart(4, "0")}`,
          name: `${spec.type} — ${brand} ${model}`,
          categoryId: category.id,
          itemTypeId: typeId,
          manufacturer: brand,
          brand,
          model,
          purchaseDate: purchasedAt,
          warrantyStart: warrantyMonths ? purchasedAt : null,
          warrantyEnd: warrantyMonths
            ? new Date(purchasedAt.getTime() + warrantyMonths * 30 * 86_400_000)
            : null,
          warrantyMonths,
          siteId: site.id,
          departmentId: departments.get(`${site.code}:${spec.dept}`) ?? null,
          createdById: admin.id,
          status: "AVAILABLE",
          condition,
          receivedAt: purchasedAt,
        },
      });
      created.assets += 1;

      await prisma.assetTransaction.create({
        data: {
          assetId: asset.id,
          type: "RECEIVE",
          toStatus: "AVAILABLE",
          toSiteId: site.id,
          performedById: admin.id,
          referenceType: "OPENING",
          notes: "Opening stock of office equipment",
          createdAt: purchasedAt,
        },
      });
    }
  }

  // ---------------------------------------------------------- stock items
  type StockSeed = {
    sku: string;
    name: string;
    category: string;
    unit: string;
    qty: Record<string, number>;
    reorder: number;
    cost: number;
    supplier: string;
  };
  const STOCK_SEEDS: StockSeed[] = [
    { sku: "PPR-A4-80GSM", name: "A4 Bond Paper 80gsm (Ream)", category: "Paper & Printing", unit: "REAM", qty: { HQ: 40, BRN: 15 }, reorder: 15, cost: 210, supplier: "Sunrise Office Supplies" },
    { sku: "PPR-A4-70GSM", name: "A4 Bond Paper 70gsm (Ream)", category: "Paper & Printing", unit: "REAM", qty: { HQ: 20 }, reorder: 8, cost: 175, supplier: "Sunrise Office Supplies" },
    { sku: "TNR-HP-85A", name: "HP 85A Toner Cartridge", category: "Toner & Ink", unit: "EACH", qty: { HQ: 4, BRN: 2 }, reorder: 2, cost: 4150, supplier: "Sunrise Office Supplies" },
    { sku: "TNR-CN-052", name: "Canon 052 Toner Cartridge", category: "Toner & Ink", unit: "EACH", qty: { HQ: 2 }, reorder: 2, cost: 3900, supplier: "Sunrise Office Supplies" },
    { sku: "CBL-USBC-2M", name: "USB-C Cable 2m", category: "Cables & Peripherals", unit: "EACH", qty: { HQ: 25 }, reorder: 10, cost: 180, supplier: "Pacific IT Distribution" },
    { sku: "CBL-HDMI-3M", name: "HDMI Cable 3m", category: "Cables & Peripherals", unit: "EACH", qty: { HQ: 15 }, reorder: 5, cost: 320, supplier: "Pacific IT Distribution" },
    { sku: "CBL-CAT6-5M", name: "Cat6 Ethernet Cable 5m", category: "Cables & Peripherals", unit: "EACH", qty: { HQ: 20, BRN: 8 }, reorder: 8, cost: 250, supplier: "Pacific IT Distribution" },
    { sku: "PHL-KB-MSE", name: "Wireless Keyboard & Mouse Set", category: "Cables & Peripherals", unit: "SET", qty: { HQ: 6 }, reorder: 3, cost: 1450, supplier: "Pacific IT Distribution" },
    { sku: "SPR-HS-CUSH", name: "Headset Ear Cushion (Pair)", category: "Spare Parts", unit: "PAIR", qty: { HQ: 12 }, reorder: 4, cost: 450, supplier: "Pacific IT Distribution" },
    { sku: "SPR-AA-24", name: "AA Alkaline Batteries (24-pack)", category: "Spare Parts", unit: "BOX", qty: { HQ: 8 }, reorder: 3, cost: 620, supplier: "Sunrise Office Supplies" },
    { sku: "SAF-SAN-500", name: "Hand Sanitizer 500ml", category: "Safety & Cleaning", unit: "BOTTLE", qty: { HQ: 18, BRN: 6 }, reorder: 6, cost: 165, supplier: "Shield Safety Products" },
    { sku: "SAF-GLV-M", name: "Nitrile Gloves Medium (Box of 100)", category: "Safety & Cleaning", unit: "BOX", qty: { HQ: 10 }, reorder: 4, cost: 480, supplier: "Shield Safety Products" },
    { sku: "SAF-FA-REF", name: "First Aid Kit Refill", category: "Safety & Cleaning", unit: "KIT", qty: { HQ: 3 }, reorder: 1, cost: 890, supplier: "Shield Safety Products" },
    { sku: "PNT-COF-30", name: "Coffee Mix Sachets (Box of 30)", category: "Pantry Supplies", unit: "BOX", qty: { HQ: 12, BRN: 5 }, reorder: 4, cost: 540, supplier: "Brew & Bite Foods" },
    { sku: "PNT-CUP-8OZ", name: "Paper Cups 8oz (50 pcs)", category: "Pantry Supplies", unit: "PACK", qty: { HQ: 15 }, reorder: 5, cost: 190, supplier: "Brew & Bite Foods" },
    { sku: "PNT-SGR-1K", name: "White Sugar 1kg", category: "Pantry Supplies", unit: "KG", qty: { HQ: 6 }, reorder: 2, cost: 95, supplier: "Brew & Bite Foods" },
  ];

  const openingDate = new Date(Date.now() - 30 * 86_400_000);
  for (const seed of STOCK_SEEDS) {
    const category = categories.get(seed.category);
    if (!category) throw new Error(`Missing category ${seed.category}`);
    for (const [code, qty] of Object.entries(seed.qty)) {
      const site = siteByCode.get(code);
      const locationId = locations.get(code);
      if (!site || !locationId) continue;

      let item = await prisma.inventoryItem.findFirst({
        where: {
          companyId: company.id,
          sku: seed.sku,
          siteId: site.id,
          stockLocationId: locationId,
        },
      });
      if (!item) {
        item = await prisma.inventoryItem.create({
          data: {
            companyId: company.id,
            sku: seed.sku,
            name: seed.name,
            categoryId: category.id,
            siteId: site.id,
            stockLocationId: locationId,
            unit: seed.unit,
            currentQty: qty,
            minQty: Math.floor(seed.reorder / 2),
            reorderLevel: seed.reorder,
            unitCost: seed.cost,
            supplierId: suppliers.get(seed.supplier) ?? null,
            lastMovementAt: openingDate,
          },
        });
        created.stockItems += 1;

        await prisma.inventoryTransaction.create({
          data: {
            inventoryItemId: item.id,
            type: "RECEIVE",
            quantity: qty,
            balanceAfter: qty,
            unitCost: seed.cost,
            toSiteId: site.id,
            toLocationId: locationId,
            performedById: admin.id,
            referenceType: "OPENING",
            notes: "Opening balance",
            createdAt: openingDate,
          },
        });
        created.stockRows += 1;
      }
    }
  }

  console.log("\nOffice dataset ready:");
  console.table(created);
  console.log(`\nAssets are all AVAILABLE and unassigned — no employee records were created.`);
  console.log(`Sites: ${sites.map((s) => `${s.name} (${s.code})`).join(", ")} — rename them under Settings → Organization.`);
  console.log(`Asset tags follow PREFIX-SITE-0001 (e.g. ${categories.get("Desktop")!.prefix}-${hq.code}-0001).`);
  console.log(`Branch site id used: ${brn.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
