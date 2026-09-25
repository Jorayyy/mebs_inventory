"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { saveCompany, saveSystemSettings } from "@/actions/org";
import type { OrgData } from "@/components/organization/organization-view";

type CompanyValues = {
  name: string;
  legalName: string;
  taxId: string;
  logoUrl: string;
  currency: string;
};

type SettingsValues = {
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  locale: string;
  lowStockThreshold: string;
  warrantyWarningDays: string;
};

export function CompanyPanel({ data, canManage }: { data: OrgData; canManage: boolean }) {
  const router = useRouter();
  const { address, locale, lowStockThreshold, warrantyWarningDays } = data.settings;

  const companyForm = useFormAction<CompanyValues, { id: string }>(
    saveCompany,
    {
      successMessage: "Company profile saved",
      onSuccess: () => router.refresh(),
    },
    {
      defaultValues: {
        name: data.company?.name ?? "",
        legalName: data.company?.legalName ?? "",
        taxId: data.company?.taxId ?? "",
        logoUrl: data.company?.logoUrl ?? "",
        currency: data.company?.currency ?? "PHP",
      },
    }
  );

  const settingsForm = useFormAction<SettingsValues, { updated: string[] }>(
    saveSystemSettings,
    {
      successMessage: "System settings saved",
      onSuccess: () => router.refresh(),
    },
    {
      defaultValues: {
        addressLine1: address.line1,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        country: address.country,
        locale,
        lowStockThreshold: String(lowStockThreshold),
        warrantyWarningDays: String(warrantyWarningDays),
      },
    }
  );

  if (!canManage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Read-only — organisation management permission required.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Company name", data.company?.name ?? "—"],
            ["Legal name", data.company?.legalName || "—"],
            ["Tax ID", data.company?.taxId || "—"],
            ["Currency", data.company?.currency ?? "—"],
            ["Locale", locale],
            ["Registered address", [address.line1, address.city, address.region, address.country].filter(Boolean).join(", ") || "—"],
            ["Low-stock threshold", String(lowStockThreshold)],
            ["Warranty warning window", `${warrantyWarningDays} days`],
            ["Logo URL", data.company?.logoUrl || "—"],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-border/60 pb-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 break-words text-sm">{value}</dd>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const companyErr = (name: keyof CompanyValues) =>
    companyForm.formState.errors[name]?.message as string | undefined;
  const settingsErr = (name: keyof SettingsValues) =>
    settingsForm.formState.errors[name]?.message as string | undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Legal identity, branding and default currency.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={companyForm.submit} className="space-y-4" noValidate>
            <FormError error={companyForm.serverError} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Company name" htmlFor="company-name" required error={companyErr("name")}>
                <Input id="company-name" {...companyForm.register("name")} />
              </Field>
              <Field label="Legal name" htmlFor="company-legal" error={companyErr("legalName")}>
                <Input id="company-legal" {...companyForm.register("legalName")} />
              </Field>
              <Field label="Tax ID" htmlFor="company-tax" error={companyErr("taxId")}>
                <Input id="company-tax" className="font-mono" {...companyForm.register("taxId")} />
              </Field>
              <Field label="Logo URL" htmlFor="company-logo" error={companyErr("logoUrl")}>
                <Input id="company-logo" placeholder="https://…" {...companyForm.register("logoUrl")} />
              </Field>
              <Field label="Currency" htmlFor="company-currency" required error={companyErr("currency")} hint="ISO 4217, e.g. PHP">
                <Input id="company-currency" className="font-mono" maxLength={8} {...companyForm.register("currency")} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={companyForm.submitting}>
                {companyForm.submitting ? "Saving…" : "Save company"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defaults &amp; thresholds</CardTitle>
          <CardDescription>
            Locale formatting, address of record and the alerting windows used across the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={settingsForm.submit} className="space-y-4" noValidate>
            <FormError error={settingsForm.serverError} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Address line" htmlFor="set-line1" error={settingsErr("addressLine1")} className="sm:col-span-2">
                <Input id="set-line1" {...settingsForm.register("addressLine1")} />
              </Field>
              <Field label="City / municipality" htmlFor="set-city" error={settingsErr("city")}>
                <Input id="set-city" {...settingsForm.register("city")} />
              </Field>
              <Field label="Region / state" htmlFor="set-region" error={settingsErr("region")}>
                <Input id="set-region" {...settingsForm.register("region")} />
              </Field>
              <Field label="Postal code" htmlFor="set-postal" error={settingsErr("postalCode")}>
                <Input id="set-postal" className="font-mono" {...settingsForm.register("postalCode")} />
              </Field>
              <Field label="Country" htmlFor="set-country" error={settingsErr("country")}>
                <Input id="set-country" {...settingsForm.register("country")} />
              </Field>
              <Field label="Locale" htmlFor="set-locale" required error={settingsErr("locale")} hint="e.g. en-PH">
                <Input id="set-locale" className="font-mono" {...settingsForm.register("locale")} />
              </Field>
              <Field
                label="Low-stock threshold"
                htmlFor="set-lowstock"
                required
                error={settingsErr("lowStockThreshold")}
                hint="Default quantity that triggers a low-stock alert"
              >
                <Input id="set-lowstock" type="number" min={0} {...settingsForm.register("lowStockThreshold")} />
              </Field>
              <Field
                label="Warranty warning (days)"
                htmlFor="set-warranty"
                required
                error={settingsErr("warrantyWarningDays")}
                hint="Warn this many days before warranty expiry"
              >
                <Input id="set-warranty" type="number" min={1} {...settingsForm.register("warrantyWarningDays")} />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Badge variant="outline">Stored as SystemSetting rows</Badge>
              <Button type="submit" size="sm" disabled={settingsForm.submitting}>
                {settingsForm.submitting ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
