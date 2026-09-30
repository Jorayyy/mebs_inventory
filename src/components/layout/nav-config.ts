import { NAV_PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import {
  LayoutDashboard,
  Boxes,
  PackageOpen,
  ArrowLeftRight,
  UserCheck,
  Wrench,
  Truck,
  Users,
  FileBarChart2,
  ScrollText,
  Building2,
  ShieldCheck,
  Bell,
  Activity,
  Laptop,
  QrCode,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  permission: PermissionKey;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/**
 * Which nav entry a pathname belongs to: the longest href that covers it on a
 * path-segment boundary. Keeps `/inventory` from staying lit while you are on
 * `/inventory/receive` (a sibling entry), while `/assets/abc` still lights
 * `/assets`.
 */
export function resolveActiveHref(pathname: string, hrefs: string[]): string {
  let active = "";
  for (const href of hrefs) {
    if (!href) continue;
    const covered =
      pathname === href || pathname.startsWith(href === "/" ? "/" : `${href}/`);
    if (covered && href.length > active.length) active = href;
  }
  return active;
}

const p = NAV_PERMISSIONS;

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", permission: p.dashboard, icon: LayoutDashboard },
      { label: "Search & Scan", href: "/search", permission: p.assets, icon: QrCode },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Assets", href: "/assets", permission: p.assets, icon: Laptop },
      { label: "Stock", href: "/inventory", permission: p.inventory, icon: Boxes },
      { label: "Receiving", href: "/inventory/receive", permission: p.inventory, icon: PackageOpen },
      { label: "Transfers", href: "/transfers", permission: p.transfers, icon: ArrowLeftRight },
      { label: "Assignments", href: "/assignments", permission: p.assignments, icon: UserCheck },
      { label: "Maintenance", href: "/maintenance", permission: p.maintenance, icon: Wrench },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Employees", href: "/employees", permission: p.employees, icon: Users },
      { label: "My Assets", href: "/my", permission: p.selfservice, icon: UserCheck },
      { label: "Suppliers", href: "/suppliers", permission: p.suppliers, icon: Truck },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports", href: "/reports", permission: p.reports, icon: FileBarChart2 },
      { label: "Audit Trail", href: "/audit", permission: p.audit, icon: ScrollText },
      { label: "Notifications", href: "/notifications", permission: p.notifications, icon: Bell },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Organization", href: "/settings/organization", permission: p.org, icon: Building2 },
      { label: "Users & Roles", href: "/settings/users", permission: p.users, icon: ShieldCheck },
      { label: "Diagnostics", href: "/admin/diagnostics", permission: p.diagnostics, icon: Activity },
    ],
  },
];
