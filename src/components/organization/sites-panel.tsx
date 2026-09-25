"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Archive, ArchiveRestore, X, Check } from "lucide-react";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { saveSite, setSiteStatus } from "@/actions/org";
import type { OrgSite } from "@/components/organization/organization-view";

export const SITE_STATUS: Record<string, { label: string; tone: "success" | "muted" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INACTIVE: { label: "Archived", tone: "muted" },
};

const TIMEZONES = [
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Dubai",
  "Asia/Kolkata",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
];

type Values = {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  timezone: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
};

const EMPTY: Values = {
  id: "",
  code: "",
  name: "",
  city: "",
  address: "",
  timezone: "Asia/Manila",
  contactPhone: "",
  contactEmail: "",
  notes: "",
};

export function SitesPanel({ sites, canManage }: { sites: OrgSite[]; canManage: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OrgSite | null>(null);
  const [timezone, setTimezone] = React.useState(EMPTY.timezone);

  const {
    register,
    setValue,
    formState,
    submit,
    submitting,
    serverError,
    reset,
  } = useFormAction<Values, { id: string }>(saveSite, {
    successMessage: "Site saved",
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      reset(EMPTY);
      router.refresh();
    },
  });

  function startCreate() {
    reset(EMPTY);
    setTimezone(EMPTY.timezone);
    setEditing(null);
    setOpen(true);
  }

  function startEdit(site: OrgSite) {
    reset({
      id: site.id,
      code: site.code,
      name: site.name,
      city: site.city ?? "",
      address: site.address ?? "",
      timezone: site.timezone,
      contactPhone: site.contactPhone ?? "",
      contactEmail: site.contactEmail ?? "",
      notes: site.notes ?? "",
    });
    setTimezone(site.timezone);
    setEditing(site);
    setOpen(true);
  }

  async function toggleStatus(site: OrgSite) {
    const next = site.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const label = next === "INACTIVE" ? "archive" : "reactivate";
    if (!confirm(`${next === "INACTIVE" ? "Archive" : "Reactivate"} ${site.name}?`)) return;
    const result = await setSiteStatus({ id: site.id, status: next });
    if (result.ok) {
      toast.success(`Site ${label === "archive" ? "archived" : "reactivated"}`);
      router.refresh();
    } else {
      toast.error(result.error, { description: `Reference: ${result.errorId}` });
    }
  }

  const err = (name: keyof Values) => formState.errors[name]?.message as string | undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Sites</CardTitle>
            <CardDescription>
              Physical operating locations — code drives asset tag generation.
            </CardDescription>
          </div>
          {canManage &&
            (open ? (
              <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>
                <X /> Cancel
              </Button>
            ) : (
              <Button size="sm" onClick={startCreate}>
                <Plus /> New site
              </Button>
            ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {open && (
          <form onSubmit={submit} className="space-y-4 rounded-md border bg-muted/30 p-4" noValidate>
            <FormError error={serverError} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Site code" htmlFor="site-code" required error={err("code")} hint="e.g. MNL">
                <Input id="site-code" className="font-mono" maxLength={16} {...register("code")} />
              </Field>
              <Field label="Site name" htmlFor="site-name" required error={err("name")}>
                <Input id="site-name" {...register("name")} />
              </Field>
              <Field label="City" htmlFor="site-city" error={err("city")}>
                <Input id="site-city" {...register("city")} />
              </Field>
              <Field label="Address" htmlFor="site-address" error={err("address")} className="sm:col-span-2">
                <Input id="site-address" {...register("address")} />
              </Field>
              <Field label="Timezone" htmlFor="site-timezone" required error={err("timezone")}>
                <Select
                  value={timezone}
                  onValueChange={(value) => {
                    setTimezone(value);
                    setValue("timezone", value, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger id="site-timezone">
                    <SelectValue placeholder="Timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Contact phone" htmlFor="site-phone" error={err("contactPhone")}>
                <Input id="site-phone" {...register("contactPhone")} />
              </Field>
              <Field label="Contact email" htmlFor="site-email" error={err("contactEmail")}>
                <Input id="site-email" type="email" {...register("contactEmail")} />
              </Field>
              <Field label="Notes" htmlFor="site-notes" error={err("notes")} className="sm:col-span-2 lg:col-span-3">
                <Textarea id="site-notes" rows={2} {...register("notes")} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Saving…" : editing ? "Save changes" : "Create site"}
              </Button>
            </div>
          </form>
        )}

        {sites.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sites configured yet. Create the first operating location.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="font-mono text-sm">{site.code}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{site.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{site.address || "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm">{site.city || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{site.timezone}</TableCell>
                    <TableCell className="text-xs">
                      <p>{site.contactEmail || "—"}</p>
                      <p className="text-muted-foreground">{site.contactPhone || ""}</p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {site.buildingCount} buildings · {site.locationCount} locations ·{" "}
                      {site.employeeCount} staff
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={site.status} map={SITE_STATUS} />
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => startEdit(site)} aria-label="Edit site">
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => toggleStatus(site)}
                            aria-label={site.status === "ACTIVE" ? "Archive site" : "Reactivate site"}
                          >
                            {site.status === "ACTIVE" ? <Archive /> : <ArchiveRestore />}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Badge variant="success"><Check className="h-3 w-3" /> Active sites accept new records</Badge>
          </span>
          <span className="inline-flex items-center gap-1">
            <Badge variant="muted"><Archive className="h-3 w-3" /> Archived sites are hidden from pickers</Badge>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
