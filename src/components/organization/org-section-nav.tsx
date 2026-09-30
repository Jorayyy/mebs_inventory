"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileText, LayoutGrid, MapPin, Tags, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveActiveHref } from "@/components/layout/nav-config";
import { ORG_SECTIONS, ORG_SECTION_HREFS } from "@/lib/organization-nav";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "/settings/organization": LayoutGrid,
  "/settings/organization/company": FileText,
  "/settings/organization/sites": Building2,
  "/settings/organization/locations": MapPin,
  "/settings/organization/departments": Users,
  "/settings/organization/catalog": Tags,
};

/**
 * Sub-navigation for the Organization setup area. Keeps every setup screen
 * reachable from every setup screen so nobody has to walk back to the sidebar.
 */
export function OrgSectionNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = resolveActiveHref(pathname, ORG_SECTION_HREFS);

  return (
    <nav
      aria-label="Organization sections"
      className={cn(
        "-mx-1 mb-4 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1",
        className
      )}
    >
      {ORG_SECTIONS.map((section) => {
        const isActive = active === section.href;
        const Icon = ICONS[section.href] ?? LayoutGrid;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
