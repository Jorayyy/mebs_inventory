import type { Metadata } from "next";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { PrintLabelsDialog } from "@/components/assets/print-labels-dialog";

export const metadata: Metadata = { title: "Print labels" };

export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requirePermissionPage("/my", PERMISSIONS.ASSETS_PRINT_LABELS);

  const raw = searchParams.ids ?? searchParams.id ?? "";
  const ids = (Array.isArray(raw) ? raw[0] : raw)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <PageHeader
        title="QR label printing"
        description="Select assets on the Assets page, or open this page with ?ids=<assetId>. Labels print as a sheet and can be downloaded as CSV."
      />
      <PrintLabelsDialog defaultOpen assetIds={ids} defaults={{ copies: 1 }} />
    </div>
  );
}
