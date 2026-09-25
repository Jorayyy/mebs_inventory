"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { inventoryItemCreateSchema } from "@/lib/validations/inventory";
import { UNITS } from "@/lib/constants";
import {
  createInventoryItem,
  updateInventoryItem,
  getInventoryFormOptions,
  getInventoryItemForEdit,
  type InventoryFormOptions,
  type InventoryItemDetail,
} from "@/actions/inventory";
import type { z } from "zod";

type Values = z.infer<typeof inventoryItemCreateSchema>;

export function InventoryItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item?: { id: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const editing = Boolean(item?.id);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit inventory item" : "New inventory item"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the item master data. Quantities are changed through stock movements."
              : "Register a consumable so it can be received, issued and tracked."}
          </DialogDescription>
        </DialogHeader>
        <InventoryItemForm itemId={item?.id} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function NewInventoryItemButton({ label = "New item" }: { label?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <InventoryItemDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

function InventoryItemForm({
  itemId,
  onDone,
}: {
  itemId?: string | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [options, setOptions] = React.useState<InventoryFormOptions | null>(null);
  const [initial, setInitial] = React.useState<Partial<Values> | null | undefined>(
    itemId ? null : undefined
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [siteId, setSiteId] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [opts, detail] = await Promise.all([
          getInventoryFormOptions(),
          itemId ? getInventoryItemForEdit(itemId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setOptions(opts);
        if (detail) {
          const values: Partial<Values> = {
            sku: detail.sku,
            name: detail.name,
            description: detail.description ?? "",
            categoryId: detail.categoryId,
            itemTypeId: detail.itemTypeId ?? "",
            siteId: detail.siteId,
            stockLocationId: detail.stockLocationId,
            binLocation: detail.binLocation ?? "",
            unit: detail.unit,
            minQty: detail.minQty,
            maxQty: detail.maxQty ?? undefined,
            reorderLevel: detail.reorderLevel,
            unitCost: detail.unitCost,
            supplierId: detail.supplierId ?? "",
            isActive: detail.isActive,
          };
          setInitial(values);
          setSiteId(detail.siteId);
          setCategoryId(detail.categoryId);
        } else if (itemId) {
          setLoadError("That item no longer exists.");
        }
      } catch {
        if (!cancelled) setLoadError("Could not load form options. Please retry.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const {
    register,
    setValue,
    watch,
    reset,
    formState,
    submit,
    submitting,
    serverError,
  } = useFormAction<Values, { id: string }>(
    async (values) => {
      const payload = { ...values, ...(itemId ? { id: itemId } : {}) };
      return itemId ? updateInventoryItem(payload) : createInventoryItem(payload);
    },
    {
      successMessage: itemId ? "Item updated" : "Item created",
      onSuccess: (data) => {
        onDone?.();
        router.push(`/inventory/${data.id}`);
        router.refresh();
      },
    },
    { defaultValues: itemId ? (initial ?? undefined) : undefined }
  );

  React.useEffect(() => {
    if (initial && initial !== undefined) reset(initial as Values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const category = options?.categories.find((c) => c.id === categoryId);
  const locations = (options?.stockLocations ?? []).filter((loc) => !siteId || loc.siteId === siteId);
  const err = (name: keyof Values) => formState.errors[name]?.message as string | undefined;

  if (loadError) return <FormError error={loadError} />;

  return (
    <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1" noValidate>
      <FormError error={serverError} />

      {!options ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading form…
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Identification</CardTitle>
              <CardDescription>
                The SKU is unique per site + stock location combination.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="SKU" htmlFor="sku" required error={err("sku")}>
                <Input id="sku" className="font-mono" placeholder="e.g. TONER-CE255A" {...register("sku")} />
              </Field>
              <Field label="Item name" htmlFor="name" required error={err("name")}>
                <Input id="name" placeholder="e.g. HP LaserJet Toner" {...register("name")} />
              </Field>
              <Field label="Category" htmlFor="categoryId" required error={err("categoryId")}>
                <Select
                  value={categoryId}
                  onValueChange={(value) => {
                    setCategoryId(value);
                    setValue("categoryId", value, { shouldValidate: true });
                    setValue("itemTypeId", "");
                  }}
                >
                  <SelectTrigger id="categoryId">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Item type" htmlFor="itemTypeId" error={err("itemTypeId")}>
                <Select
                  value={watch("itemTypeId") ?? ""}
                  onValueChange={(value) => setValue("itemTypeId", value)}
                >
                  <SelectTrigger id="itemTypeId">
                    <SelectValue placeholder="Select item type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {(category?.itemTypes ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label="Description"
                htmlFor="description"
                error={err("description")}
                className="sm:col-span-2"
              >
                <Textarea id="description" rows={2} {...register("description")} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Site" htmlFor="siteId" required error={err("siteId")}>
                <Select
                  value={siteId}
                  onValueChange={(value) => {
                    setSiteId(value);
                    setValue("siteId", value, { shouldValidate: true });
                    setValue("stockLocationId", "");
                  }}
                >
                  <SelectTrigger id="siteId">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stock location" htmlFor="stockLocationId" required error={err("stockLocationId")}>
                <Select
                  value={watch("stockLocationId") ?? ""}
                  onValueChange={(value) => setValue("stockLocationId", value, { shouldValidate: true })}
                >
                  <SelectTrigger id="stockLocationId">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Bin / shelf" htmlFor="binLocation" error={err("binLocation")}>
                <Input id="binLocation" placeholder="e.g. RACK-B3" {...register("binLocation")} />
              </Field>
              <Field label="Unit" htmlFor="unit" required error={err("unit")}>
                <Select
                  value={watch("unit") ?? "EACH"}
                  onValueChange={(value) => setValue("unit", value)}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Preferred supplier" htmlFor="supplierId" error={err("supplierId")}>
                <Select
                  value={watch("supplierId") ?? ""}
                  onValueChange={(value) => setValue("supplierId", value)}
                >
                  <SelectTrigger id="supplierId">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {options.suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock controls</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Min level" htmlFor="minQty" error={err("minQty")}>
                <Input id="minQty" type="number" step="any" min="0" {...register("minQty")} />
              </Field>
              <Field label="Max level" htmlFor="maxQty" error={err("maxQty")} hint="Blank = no cap">
                <Input id="maxQty" type="number" step="any" min="0" {...register("maxQty")} />
              </Field>
              <Field label="Reorder level" htmlFor="reorderLevel" error={err("reorderLevel")}>
                <Input id="reorderLevel" type="number" step="any" min="0" {...register("reorderLevel")} />
              </Field>
              <Field label="Unit cost" htmlFor="unitCost" error={err("unitCost")}>
                <Input id="unitCost" type="number" step="0.01" min="0" {...register("unitCost")} />
              </Field>
              {!itemId && (
                <Field label="Opening quantity" htmlFor="openingQty" error={err("openingQty")}>
                  <Input id="openingQty" type="number" step="any" min="0" {...register("openingQty")} />
                </Field>
              )}
              <div className="flex items-end gap-2 pb-2">
                <Switch
                  id="isActive"
                  checked={watch("isActive") ?? true}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                />
                <label htmlFor="isActive" className="text-sm">
                  Active
                  <span className="block text-xs text-muted-foreground">Receives new stock</span>
                </label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onDone?.()}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : itemId ? "Save changes" : "Create item"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}

export type { InventoryItemDetail };
