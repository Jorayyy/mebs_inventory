"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, PauseCircle, PlayCircle, Warehouse } from "lucide-react";
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
import { EmptyState } from "@/components/shared/page-header";
import { saveStockLocation, setStockLocationActive } from "@/actions/org";
import type { ActionResult } from "@/lib/errors";
import type { OrgLocation, OrgSite } from "@/components/organization/organization-view";

const LOCATION_TYPES = [
  "WAREHOUSE",
  "STORAGE_ROOM",
  "RACK",
  "CABINET",
  "BIN",
  "PANTRY",
  "IT_ROOM",
  "MAILROOM",
  "FLOOR_GENERAL",
  "OTHER",
] as const;

const LOCATION_TYPE_LABELS: Record<string, string> = {
  WAREHOUSE: "Warehouse",
  STORAGE_ROOM: "Storage room",
  RACK: "Rack",
  CABINET: "Cabinet",
  BIN: "Bin",
  PANTRY: "Pantry",
  IT_ROOM: "IT room",
  MAILROOM: "Mailroom",
  FLOOR_GENERAL: "General floor",
  OTHER: "Other",
};

type LocationValues = {
  id: string;
  siteId: string;
  code: string;
  name: string;
  type: string;
  description: string;
  isActive: boolean;
};

const EMPTY: LocationValues = {
  id: "",
  siteId: "",
  code: "",
  name: "",
  type: "STORAGE_ROOM",
  description: "",
  isActive: true,
};

export function LocationsPanel({
  locations,
  sites,
  canManage,
}: {
  locations: OrgLocation[];
  sites: OrgSite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [filterSite, setFilterSite] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [toggleError, setToggleError] = React.useState<string | null>(null);

  const form = useFormAction<LocationValues, { id: string }>(saveStockLocation, {
    successMessage: "Stock location saved",
    onSuccess: () => {
      setOpen(false);
      form.reset(EMPTY);
      router.refresh();
    },
  });

  const err = (name: keyof LocationValues) =>
    form.formState.errors[name]?.message as string | undefined;

  const visible = locations.filter(
    (location) => filterSite === "all" || location.siteId === filterSite
  );

  async function toggleActive(location: OrgLocation) {
    setPending(location.id);
    setToggleError(null);
    try {
      const result: ActionResult<{ id: string; isActive: boolean }> = await setStockLocationActive({
        id: location.id,
        isActive: !location.isActive,
      });
      if (result.ok) router.refresh();
      else setToggleError(result.error);
    } catch {
      setToggleError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  function startEdit(location: OrgLocation) {
    form.reset({
      id: location.id,
      siteId: location.siteId,
      code: location.code,
      name: location.name,
      type: location.type,
      description: location.description ?? "",
      isActive: location.isActive,
    });
    setOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Stock locations</CardTitle>
            <CardDescription>
              Warehouses, racks and bins where inventory is received and stored.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[200px]">
              <Select value={filterSite} onValueChange={setFilterSite}>
                <SelectTrigger aria-label="Filter by site">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage &&
              (open ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    form.reset(EMPTY);
                  }}
                >
                  <X /> Cancel
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    form.reset({ ...EMPTY, siteId: filterSite === "all" ? "" : filterSite });
                    setOpen(true);
                  }}
                >
                  <Plus /> Add location
                </Button>
              ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormError error={toggleError} />

        {canManage && open && (
          <form onSubmit={form.submit} className="space-y-3 rounded-md border bg-muted/30 p-4" noValidate>
            <FormError error={form.serverError} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Site" htmlFor="loc-site" required error={err("siteId")}>
                <Select
                  value={form.watch("siteId") || undefined}
                  onValueChange={(value) => form.setValue("siteId", value, { shouldValidate: true })}
                >
                  <SelectTrigger id="loc-site">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Location code" htmlFor="loc-code" required error={err("code")}>
                <Input id="loc-code" className="font-mono" {...form.register("code")} />
              </Field>
              <Field label="Location name" htmlFor="loc-name" required error={err("name")}>
                <Input id="loc-name" {...form.register("name")} />
              </Field>
              <Field label="Type" htmlFor="loc-type" required error={err("type")}>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value) => form.setValue("type", value, { shouldValidate: true })}
                >
                  <SelectTrigger id="loc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {LOCATION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Description" htmlFor="loc-description" error={err("description")} className="sm:col-span-2">
                <Input id="loc-description" {...form.register("description")} />
              </Field>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={form.watch("isActive")}
                  onChange={(event) => form.setValue("isActive", event.target.checked)}
                />
                Active (available for stock movements)
              </label>
              <Button type="submit" size="sm" disabled={form.submitting}>
                {form.submitting ? "Saving…" : form.watch("id") ? "Update location" : "Create location"}
              </Button>
            </div>
          </form>
        )}

        {visible.length === 0 ? (
          <EmptyState
            title="No stock locations"
            description="Create a warehouse, rack or bin so inventory can be received into a place."
          />
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Site</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  {canManage && <th className="px-3 py-2 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((location) => (
                  <tr key={location.id} className="align-middle">
                    <td className="px-3 py-2 font-mono text-xs">{location.code}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Warehouse className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{location.name}</span>
                      </div>
                      {location.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{location.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{location.siteName}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{LOCATION_TYPE_LABELS[location.type] ?? location.type}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={location.isActive ? "success" : "muted"}>
                        {location.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${location.name}`}
                            onClick={() => startEdit(location)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={location.isActive ? "Deactivate" : "Activate"}
                            disabled={pending === location.id}
                            onClick={() => toggleActive(location)}
                          >
                            {location.isActive ? <PauseCircle /> : <PlayCircle />}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
