import type { Metadata } from "next";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadOrganization } from "@/lib/organization-data";
import { PageHeader } from "@/components/shared/page-header";
import { OrgSectionNav } from "@/components/organization/org-section-nav";
import { CompanyPanel } from "@/components/organization/company-panel";

export const metadata: Metadata = { title: "Company settings" };

export default async function OrganizationCompanyPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.ORG_VIEW);
  const { data } = await loadOrganization(user);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Organization"
        title="Company"
        description="Who the business is, where it is based and the defaults applied to every screen."
      />
      <OrgSectionNav />
      <CompanyPanel data={data} canManage={can(user, PERMISSIONS.ORG_MANAGE)} />
    </div>
  );
}
