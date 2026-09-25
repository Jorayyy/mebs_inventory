"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUser } from "@/actions/users";
import { ROLE_DEFINITIONS, ROLE_KEYS, type RoleKey } from "@/lib/permissions";

type UserValues = {
  name: string;
  email: string;
  password: string;
  roleKey: string;
  status: string;
  siteIds: string[];
};

const EMPTY: UserValues = {
  name: "",
  email: "",
  password: "",
  roleKey: "",
  status: "ACTIVE",
  siteIds: [],
};

export function UserForm({ sites }: { sites: { id: string; name: string; code: string }[] }) {
  const router = useRouter();

  const form = useFormAction<UserValues, { id: string }>(createUser, {
    successMessage: "User account created",
    onSuccess: (result) => router.push(`/settings/users/${result.id}`),
  });

  const err = (name: keyof UserValues) =>
    form.formState.errors[name]?.message as string | undefined;

  const selectedSites = form.watch("siteIds") ?? [];
  const roleKey = form.watch("roleKey");
  const definition = roleKey ? ROLE_DEFINITIONS[roleKey as RoleKey] : undefined;

  function toggleSite(siteId: string) {
    const next = selectedSites.includes(siteId)
      ? selectedSites.filter((id) => id !== siteId)
      : [...selectedSites, siteId];
    form.setValue("siteIds", next, { shouldValidate: true });
  }

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>New user account</CardTitle>
        <CardDescription>
          Accounts authenticate with email and password. Permissions come from the selected role.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.submit} className="space-y-4" noValidate>
          <FormError error={form.serverError} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="user-name" required error={err("name")}>
              <Input id="user-name" autoComplete="name" {...form.register("name")} />
            </Field>
            <Field label="Email" htmlFor="user-email" required error={err("email")}>
              <Input
                id="user-email"
                type="email"
                autoComplete="email"
                className="font-mono"
                {...form.register("email")}
              />
            </Field>
            <Field
              label="Temporary password"
              htmlFor="user-password"
              required
              error={err("password")}
              hint="At least 8 characters — the user can change it later"
            >
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                {...form.register("password")}
              />
            </Field>
            <Field label="Role" htmlFor="user-role" required error={err("roleKey")}>
              <Select
                value={roleKey || undefined}
                onValueChange={(value) => form.setValue("roleKey", value, { shouldValidate: true })}
              >
                <SelectTrigger id="user-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {ROLE_DEFINITIONS[key].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status" htmlFor="user-status" required error={err("status")}>
              <Select
                value={form.watch("status")}
                onValueChange={(value) => form.setValue("status", value, { shouldValidate: true })}
              >
                <SelectTrigger id="user-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active — can sign in</SelectItem>
                  <SelectItem value="INVITED">Invited — awaiting first sign-in</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended — sign-in blocked</SelectItem>
                  <SelectItem value="OFFBOARDED">Offboarded — access removed</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {definition && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium">{definition.name}</span>
                <Badge variant="outline">{definition.siteScoped ? "Site scoped" : "Global"}</Badge>
                <span className="text-xs text-muted-foreground">
                  {definition.permissions.length} permission{definition.permissions.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{definition.description}</p>
            </div>
          )}

          <Field
            label="Site access"
            htmlFor="user-sites"
            error={err("siteIds")}
            hint="Leave empty for global roles. Site-scoped users only see data for the sites chosen here."
          >
            {sites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sites configured yet.</p>
            ) : (
              <div
                id="user-sites"
                className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-2"
              >
                {sites.map((site) => (
                  <label
                    key={site.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={selectedSites.includes(site.id)}
                      onChange={() => toggleSite(site.id)}
                    />
                    <span className="min-w-0 flex-1 truncate">{site.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{site.code}</span>
                  </label>
                ))}
              </div>
            )}
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={form.submitting}>
              <UserPlus /> {form.submitting ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
