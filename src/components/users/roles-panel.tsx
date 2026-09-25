"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, RotateCcw, Save, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { setRoleCustomPermissions } from "@/actions/users";
import { ALL_PERMISSIONS, ROLE_DEFINITIONS, type PermissionKey, type RoleKey } from "@/lib/permissions";
import type { ActionResult } from "@/lib/errors";

export type RoleSummary = {
  key: string;
  name: string;
  description: string | null;
  siteScoped: boolean;
  userCount: number;
  permissionKeys: string[];
};

const GROUP_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  search: "Global search",
  assets: "Assets",
  inventory: "Consumable inventory",
  assignments: "Assignments & clearance",
  transfers: "Transfers",
  maintenance: "Maintenance",
  suppliers: "Procurement",
  purchase_orders: "Purchase orders",
  employees: "Employees",
  org: "Organization",
  reports: "Reports",
  audit: "Audit trail",
  users: "Users",
  roles: "Roles & permissions",
  notifications: "Notifications",
  diagnostics: "Diagnostics",
  settings: "Settings",
  selfservice: "Self-service portal",
};

function permissionLabel(key: string): string {
  const suffix = key.split(".")[1] ?? key;
  return suffix
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const sorted = (keys: string[]) => [...keys].sort();

export function RolesPanel({
  roles,
  canManage,
}: {
  roles: RoleSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState(roles[0]?.key ?? "");
  const [granted, setGranted] = React.useState<string[]>(roles[0]?.permissionKeys ?? []);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const role = roles.find((entry) => entry.key === selected);
  const baseline = role ? ROLE_DEFINITIONS[role.key as RoleKey]?.permissions ?? [] : [];

  React.useEffect(() => {
    setGranted(role ? role.permissionKeys : []);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, role?.permissionKeys.join("|")]);

  const dirty =
    !!role &&
    (JSON.stringify(sorted(granted)) !== JSON.stringify(sorted(role.permissionKeys)));

  function toggle(key: string) {
    setGranted((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function save(next: string[]) {
    if (!role) return;
    setSaving(true);
    setError(null);
    try {
      const result: ActionResult<{ roleKey: string; count: number }> =
        await setRoleCustomPermissions({ roleKey: role.key, permissionKeys: next });
      if (!result.ok) setError(result.error);
      else {
        setGranted(next);
        router.refresh();
      }
    } catch {
      setError("Something went wrong while saving permissions.");
    } finally {
      setSaving(false);
    }
  }

  const groups = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const key of ALL_PERMISSIONS) {
      const group = key.split(".")[0];
      const list = map.get(group) ?? [];
      list.push(key);
      map.set(group, list);
    }
    return [...map.entries()];
  }, []);

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No roles are defined yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-sm">Roles</CardTitle>
          <CardDescription>Select a role to review or extend its permissions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {roles.map((entry) => {
            const isActive = entry.key === selected;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setSelected(entry.key)}
                className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                  isActive ? "border-primary bg-primary/5" : "hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{entry.name}</span>
                  <Badge variant="outline">{entry.userCount}</Badge>
                </div>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                  {entry.key}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {entry.permissionKeys.length} granted · {entry.siteScoped ? "site scoped" : "global"}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {role && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> {role.name}
                  <Badge variant="outline">{role.siteScoped ? "Site scoped" : "Global"}</Badge>
                </CardTitle>
                <CardDescription>{role.description}</CardDescription>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || baseline.length === 0}
                    onClick={() => save(sorted(baseline))}
                  >
                    <RotateCcw /> Restore baseline
                  </Button>
                  <Button size="sm" disabled={saving || !dirty} onClick={() => save(granted)}>
                    <Save /> {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormError error={error} />

            {!canManage && (
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Read-only — the Roles &amp; permissions permission is
                required to change them.
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Effective permissions are read from the stored grants below (not the baseline) and are
              refreshed into each session when the user signs in again.
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {groups.map(([group, keys]) => (
                <div key={group} className="rounded-md border">
                  <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium">
                    {GROUP_LABELS[group] ?? group}
                  </div>
                  <div className="divide-y">
                    {keys.map((key) => {
                      const checked = granted.includes(key);
                      const inBaseline = baseline.includes(key as PermissionKey);
                      return (
                        <label
                          key={key}
                          className="flex cursor-pointer items-start gap-2 px-3 py-1.5 text-sm hover:bg-accent/50"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-input"
                            checked={checked}
                            disabled={!canManage}
                            onChange={() => toggle(key)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{permissionLabel(key)}</span>
                            <span className="block truncate font-mono text-[10px] text-muted-foreground">
                              {key}
                              {inBaseline && !checked ? " · baseline" : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
