import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadAssetDetail } from "@/lib/load-asset-detail";
import { PageHeader } from "@/components/shared/page-header";
import { AssetDetail } from "@/components/assets/asset-detail";

export const metadata: Metadata = { title: "Asset profile" };

export default async function AssetDetailPage({ params }: { params: { id: string } }) {
  const user = await requirePermissionPage("/my", PERMISSIONS.ASSETS_VIEW);
  const data = await loadAssetDetail(params.id, user);
  const asset = data.asset;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/assets" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Assets
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{asset.assetTag}</span>
            <span className="text-sm font-normal text-muted-foreground">{asset.name}</span>
          </span>
        }
        description={[
          asset.brand,
          asset.model,
          asset.serialNumber ? `S/N ${asset.serialNumber}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <AssetDetail data={data} />
    </div>
  );
}
