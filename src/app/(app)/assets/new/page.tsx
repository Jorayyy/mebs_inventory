import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { getFormOptions } from "@/actions/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { AssetForm } from "@/components/assets/asset-form";

export const metadata: Metadata = { title: "New asset" };

export default async function NewAssetPage() {
  await requirePermissionPage("/my", PERMISSIONS.ASSETS_CREATE);
  const options = await getFormOptions();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href="/assets" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Assets
          </Link>
        }
        title="Register asset"
        description="Serialized equipment with full identity, location and warranty tracking."
      />
      <AssetForm options={options} mode="create" />
    </div>
  );
}
