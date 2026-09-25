"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser, isGlobal } from "@/lib/session";

export type SearchHit = {
  id: string;
  type: "asset" | "employee" | "stock" | "transfer" | "supplier" | "page";
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
};

/** Global search across assets, stock, people and transfers (server-side, site-scoped). */
export async function globalSearch(rawQuery: string): Promise<SearchHit[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];

  const user = await getSessionUser();
  if (!user) return [];

  const scope = isGlobal(user) ? {} : { siteId: { in: user.siteIds } };
  const q = query;
  const like = { contains: q, mode: "insensitive" as const };
  const results: SearchHit[] = [];

  const [assets, employees, stock, transfers, suppliers] = await Promise.all([
    prisma.asset.findMany({
      where: {
        ...scope,
        deletedAt: null,
        OR: [{ assetTag: like }, { serialNumber: like }, { name: like }, { model: like }, { brand: like }],
      },
      select: { id: true, assetTag: true, name: true, model: true, serialNumber: true, status: true },
      take: 6,
    }),
    prisma.employee.findMany({
      where: {
        ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }),
        deletedAt: null,
        OR: [{ firstName: like }, { lastName: like }, { employeeNo: like }, { email: like }],
      },
      select: { id: true, firstName: true, lastName: true, employeeNo: true, jobTitle: true },
      take: 5,
    }),
    prisma.inventoryItem.findMany({
      where: {
        ...scope,
        deletedAt: null,
        OR: [{ sku: like }, { name: like }],
      },
      select: { id: true, sku: true, name: true, currentQty: true, unit: true },
      take: 5,
    }),
    prisma.transfer.findMany({
      where: {
        ...(isGlobal(user) ? {} : { fromSiteId: { in: user.siteIds } }),
        OR: [{ transferNumber: like }, { referenceNumber: like }],
      },
      select: { id: true, transferNumber: true, status: true },
      take: 3,
    }),
    prisma.supplier.findMany({
      where: { name: like },
      select: { id: true, name: true, contactPerson: true },
      take: 3,
    }),
  ]);

  for (const a of assets) {
    results.push({
      id: a.id,
      type: "asset",
      title: a.assetTag,
      subtitle: `${a.name}${a.model ? ` · ${a.model}` : ""}${a.serialNumber ? ` · S/N ${a.serialNumber}` : ""}`,
      href: `/assets/${a.id}`,
      badge: a.status,
    });
  }
  for (const e of employees) {
    results.push({
      id: e.id,
      type: "employee",
      title: `${e.firstName} ${e.lastName}`,
      subtitle: `${e.employeeNo}${e.jobTitle ? ` · ${e.jobTitle}` : ""}`,
      href: `/employees/${e.id}`,
    });
  }
  for (const s of stock) {
    results.push({
      id: s.id,
      type: "stock",
      title: s.name,
      subtitle: `${s.sku} · ${s.currentQty.toString()} ${s.unit.toLowerCase()} on hand`,
      href: `/inventory/${s.id}`,
    });
  }
  for (const t of transfers) {
    results.push({
      id: t.id,
      type: "transfer",
      title: t.transferNumber,
      subtitle: `Transfer · ${t.status}`,
      href: `/transfers/${t.id}`,
    });
  }
  for (const s of suppliers) {
    results.push({
      id: s.id,
      type: "supplier",
      title: s.name,
      subtitle: s.contactPerson ?? "Supplier",
      href: `/suppliers/${s.id}`,
    });
  }

  return results.slice(0, 20);
}
