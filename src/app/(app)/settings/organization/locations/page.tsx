import type { Metadata } from "next";
import Link from "next/link";
import { requirePermissionPage, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { loadOrganization } from "@/lib/organization-data";
import { PageHeader } from "@/components/shared/page-header";
import { OrgSectionNav } from "@/components/organization/org-section-nav";
import { FacilitiesPanel } from "@/components/organization/facilities-panel";
import { LocationsPanel } from "@/components/organization/locations-panel";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Locations" };

export default async function OrganizationLocationsPage() {
  const user = await requirePermissionPage("/my", PERMISSIONS.ORG_VIEW);
  const { data } = await loadOrganization(user);
  const canManage = can(user, PERMISSIONS.ORG_MANAGE);
  const rooms = data.buildings.reduce(
    (total, building) => total + building.floors.reduce((sum, floor) => sum + floor.rooms.length, 0),
    0
  );

  const kinds = [
    {
      title: "Places",
      body: "Buildings, floors and rooms inside a site. This is where individual assets sit, and what QR scans resolve to.",
      stat: `${data.buildings.length} buildings · ${rooms} rooms`,
    },
    {
      title: "Storage locations",
      body: "Warehouses, racks, cabinets and bins where quantities of stock are received and kept.",
      stat: `${data.locations.length} storage locations`,
    },
    {
      title: "One question: where is it?",
      body: "A storage location can point at a place, so assets and stock share the same mental model instead of two competing ones.",
      stat: "Physical place ↔ stock shelf",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb="Organization"
        title="Locations"
        description="Every place the business stores something, from a building down to a single bin."
      />
      <OrgSectionNav />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kinds.map((kind) => (
          <Card key={kind.title}>
            <CardContent className="space-y-1 pt-4">
              <div className="text-sm font-medium">{kind.title}</div>
              <p className="text-xs leading-relaxed text-muted-foreground">{kind.body}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {kind.stat}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <FacilitiesPanel sites={data.sites} buildings={data.buildings} canManage={canManage} />
      <LocationsPanel locations={data.locations} sites={data.sites} canManage={canManage} />

      <p className="text-xs text-muted-foreground">
        Missing a site?{" "}
        <Link href="/settings/organization/sites" className="text-primary hover:underline">
          Create one first
        </Link>{" "}
        — buildings, floors, rooms and storage locations all hang off a site.
      </p>
    </div>
  );
}
