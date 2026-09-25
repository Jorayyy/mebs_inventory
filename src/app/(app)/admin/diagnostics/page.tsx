import type { Metadata } from "next";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { runDiagnostics } from "@/actions/diagnostics";
import { PageHeader } from "@/components/shared/page-header";
import { DiagnosticsView } from "@/components/diagnostics/diagnostics-view";

export const metadata: Metadata = { title: "Diagnostics" };

export default async function DiagnosticsPage() {
  await requirePermissionPage("/my", PERMISSIONS.DIAGNOSTICS_VIEW);
  const report = await runDiagnostics();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Diagnostics"
        description="Database health, environment, versions and recent failure signals — safe to share, no secret values are shown."
      />
      <DiagnosticsView initial={report} />
    </div>
  );
}
