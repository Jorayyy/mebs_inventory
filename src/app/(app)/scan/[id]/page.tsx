import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ScanLine } from "lucide-react";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadAssetDetail } from "@/lib/load-asset-detail";
import { PageHeader } from "@/components/shared/page-header";
import { AssetDetail } from "@/components/assets/asset-detail";

export const metadata: Metadata = { title: "Scanned asset" };

/** Destination for QR scans: the full asset profile with scan context. */
export default async function ScannedAssetPage({ params }: { params: { id: string } }) {
  const user = await requirePermissionPage("/my", PERMISSIONS.ASSETS_VIEW);
  const data = await loadAssetDetail(params.id, user);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/scan" className="inline-flex items-center gap-1 hover:text-foreground">
            <ScanLine className="h-3 w-3" /> Scanner
          </Link>
        }
        title={data.asset.assetTag}
        description={data.asset.name}
        actions={
          <Link
            href={`/scan?code=${encodeURIComponent(data.asset.assetTag)}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Scan another
          </Link>
        }
      />
      <AssetDetail data={data} />
    </div>
  );
}
