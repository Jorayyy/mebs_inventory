import type { Metadata } from "next";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadOrganization } from "@/lib/organization-data";
import { PageHeader } from "@/components/shared/page-header";
import { OrgSectionNav } from "@/components/organization/org-section-nav";
import { CatalogPanel } from "@/components/organization/catalog-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Catalogue" };

const TRACKING_MODES = [
  {
    mode: "Individual asset",
    value: "ASSET",
    body: "Each unit is tagged, serialised and has its own custody history — laptops, monitors, phones.",
  },
  {
    mode: "Stock",
    value: "STOCK",
    body: "Counted by quantity and consumed over time — paper, toner, cables.",
  },
  {
    mode: "Both",
    value: "BOTH",
    body: "Sometimes one, sometimes the other. The form asks which one you are creating.",
  },
];

export default async function OrganizationCatalogPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.ORG_VIEW);
  const { data } = await loadOrganization(user);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Organization"
        title="Catalogue"
        description="Categories decide how something is tracked; item types are the actual things you keep."
      />
      <OrgSectionNav />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">1. Categories</CardTitle>
            <CardDescription>The top-level grouping every item belongs to.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            A category sets the tracking mode, the default tag prefix and which fields the item form
            shows. It drives filters on Assets, Stock and Reports.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">2. Item types</CardTitle>
            <CardDescription>The specific models you keep, nested under a category.</CardDescription>
          </CardHeader>
          <CardContent className="text-xs leading-relaxed text-muted-foreground">
            Item types give a finer tag prefix and a default warranty length, so a new laptop gets the
            right tag and warranty without anyone typing it twice.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Tracking mode</CardTitle>
            <CardDescription>What creating an item in this category produces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {TRACKING_MODES.map((entry) => (
              <div key={entry.value} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                <div className="text-xs font-medium">
                  {entry.mode} <span className="font-mono text-muted-foreground">({entry.value})</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{entry.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <CatalogPanel categories={data.categories} canCatalog={can(user, PERMISSIONS.CATALOG_MANAGE)} />
    </div>
  );
}
