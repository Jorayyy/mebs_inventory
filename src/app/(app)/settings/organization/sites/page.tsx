import type { Metadata } from "next";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadOrganization } from "@/lib/organization-data";
import { PageHeader } from "@/components/shared/page-header";
import { OrgSectionNav } from "@/components/organization/org-section-nav";
import { SitesPanel } from "@/components/organization/sites-panel";

export const metadata: Metadata = { title: "Sites" };

export default async function OrganizationSitesPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.ORG_VIEW);
  const { data } = await loadOrganization(user);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Organization"
        title="Sites"
        description="The offices, branches and warehouses the business operates from. Sites scope who can see which records."
      />
      <OrgSectionNav />
      <SitesPanel sites={data.sites} canManage={can(user, PERMISSIONS.ORG_MANAGE)} />
    </div>
  );
}
