import type { Metadata } from "next";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { ScanClient } from "@/components/assets/scan-client";

export const metadata: Metadata = { title: "Scan asset" };

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requirePermissionPage("/my", PERMISSIONS.ASSETS_VIEW);
  const code = typeof searchParams.code === "string" ? searchParams.code : "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Scan / look up asset"
        description="Scan a QR code or type an asset tag, serial number or barcode. Hardware barcode scanners work like a keyboard."
      />
      <ScanClient initialCode={code} />
    </div>
  );
}
