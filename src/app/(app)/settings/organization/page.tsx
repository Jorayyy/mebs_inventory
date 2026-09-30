import type { Metadata } from "next";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadOrganization } from "@/lib/organization-data";
import { PageHeader } from "@/components/shared/page-header";
import { OrgSectionNav } from "@/components/organization/org-section-nav";
import { SetupCenter } from "@/components/organization/setup-center";

export const metadata: Metadata = { title: "Organization setup" };

export default async function OrganizationSettingsPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.ORG_VIEW);
  const { data, counts } = await loadOrganization(user);

  const summary = [
    `${counts.sites} site${counts.sites === 1 ? "" : "s"}`,
    `${counts.departments} department${counts.departments === 1 ? "" : "s"}`,
    `${counts.categories} categor${counts.categories === 1 ? "y" : "ies"}`,
  ].join(" · ");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Organization setup"
        description="Configure the company, the places you operate from and how inventory is catalogued."
        actions={<span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">{summary}</span>}
      />
      <OrgSectionNav />
      <SetupCenter
        data={data}
        counts={counts}
        canManage={can(user, PERMISSIONS.ORG_MANAGE)}
        canSee={{
          suppliers: can(user, PERMISSIONS.SUPPLIERS_VIEW),
          employees: can(user, PERMISSIONS.EMPLOYEES_VIEW),
          users: can(user, PERMISSIONS.USERS_MANAGE),
          assets: can(user, PERMISSIONS.ASSETS_VIEW),
          stock: can(user, PERMISSIONS.INVENTORY_VIEW),
        }}
      />
    </div>
  );
}
