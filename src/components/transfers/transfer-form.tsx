"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Boxes, Package, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormError, useFormAction } from "@/components/ui/form";
import { SectionCard } from "@/components/shared/page-header";
import { createTransfer } from "@/actions/transfers";
import { AssetPicker, ConsumablePicker, type PickedAsset, type PickedLine } from "./transfer-pickers";

type Values = {
  fromSiteId: string;
  toSiteId: string;
  fromLocationId: string;
  toLocationId: string;
  courier: string;
  referenceNumber: string;
  expectedArrival: string;
  notes: string;
};

export function TransferForm({
  sites,
  stockLocations,
  initialAssets = [],
}: {
  sites: { id: string; name: string; code: string }[];
  stockLocations: { id: string; name: string; siteId: string }[];
  initialAssets?: PickedAsset[];
}) {
  const router = useRouter();
  const [assets, setAssets] = React.useState<PickedAsset[]>(initialAssets);
  const [items, setItems] = React.useState<PickedLine[]>([]);
  const [submitForApproval, setSubmitForApproval] = React.useState(true);

  // `useFormAction` memoises its options, so the latest picker state is read
  // through a ref instead of being captured by the option object.
  const payloadRef = React.useRef<Record<string, unknown>>({});
  payloadRef.current = {
    assetIds: assets.map((a) => a.id),
    items: items.map((line) => ({ inventoryItemId: line.inventoryItemId, quantity: line.quantity })),
    submit: submitForApproval,
  };

  const {
    register,
    watch,
    setValue,
    submitting,
    serverError,
    submit,
  } = useFormAction<Values, { id: string }>(createTransfer, {
    successMessage: "Transfer created",
    extra: () => payloadRef.current,
    onSuccess: (data) => router.push(`/transfers/${data.id}`),
  });

  const fromSiteId = watch("fromSiteId");
  const toSiteId = watch("toSiteId");

  const fromLocations = stockLocations.filter((l) => l.siteId === fromSiteId);
  const toLocations = stockLocations.filter((l) => l.siteId === toSiteId);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    if (assets.length === 0 && items.length === 0) {
      event.preventDefault();
      toast.error("Add at least one asset or consumable line");
      return;
    }
    await submit(event);
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <SectionCard
          title="Assets"
          description="Serialized equipment moving with this transfer. Each asset must be held at the source site."
          actions={
            <span className="rounded border bg-muted px-2 py-1 text-xs font-medium tabular-nums">
              {assets.length} selected
            </span>
          }
        >
          <AssetPicker value={assets} onChange={setAssets} />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            Pick from the assets list first, or search by tag, serial or model.
          </p>
        </SectionCard>

        <SectionCard
          title="Consumables"
          description={`Stock leaving ${fromSiteId ? sites.find((s) => s.id === fromSiteId)?.name : "the source site"}.`}
          actions={
            <span className="rounded border bg-muted px-2 py-1 text-xs font-medium tabular-nums">
              {items.length} line{items.length === 1 ? "" : "s"}
            </span>
          }
        >
          <ConsumablePicker siteId={fromSiteId} value={items} onChange={setItems} />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Boxes className="h-3.5 w-3.5" />
            Quantities are deducted from source stock when the transfer is received.
          </p>
        </SectionCard>

        <SectionCard title="Notes" description="Visible to everyone reviewing this transfer.">
          <Textarea rows={4} placeholder="Handling instructions, box counts, contacts…" {...register("notes")} />
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard title="Route" description="Inter-site movement — both sites must be active.">
          <div className="space-y-3">
            <Field label="Source site" htmlFor="fromSiteId" required>
              <input type="hidden" {...register("fromSiteId", { required: "Select the source site" })} />
              <Select value={fromSiteId} onValueChange={(v) => setValue("fromSiteId", v)}>
                <SelectTrigger id="fromSiteId">
                  <SelectValue placeholder="Select source site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} ({site.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Source storage" htmlFor="fromLocationId" hint="Optional — defaults to the site's main stock location.">
              <Select
                value={watch("fromLocationId")}
                onValueChange={(v) => setValue("fromLocationId", v)}
                disabled={!fromSiteId}
              >
                <SelectTrigger id="fromLocationId">
                  <SelectValue placeholder="Any storage" />
                </SelectTrigger>
                <SelectContent>
                  {fromLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-center py-1 text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
            </div>

            <Field label="Destination site" htmlFor="toSiteId" required>
              <input type="hidden" {...register("toSiteId", { required: "Select the destination site" })} />
              <Select value={toSiteId} onValueChange={(v) => setValue("toSiteId", v)}>
                <SelectTrigger id="toSiteId">
                  <SelectValue placeholder="Select destination site" />
                </SelectTrigger>
                <SelectContent>
                  {sites
                    .filter((site) => site.id !== fromSiteId)
                    .map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} ({site.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Destination storage" htmlFor="toLocationId" hint="Optional — defaults to the destination's main stock location.">
              <Select
                value={watch("toLocationId")}
                onValueChange={(v) => setValue("toLocationId", v)}
                disabled={!toSiteId}
              >
                <SelectTrigger id="toLocationId">
                  <SelectValue placeholder="Any storage" />
                </SelectTrigger>
                <SelectContent>
                  {toLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard title="Shipping">
          <div className="space-y-3">
            <Field label="Courier" htmlFor="courier">
              <Input id="courier" placeholder="e.g. In-house van, LBC" {...register("courier")} />
            </Field>
            <Field label="Reference / AWB" htmlFor="referenceNumber">
              <Input id="referenceNumber" placeholder="Tracking or reference number" {...register("referenceNumber")} />
            </Field>
            <Field label="Expected arrival" htmlFor="expectedArrival">
              <Input id="expectedArrival" type="date" {...register("expectedArrival")} />
            </Field>
          </div>
        </SectionCard>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Label className="flex items-start gap-2.5">
            <Checkbox
              checked={submitForApproval}
              onCheckedChange={(checked) => setSubmitForApproval(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm">
              Submit for approval now
              <span className="block text-xs font-normal text-muted-foreground">
                Uncheck to keep this transfer as a draft.
              </span>
            </span>
          </Label>

          <FormError error={serverError} />

          <div className="mt-3 flex gap-2">
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                "Saving…"
              ) : submitForApproval ? (
                <>
                  <Send /> Create transfer
                </>
              ) : (
                <>
                  <Save /> Save draft
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
