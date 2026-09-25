"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, resolveActiveHref } from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Boxes, ChevronLeft, Package } from "lucide-react";

export function Sidebar({
  permissions,
  roleLabel,
  className,
  onNavigate,
}: {
  permissions: string[];
  roleLabel?: string;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  const groups = React.useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => permissions.includes(item.permission)),
      })).filter((group) => group.items.length > 0),
    [permissions]
  );

  const activeHref = React.useMemo(
    () => resolveActiveHref(pathname, groups.flatMap((group) => group.items.map((i) => i.href))),
    [groups, pathname]
  );

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-150",
        collapsed ? "w-[64px]" : "w-[236px]",
        className
      )}
    >
      <div className="flex h-13 items-center gap-2 border-b border-sidebar-border px-3 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
          <Package className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">MEBS Inventory</p>
            <p className="truncate text-[11px] leading-tight text-sidebar-foreground/60">
              Asset &amp; Stock Control
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto hidden text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground lg:inline-flex"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-4 px-2">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                  {group.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        title={item.label}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {groups.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
              <Boxes className="h-5 w-5 text-sidebar-foreground/50" />
              {!collapsed && (
                <p className="text-xs text-sidebar-foreground/60">
                  No modules are available for your role.
                </p>
              )}
            </div>
          )}
        </nav>
      </ScrollArea>

      {!collapsed && roleLabel && (
        <div className="border-t border-sidebar-border px-3 py-2.5">
          <Badge variant="outline" className="border-sidebar-border text-[10px] text-sidebar-foreground/70">
            {roleLabel}
          </Badge>
        </div>
      )}
    </div>
  );
}
