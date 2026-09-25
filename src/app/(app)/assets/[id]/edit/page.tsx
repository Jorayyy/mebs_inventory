import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage, assertSiteAccess } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { getFormOptions } from "@/actions/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { AssetForm } from "@/components/assets/asset-form";

export const metadata: Metadata = { title: "Edit asset" };

export default async function EditAssetPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermissionPage("/my", PERMISSIONS.ASSETS_UPDATE);
  const user = await requirePermissionPage("/my", PERMISSIONS.ASSETS_VIEW);

  const asset = await prisma.asset.findUnique({
    where: { id: params.id },
    include: { category: true },
  });
  if (!asset || asset.deletedAt) notFound();
  assertSiteAccess(user, asset.siteId);

  const options = await getFormOptions();

  const initial = {
    id: asset.id,
    siteId: asset.siteId,
    categoryId: asset.categoryId,
    itemTypeId: asset.itemTypeId ?? "",
    name: asset.name,
    assetTag: asset.assetTag,
    serialNumber: asset.serialNumber ?? "",
    barcode: asset.barcode ?? "",
    description: asset.description ?? "",
    manufacturer: asset.manufacturer ?? "",
    brand: asset.brand ?? "",
    model: asset.model ?? "",
    purchaseDate: asset.purchaseDate ? asset.purchaseDate.toISOString().slice(0, 10) : "",
    purchasePrice: asset.purchasePrice ? Number(asset.purchasePrice) : "",
    supplierId: asset.supplierId ?? "",
    warrantyMonths: asset.warrantyMonths ?? "",
    warrantyStart: asset.warrantyStart ? asset.warrantyStart.toISOString().slice(0, 10) : "",
    roomId: asset.roomId ?? "",
    stockLocationId: asset.stockLocationId ?? "",
    departmentId: asset.departmentId ?? "",
    costCenterId: asset.costCenterId ?? "",
    status: asset.status,
    condition: asset.condition,
    notes: asset.notes ?? "",
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href={`/assets/${asset.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> {asset.assetTag}
          </Link>
        }
        title={`Edit ${asset.assetTag}`}
        description={asset.name}
      />
      <AssetForm options={options} mode="edit" initial={initial} />
    </div>
  );
}
