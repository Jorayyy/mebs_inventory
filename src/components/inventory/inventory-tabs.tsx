"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Boxes, PackageOpen, ArrowLeftRight, AlertTriangle, Laptop, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveActiveHref } from "@/components/layout/nav-config";

type Tab = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra rule for routes that share a path but differ by query. */
  isActive?: (pathname: string, params: URLSearchParams) => boolean;
};

const TABS: Tab[] = [
  {
    label: "Stock",
    href: "/inventory",
    icon: Boxes,
    isActive: (pathname, params) => pathname === "/inventory" && params.get("low") !== "yes",
  },
  { label: "Receiving", href: "/inventory/receive", icon: PackageOpen },
  { label: "Transactions", href: "/inventory/transactions", icon: ArrowLeftRight },
  {
    label: "Low stock",
    href: "/inventory?low=yes",
    icon: AlertTriangle,
    isActive: (pathname, params) => pathname === "/inventory" && params.get("low") === "yes",
  },
  { label: "Assets", href: "/assets", icon: Laptop },
];

export type InventoryTabsProps = {
  /** Show the "+ Add Inventory" entry point (hidden on read-only roles). */
  canAdd?: boolean;
  className?: string;
};

/**
 * Sub-navigation for the whole Inventory area so stock, receiving, transactions
 * and assets read as one workflow instead of separate pages.
 */
export function InventoryTabs({ canAdd = true, className }: InventoryTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hrefs = React.useMemo(() => TABS.map((tab) => tab.href), []);
  const active = resolveActiveHref(pathname, hrefs);

  return (
    <div className={cn("mb-4 flex flex-wrap items-center justify-between gap-2", className)}>
      <nav
        aria-label="Inventory sections"
        className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
      >
        {TABS.map((tab) => {
          const isActive = tab.isActive
            ? tab.isActive(pathname, searchParams)
            : active === tab.href && !tab.href.includes("?");
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {canAdd && (
        <Button size="sm" asChild>
          <Link href="/inventory/new">
            <Plus /> Add inventory
          </Link>
        </Button>
      )}
    </div>
  );
}
