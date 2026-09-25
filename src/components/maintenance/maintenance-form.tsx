"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormError, useFormAction } from "@/components/ui/form";
import { SectionCard } from "@/components/shared/page-header";
import { AssetStatusBadge } from "@/components/shared/status-badge";
import { searchAssetsForPicker } from "@/actions/assets";
import { createMaintenance } from "@/actions/maintenance";

type Values = {
  issue: string;
  technicianId: string;
  vendorId: string;
  notes: string;
};

type PickedAsset = { id: string; assetTag: string; name: string; status: string };

export function MaintenanceForm({
  technicians,
  vendors,
  initialAsset,
}: {
  technicians: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  initialAsset?: PickedAsset | null;
}) {
  const router = useRouter();
  const [asset, setAsset] = React.useState<PickedAsset | null>(initialAsset ?? null);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PickedAsset[]>([]);
  const [searching, setSearching] = React.useState(false);

  // `useFormAction` memoises its options — read the picked asset via a ref so
  // the value is never stale at submit time.
  const payloadRef = React.useRef<Record<string, unknown>>({});
  payloadRef.current = { assetId: asset?.id ?? "" };

  const { register, watch, setValue, submitting, serverError, submit } = useFormAction<
    Values,
    { id: string }
  >(createMaintenance, {
    successMessage: "Maintenance ticket created",
    extra: () => payloadRef.current,
    onSuccess: (data) => router.push(`/maintenance/${data.id}`),
  });

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchAssetsForPicker(q);
        if (!cancelled) setResults(rows);
      } catch (error) {
        if (!cancelled) toast.error("Asset search failed");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setSearching(false);
    };
  }, [query]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (!asset) {
      event.preventDefault();
      toast.error("Select the asset that needs service");
      return;
    }
    if (watch("issue").trim().length < 5) {
      event.preventDefault();
      toast.error("Describe the issue in at least 5 characters");
      return;
    }
    await submit(event);
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <SectionCard
          title="Asset"
          description="Only one open ticket is allowed per asset — search by tag, serial or name."
        >
          {asset ? (
            <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{asset.assetTag}</p>
                <p className="truncate text-xs text-muted-foreground">{asset.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AssetStatusBadge status={asset.status as never} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove asset"
                  onClick={() => setAsset(null)}
                >
                  <X />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search asset tag, serial or name…"
                  className="h-9 pl-8 text-sm"
                />
                {searching && (
                  <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {results.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {results.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        setAsset(row);
                        setQuery("");
                        setResults([]);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{row.assetTag}</span>
                        <span className="block truncate text-xs text-muted-foreground">{row.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">{row.status}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Issue" description="What is wrong — this text appears on the ticket and in notifications.">
          <div className="space-y-3">
            <Field
              label="Describe the issue"
              htmlFor="issue"
              required
              hint="At least 5 characters."
            >
              <Textarea
                id="issue"
                rows={5}
                placeholder="e.g. BSOD on boot, fan noise, cracked housing…"
                {...register("issue", { required: "Describe the issue" })}
              />
            </Field>
            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" rows={3} {...register("notes")} />
            </Field>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard title="Assignment">
          <div className="space-y-3">
            <Field label="Technician" htmlFor="technicianId">
              <Select value={watch("technicianId")} onValueChange={(v) => setValue("technicianId", v)}>
                <SelectTrigger id="technicianId">
                  <SelectValue placeholder="Assign later" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((tech) => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Vendor" htmlFor="vendorId" hint="External repair partner (optional).">
              <Select value={watch("vendorId")} onValueChange={(v) => setValue("vendorId", v)}>
                <SelectTrigger id="vendorId">
                  <SelectValue placeholder="No vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </SectionCard>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <FormError error={serverError} />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Creating…" : (
                <>
                  <Wrench /> Open ticket
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Opening a ticket flags the asset as under maintenance.
          </p>
        </div>
      </div>
    </form>
  );
}
