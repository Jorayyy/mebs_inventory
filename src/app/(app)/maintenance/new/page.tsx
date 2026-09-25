import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str } from "@/lib/query";
import { PageHeader } from "@/components/shared/page-header";
import { MaintenanceForm } from "@/components/maintenance/maintenance-form";

export const metadata: Metadata = { title: "New maintenance ticket" };

export default async function NewMaintenancePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requirePermissionPage("/my", PERMISSIONS.MAINTENANCE_MANAGE);

  const assetId = str(searchParams, "assetId");

  const [technicians, vendors, initialAsset] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        role: { key: { in: ["TECHNICIAN", "SITE_ADMIN", "INVENTORY_ADMIN"] } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      where: { status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    assetId ? prisma.asset.findUnique({ where: { id: assetId }, select: { id: true, assetTag: true, name: true, status: true } }) : null,
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/maintenance" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Maintenance
          </Link>
        }
        title="New maintenance ticket"
        description="Open a ticket for a single asset — duplicates on the same asset are rejected."
      />

      <MaintenanceForm
        technicians={technicians}
        vendors={vendors}
        initialAsset={initialAsset}
      />
    </div>
  );
}
