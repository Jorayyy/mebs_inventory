"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeUserRole, setUserStatus, setUserSiteScopes } from "@/actions/users";
import { ROLE_DEFINITIONS, ROLE_KEYS, type RoleKey } from "@/lib/permissions";
import { USER_STATUS } from "@/lib/constants";
import type { ActionResult } from "@/lib/errors";

type ActionState = { pending: boolean; error: string | null };

async function runAction(
  action: () => Promise<ActionResult<unknown>>,
  setState: React.Dispatch<React.SetStateAction<ActionState>>,
  router: ReturnType<typeof useRouter>,
  after?: () => void
) {
  setState({ pending: true, error: null });
  try {
    const result = await action();
    if (!result.ok) setState({ pending: false, error: result.error });
    else {
      setState({ pending: false, error: null });
      after?.();
      router.refresh();
    }
  } catch {
    setState({ pending: false, error: "Something went wrong. Please try again." });
  }
}

export function RoleStatusPanel({
  user,
  isSelf,
  canManage,
}: {
  user: { id: string; status: string; roleKey: string };
  isSelf: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, setState] = React.useState<ActionState>({ pending: false, error: null });
  const disabled = !canManage || state.pending || isSelf;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="h-4 w-4" /> Role &amp; status
        </CardTitle>
        <CardDescription>
          {isSelf
            ? "You cannot change your own role or status."
            : "Permissions are derived from the role; status controls sign-in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormError error={state.error} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Role</span>
            <Select
              value={user.roleKey}
              disabled={disabled}
              onValueChange={(value) =>
                runAction(
                  () => changeUserRole({ userId: user.id, roleKey: value }),
                  setState,
                  router
                )
              }
            >
              <SelectTrigger aria-label="Role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {ROLE_DEFINITIONS[key].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {ROLE_DEFINITIONS[user.roleKey as RoleKey]?.description ?? "Unknown role"}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Account status</span>
            <Select
              value={user.status}
              disabled={disabled}
              onValueChange={(value) =>
                runAction(
                  () => setUserStatus({ userId: user.id, status: value as never }),
                  setState,
                  router
                )
              }
            >
              <SelectTrigger aria-label="Account status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(USER_STATUS).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only Active accounts can sign in. Suspending keeps the audit history intact.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SiteScopePanel({
  user,
  sites,
  isSelf,
  canManage,
}: {
  user: { id: string; name: string; siteIds: string[]; roleKey: string };
  sites: { id: string; name: string; code: string }[];
  isSelf: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>(user.siteIds);
  const [state, setState] = React.useState<ActionState>({ pending: false, error: null });

  const siteKey = user.siteIds.join("|");
  // Re-sync the checkboxes only when the server-side scope actually changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => setSelected(user.siteIds), [siteKey]);

  const siteScoped = ROLE_DEFINITIONS[user.roleKey as RoleKey]?.siteScoped ?? false;
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...user.siteIds].sort());
  const disabled = !canManage || state.pending || isSelf;

  function toggle(siteId: string) {
    setSelected((prev) =>
      prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Site access</CardTitle>
            <CardDescription>
              {siteScoped
                ? "This role is site scoped — data outside the selected sites is hidden."
                : "Global roles ignore site scope, but the selection is kept for reference."}
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={disabled || !dirty}
            onClick={() =>
              runAction(
                () => setUserSiteScopes({ userId: user.id, siteIds: selected }),
                setState,
                router
              )
            }
          >
            <Save /> {state.pending ? "Saving…" : "Save scopes"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <FormError error={state.error} />
        {sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sites configured yet.</p>
        ) : (
          <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-md border p-2">
            {sites.map((site) => (
              <label
                key={site.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={selected.includes(site.id)}
                  disabled={disabled}
                  onChange={() => toggle(site.id)}
                />
                <span className="min-w-0 flex-1 truncate">{site.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{site.code}</span>
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "No sites selected."
            : `${selected.length} site${selected.length === 1 ? "" : "s"} selected.`}
        </p>
      </CardContent>
    </Card>
  );
}
