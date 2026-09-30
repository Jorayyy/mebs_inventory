"use client";

import { useRouter } from "next/navigation";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { saveCompany, saveRegionalSettings, saveInventoryDefaults } from "@/actions/org";
import type { OrgData } from "@/lib/organization-types";

type CompanyValues = {
  name: string;
  legalName: string;
  taxId: string;
  logoUrl: string;
  currency: string;
};

type RegionalValues = {
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  locale: string;
};

type DefaultsValues = {
  lowStockThreshold: string;
  warrantyWarningDays: string;
};

function ReadOnlyFacts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="border-b border-border/60 pb-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </dt>
          <dd className="mt-0.5 break-words text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

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

  const regionalForm = useFormAction<RegionalValues, { updated: string[] }>(
    saveRegionalSettings,
    {
      successMessage: "Regional settings saved",
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
      },
    }
  );

  const defaultsForm = useFormAction<DefaultsValues, { updated: string[] }>(
    saveInventoryDefaults,
    {
      successMessage: "Inventory defaults saved",
      onSuccess: () => router.refresh(),
    },
    {
      defaultValues: {
        lowStockThreshold: String(lowStockThreshold),
        warrantyWarningDays: String(warrantyWarningDays),
      },
    }
  );

  if (!canManage) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Company information</CardTitle>
            <CardDescription>Read-only — organisation management permission required.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReadOnlyFacts
              rows={[
                ["Company name", data.company?.name ?? "—"],
                ["Legal name", data.company?.legalName || "—"],
                ["Tax ID", data.company?.taxId || "—"],
                ["Currency", data.company?.currency ?? "—"],
                ["Logo URL", data.company?.logoUrl || "—"],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Regional settings</CardTitle>
            <CardDescription>Address of record and formatting locale.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReadOnlyFacts
              rows={[
                [
                  "Registered address",
                  [address.line1, address.city, address.region, address.country]
                    .filter(Boolean)
                    .join(", ") || "—",
                ],
                ["Postal code", address.postalCode || "—"],
                ["Locale", locale],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inventory defaults</CardTitle>
            <CardDescription>Alerting windows used across stock and warranty screens.</CardDescription>
          </CardHeader>
          <CardContent>
            <ReadOnlyFacts
              rows={[
                ["Low-stock threshold", String(lowStockThreshold)],
                ["Warranty warning window", `${warrantyWarningDays} days`],
              ]}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const companyErr = (name: keyof CompanyValues) =>
    companyForm.formState.errors[name]?.message as string | undefined;
  const regionalErr = (name: keyof RegionalValues) =>
    regionalForm.formState.errors[name]?.message as string | undefined;
  const defaultsErr = (name: keyof DefaultsValues) =>
    defaultsForm.formState.errors[name]?.message as string | undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Company information</CardTitle>
          <CardDescription>
            Legal identity, branding and the currency every value in the system is reported in.
          </CardDescription>
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
          <CardTitle>Regional settings</CardTitle>
          <CardDescription>
            Where the company is based and the locale used to format dates, numbers and currencies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={regionalForm.submit} className="space-y-4" noValidate>
            <FormError error={regionalForm.serverError} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Address line" htmlFor="set-line1" error={regionalErr("addressLine1")} className="sm:col-span-2">
                <Input id="set-line1" {...regionalForm.register("addressLine1")} />
              </Field>
              <Field label="City / municipality" htmlFor="set-city" error={regionalErr("city")}>
                <Input id="set-city" {...regionalForm.register("city")} />
              </Field>
              <Field label="Region / state" htmlFor="set-region" error={regionalErr("region")}>
                <Input id="set-region" {...regionalForm.register("region")} />
              </Field>
              <Field label="Postal code" htmlFor="set-postal" error={regionalErr("postalCode")}>
                <Input id="set-postal" className="font-mono" {...regionalForm.register("postalCode")} />
              </Field>
              <Field label="Country" htmlFor="set-country" error={regionalErr("country")}>
                <Input id="set-country" {...regionalForm.register("country")} />
              </Field>
              <Field label="Locale" htmlFor="set-locale" required error={regionalErr("locale")} hint="e.g. en-PH">
                <Input id="set-locale" className="font-mono" {...regionalForm.register("locale")} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={regionalForm.submitting}>
                {regionalForm.submitting ? "Saving…" : "Save regional settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inventory defaults</CardTitle>
          <CardDescription>
            The thresholds that decide when something is flagged — they apply to new items and to every
            screen that raises an alert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={defaultsForm.submit} className="space-y-4" noValidate>
            <FormError error={defaultsForm.serverError} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Low-stock threshold"
                htmlFor="set-lowstock"
                required
                error={defaultsErr("lowStockThreshold")}
                hint="Default quantity that triggers a low-stock alert"
              >
                <Input id="set-lowstock" type="number" min={0} {...defaultsForm.register("lowStockThreshold")} />
              </Field>
              <Field
                label="Warranty warning (days)"
                htmlFor="set-warranty"
                required
                error={defaultsErr("warrantyWarningDays")}
                hint="Warn this many days before warranty expiry"
              >
                <Input id="set-warranty" type="number" min={1} {...defaultsForm.register("warrantyWarningDays")} />
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={defaultsForm.submitting}>
                {defaultsForm.submitting ? "Saving…" : "Save defaults"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
