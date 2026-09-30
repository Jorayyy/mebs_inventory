import type { Metadata } from "next";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadOrganization } from "@/lib/organization-data";
import { PageHeader } from "@/components/shared/page-header";
import { OrgSectionNav } from "@/components/organization/org-section-nav";
import { StructurePanel } from "@/components/organization/structure-panel";

export const metadata: Metadata = { title: "Departments" };

export default async function OrganizationDepartmentsPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.ORG_VIEW);
  const { data } = await loadOrganization(user);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Organization"
        title="Departments"
        description="Groups of people who request, hold or approve inventory. Employees belong to a department and a site; teams live inside a department."
      />
      <OrgSectionNav />
      <StructurePanel
        departments={data.departments}
        costCenters={data.costCenters}
        sites={data.sites}
        canManage={can(user, PERMISSIONS.ORG_MANAGE)}
      />
    </div>
  );
}
