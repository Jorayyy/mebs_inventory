import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "../src/generated/prisma";

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

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@mebs.local";

/**
 * Blanks the database back to a fresh system:
 * keeps permissions, roles, the company row and the admin login,
 * deletes every business record (sites, catalogue, assets, stock,
 * transfers, tickets, suppliers, employees, users, notifications, audit).
 *
 *   npm run db:blank -- --yes
 */
async function main() {
  if (!process.argv.includes("--yes")) {
    console.log("This deletes every business record in the database.");
    console.log("Kept: permissions, roles, company, " + ADMIN_EMAIL);
    console.log("Run again with --yes to proceed:  npm run db:blank -- --yes");
    return;
  }

  const before = {
    users: await prisma.user.count(),
    sites: await prisma.site.count(),
    categories: await prisma.category.count(),
    stockLocations: await prisma.stockLocation.count(),
    departments: await prisma.department.count(),
    employees: await prisma.employee.count(),
    assets: await prisma.asset.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    transfers: await prisma.transfer.count(),
    maintenance: await prisma.maintenanceRecord.count(),
    suppliers: await prisma.supplier.count(),
    purchaseOrders: await prisma.purchaseOrder.count(),
    receivings: await prisma.receiving.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
  };

  // Children first — respects every Restrict foreign key.
  const steps: [string, () => Promise<{ count: number }>][] = [
    ["audit logs", () => prisma.auditLog.deleteMany()],
    ["notifications", () => prisma.notification.deleteMany()],
    ["attachments", () => prisma.attachment.deleteMany()],
    ["disposals", () => prisma.disposalRecord.deleteMany()],
    ["maintenance records", () => prisma.maintenanceRecord.deleteMany()],
    ["assignments", () => prisma.assetAssignment.deleteMany()],
    ["asset transactions", () => prisma.assetTransaction.deleteMany()],
    ["transfer lines", async () => {
      await prisma.transferAsset.deleteMany();
      return prisma.transferItem.deleteMany();
    }],
    ["transfers", () => prisma.transfer.deleteMany()],
    ["receiving lines", () => prisma.receivingItem.deleteMany()],
    ["receivings", () => prisma.receiving.deleteMany()],
    ["purchase order lines", () => prisma.purchaseOrderItem.deleteMany()],
    ["purchase orders", () => prisma.purchaseOrder.deleteMany()],
    ["stock transactions", () => prisma.inventoryTransaction.deleteMany()],
    ["inventory items", () => prisma.inventoryItem.deleteMany()],
    ["assets", () => prisma.asset.deleteMany()],
    ["employees", () => prisma.employee.deleteMany()],
    ["user site scopes", () => prisma.userSite.deleteMany()],
    ["suppliers", () => prisma.supplier.deleteMany()],
    ["stock locations", () => prisma.stockLocation.deleteMany()],
    ["rooms", () => prisma.room.deleteMany()],
    ["floors", () => prisma.floor.deleteMany()],
    ["buildings", () => prisma.building.deleteMany()],
    ["teams", () => prisma.team.deleteMany()],
    ["departments", () => prisma.department.deleteMany()],
    ["cost centers", () => prisma.costCenter.deleteMany()],
    ["sites", () => prisma.site.deleteMany()],
    ["item types", () => prisma.itemType.deleteMany()],
    ["categories", () => prisma.category.deleteMany()],
    ["users", () => prisma.user.deleteMany({ where: { email: { not: ADMIN_EMAIL } } })],
    ["system settings", () => prisma.systemSetting.deleteMany()],
  ];

  const removed: Record<string, number> = {};
  for (const [label, run] of steps) {
    const { count } = await run();
    if (count > 0) removed[label] = count;
  }

  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) throw new Error(`admin account ${ADMIN_EMAIL} is missing — run npm run db:seed`);

  const after = {
    users: await prisma.user.count(),
    sites: await prisma.site.count(),
    categories: await prisma.category.count(),
    assets: await prisma.asset.count(),
    inventoryItems: await prisma.inventoryItem.count(),
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
  };

  console.log("Blanked. Rows removed:");
  console.table(removed);
  console.log("Remaining:");
  console.table(after);
  console.log(`\nSign in with ${ADMIN_EMAIL} · password: ${process.env.SEED_PASSWORD ?? "ChangeMe123!"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });