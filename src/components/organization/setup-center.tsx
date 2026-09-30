"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Building2,
  FileText,
  Laptop,
  MapPin,
  ShieldCheck,
  Tags,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { OrgCounts, OrgData } from "@/lib/organization-types";

type LinkCard = {
  title: string;
  description: string;
  href: string;
  count: number | null;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type SetupCenterProps = {
  data: OrgData;
  counts: OrgCounts;
  canManage: boolean;
  canSee: {
    suppliers: boolean;
    employees: boolean;
    users: boolean;
    assets: boolean;
    stock: boolean;
  };
};

function countLabel(count: number | null, unit: string): string {
  if (count === null) return "—";
  return `${count.toLocaleString()} ${unit}${count === 1 ? "" : "s"}`;
}

function SetupCard({ item }: { item: LinkCard }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="group flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <div className="mt-3 text-sm font-medium">{item.title}</div>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
      <div className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {countLabel(item.count, item.unit)}
      </div>
    </Link>
  );
}

function SetupGroup({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

/**
 * Landing screen for Organization settings: answers "what am I setting up?"
 * with counts, plain-language explanations and a direct link to each editor
 * instead of one long tabbed form.
 */
export function SetupCenter({ data, counts, canManage, canSee }: SetupCenterProps) {
  const { settings } = data;
  const companyFacts: [string, string][] = [
    ["Legal name", data.company?.legalName || data.company?.name || "Not set"],
    ["Tax ID", data.company?.taxId || "Not set"],
    ["Currency", data.company?.currency || "—"],
    ["Locale", settings.locale],
    [
      "Registered address",
      [settings.address.line1, settings.address.city, settings.address.region, settings.address.country]
        .filter(Boolean)
        .join(", ") || "Not set",
    ],
    ["Low-stock alert at", `${settings.lowStockThreshold} units or fewer`],
    ["Warranty warning", `${settings.warrantyWarningDays} days before expiry`],
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{data.company?.name ?? "Company profile"}</CardTitle>
            <CardDescription>
              The legal entity everything else hangs off: sites, people, assets and stock all belong to it.
            </CardDescription>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" asChild>
              <Link href="/settings/organization/company">
                <FileText /> Edit company
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {companyFacts.map(([label, value]) => (
            <div key={label} className="border-b border-border/60 pb-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-0.5 break-words text-sm">{value}</dd>
            </div>
          ))}
        </CardContent>
      </Card>

      <SetupGroup
        title="Organization structure"
        description="Where the business operates and who works there."
      >
        <SetupCard
          item={{
            title: "Sites",
            description:
              "Offices, branches or warehouses. A site drives asset tag prefixes and who can see what.",
            href: "/settings/organization/sites",
            count: counts.sites,
            unit: "site",
            icon: Building2,
          }}
        />
        <SetupCard
          item={{
            title: "Departments",
            description:
              "Groups of people who request, hold or approve inventory. Employees sit inside them.",
            href: "/settings/organization/departments",
            count: counts.departments,
            unit: "department",
            icon: Users,
          }}
        />
        <SetupCard
          item={{
            title: "Locations",
            description:
              "Places inside a site — buildings, floors and rooms — plus the storage locations where stock is kept.",
            href: "/settings/organization/locations",
            count: counts.storageLocations,
            unit: "storage location",
            icon: MapPin,
          }}
        />
      </SetupGroup>

      <SetupGroup
        title="Inventory configuration"
        description="How items are named, tagged, tracked and bought."
      >
        <SetupCard
          item={{
            title: "Categories",
            description:
              "Top-level groupings that decide an item's tracking mode (asset, stock or both) and default tag prefix.",
            href: "/settings/organization/catalog",
            count: counts.categories,
            unit: "category",
            icon: Tags,
          }}
        />
        <SetupCard
          item={{
            title: "Item types",
            description:
              "The specific things you keep — 'Laptop', 'Toner' — each with its own tag prefix and warranty.",
            href: "/settings/organization/catalog",
            count: counts.itemTypes,
            unit: "item type",
            icon: Boxes,
          }}
        />
        {canSee.suppliers && (
          <SetupCard
            item={{
              title: "Suppliers",
              description: "Who you buy from, so purchase orders and receiving can name them.",
              href: "/suppliers",
              count: counts.suppliers,
              unit: "supplier",
              icon: Truck,
            }}
          />
        )}
      </SetupGroup>

      <SetupGroup
        title="People & access"
        description="Who inventory is assigned to, and who may use this system."
      >
        {canSee.employees && (
          <SetupCard
            item={{
              title: "Employees",
              description: "The people assets are assigned to and returned from.",
              href: "/employees",
              count: counts.employees,
              unit: "employee",
              icon: Users,
            }}
          />
        )}
        {canSee.users && (
          <SetupCard
            item={{
              title: "Users & roles",
              description: "Sign-in accounts and the permissions their roles grant.",
              href: "/settings/users",
              count: counts.users,
              unit: "account",
              icon: ShieldCheck,
            }}
          />
        )}
      </SetupGroup>

      <SetupGroup
        title="Recorded inventory"
        description="What you already track today — read-only links into the working areas."
      >
        {canSee.assets && (
          <SetupCard
            item={{
              title: "Assets",
              description: "Individual equipment tracked by tag, with custody and history.",
              href: "/assets",
              count: counts.assets,
              unit: "asset",
              icon: Laptop,
            }}
          />
        )}
        {canSee.stock && (
          <SetupCard
            item={{
              title: "Stock items",
              description: "Consumables tracked by quantity and stored in storage locations.",
              href: "/inventory",
              count: counts.stockItems,
              unit: "stock item",
              icon: Warehouse,
            }}
          />
        )}
      </SetupGroup>

      <Card>
        <CardHeader>
          <CardTitle>How it fits together</CardTitle>
          <CardDescription>
            Setup runs top to bottom. You only need the row you are actually configuring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-wrap items-center gap-2">
            {[
              { label: "Company", href: "/settings/organization/company" },
              { label: "Sites", href: "/settings/organization/sites" },
              { label: "Departments", href: "/settings/organization/departments" },
              { label: "Locations", href: "/settings/organization/locations" },
              { label: "Categories & item types", href: "/settings/organization/catalog" },
            ].map((step, index, all) => (
              <li key={step.label} className="flex items-center gap-2">
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  <span className="text-muted-foreground">{index + 1}.</span> {step.label}
                </Link>
                {index < all.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">{counts.rooms} rooms</Badge>
            <Badge variant="outline">{counts.teams} teams</Badge>
            <Badge variant="outline">{counts.costCenters} cost centres</Badge>
            <Badge variant="outline">{counts.buildings} buildings</Badge>
            <Badge variant="outline">{counts.floors} floors</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
