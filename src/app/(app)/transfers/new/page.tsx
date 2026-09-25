import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { isGlobal, requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str } from "@/lib/query";
import { PageHeader } from "@/components/shared/page-header";
import { TransferForm } from "@/components/transfers/transfer-form";

export const metadata: Metadata = { title: "New transfer" };

export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", PERMISSIONS.TRANSFERS_CREATE);

  const assetIds = (str(searchParams, "assetIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const [sites, stockLocations, preselected] = await Promise.all([
    prisma.site.findMany({
      where: { status: "ACTIVE", ...(isGlobal(user) ? {} : { id: { in: user.siteIds } }) },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.stockLocation.findMany({
      where: { isActive: true, ...(isGlobal(user) ? {} : { siteId: { in: user.siteIds } }) },
      select: { id: true, name: true, siteId: true },
      orderBy: { name: "asc" },
    }),
    assetIds.length
      ? prisma.asset.findMany({
          where: { id: { in: assetIds }, deletedAt: null },
          select: { id: true, assetTag: true, name: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/transfers" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Transfers
          </Link>
        }
        title="New transfer"
        description="Move serialized assets and consumable stock between two sites."
      />

      <TransferForm
        sites={sites}
        stockLocations={stockLocations}
        initialAssets={preselected.map((asset) => ({
          id: asset.id,
          assetTag: asset.assetTag,
          name: asset.name,
          status: asset.status,
        }))}
      />
    </div>
  );
}
