"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Search } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { RECEIPT_LINE_CONDITIONS } from "@/lib/validations/inventory";
import { createReceipt, addReceiptLines, listPurchaseOrdersForPicker } from "@/actions/receiving";
import {
  getInventoryFormOptions,
  searchInventoryItems,
  type InventoryFormOptions,
  type InventoryPickerItem,
} from "@/actions/inventory";
import type { PurchaseOrderOption } from "@/actions/receiving";

const today = () => new Date().toISOString().slice(0, 10);

const CONDITION_LABELS: Record<string, string> = {
  GOOD: "Good",
  DAMAGED: "Damaged",
  EXPIRED: "Expired",
  RETURNED: "Returned",
};

export type ReceiptLineDraft = {
  key: string;
  inventoryItemId: string;
  description: string;
  quantity: string;
  unitCost: string;
  condition: string;
  expiryDate: string;
  batch: string;
};

function newLine(partial?: Partial<ReceiptLineDraft>): ReceiptLineDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    inventoryItemId: "",
    description: "",
    quantity: "1",
    unitCost: "0",
    condition: "GOOD",
    expiryDate: "",
    batch: "",
    ...partial,
  };
}

function toPayloadLine(line: ReceiptLineDraft) {
  return {
    inventoryItemId: line.inventoryItemId,
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unitCost: Number(line.unitCost || 0),
    condition: line.condition as (typeof RECEIPT_LINE_CONDITIONS)[number],
    expiryDate: line.expiryDate,
    batch: line.batch,
  };
}

function useItemPicker(siteId: string) {
  const [itemOptions, setItemOptions] = React.useState<InventoryPickerItem[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const items = await searchInventoryItems(query, siteId || undefined);
        if (!cancelled) setItemOptions(items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, query ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [siteId, query]);

  return { itemOptions, query, setQuery, loading };
}

function ItemSearchInput({
  query,
  onQuery,
  loading,
}: {
  query: string;
  onQuery: (value: string) => void;
  loading: boolean;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search item SKU or name…"
        className="h-8 pl-8 text-sm"
      />
      {loading && (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

function LinesEditor({
  lines,
  onChange,
  options,
  fieldErrors,
  onPick,
}: {
  lines: ReceiptLineDraft[];
  onChange: (lines: ReceiptLineDraft[]) => void;
  options: InventoryPickerItem[];
  fieldErrors: Record<string, string>;
  onPick: (item: InventoryPickerItem) => void;
}) {
  const update = (index: number, patch: Partial<ReceiptLineDraft>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const selectItem = (index: number, itemId: string) => {
    const pickedOption = options.find((option) => option.id === itemId);
    const line = lines[index];
    if (pickedOption) onPick(pickedOption);
    update(index, {
      inventoryItemId: itemId,
      description: pickedOption ? pickedOption.name : line.description,
      unitCost:
        pickedOption && Number(line.unitCost || 0) === 0
          ? String(pickedOption.unitCost)
          : line.unitCost,
    });
  };

  const err = (key: string) => fieldErrors[key];

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const picked = options.find((option) => option.id === line.inventoryItemId);
        const total = Number(line.quantity || 0) * Number(line.unitCost || 0);
        return (
          <div key={line.key} className="rounded-md border bg-muted/20 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                label="Inventory item"
                htmlFor={`line-item-${index}`}
                required
                error={err(`lines.${index}.inventoryItemId`)}
                className="lg:col-span-2"
              >
                <Select
                  value={line.inventoryItemId}
                  onValueChange={(value) => selectItem(index, value)}
                >
                  <SelectTrigger id={`line-item-${index}`}>
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.sku} — {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Description"
                htmlFor={`line-desc-${index}`}
                required
                error={err(`lines.${index}.description`)}
              >
                <Input
                  id={`line-desc-${index}`}
                  value={line.description}
                  onChange={(event) => update(index, { description: event.target.value })}
                  placeholder="Line description"
                />
              </Field>

              <Field
                label={`Quantity${picked ? ` (${picked.unit})` : ""}`}
                htmlFor={`line-qty-${index}`}
                required
                error={err(`lines.${index}.quantity`)}
              >
                <Input
                  id={`line-qty-${index}`}
                  type="number"
                  step="any"
                  min="0"
                  value={line.quantity}
                  onChange={(event) => update(index, { quantity: event.target.value })}
                />
              </Field>

              <Field
                label="Unit cost"
                htmlFor={`line-cost-${index}`}
                error={err(`lines.${index}.unitCost`)}
              >
                <Input
                  id={`line-cost-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.unitCost}
                  onChange={(event) => update(index, { unitCost: event.target.value })}
                />
              </Field>

              <Field label="Condition" htmlFor={`line-condition-${index}`} error={err(`lines.${index}.condition`)}>
                <Select
                  value={line.condition}
                  onValueChange={(value) => update(index, { condition: value })}
                >
                  <SelectTrigger id={`line-condition-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECEIPT_LINE_CONDITIONS.map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {CONDITION_LABELS[condition]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Expiry date" htmlFor={`line-expiry-${index}`} error={err(`lines.${index}.expiryDate`)}>
                <Input
                  id={`line-expiry-${index}`}
                  type="date"
                  value={line.expiryDate}
                  onChange={(event) => update(index, { expiryDate: event.target.value })}
                />
              </Field>

              <Field label="Batch / lot" htmlFor={`line-batch-${index}`} error={err(`lines.${index}.batch`)}>
                <Input
                  id={`line-batch-${index}`}
                  value={line.batch}
                  onChange={(event) => update(index, { batch: event.target.value })}
                  placeholder="e.g. LOT-24-09"
                />
              </Field>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Line total{" "}
                <span className="font-medium text-foreground">{formatCurrency(total)}</span>
                {picked ? (
                  <>
                    {" · "}on hand {formatNumber(picked.currentQty, 3)} {picked.unit}
                  </>
                ) : (
                  " · select an item to post stock on completion"
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-destructive"
                disabled={lines.length === 1}
                onClick={() => onChange(lines.filter((_, i) => i !== index))}
              >
                <Trash2 /> Remove
              </Button>
            </div>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...lines, newLine()])}
      >
        <Plus /> Add line
      </Button>
    </div>
  );
}

type CreateValues = {
  invoiceNumber?: string;
  referenceNumber?: string;
  notes?: string;
};

function fieldErrorMap(errors: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(errors)) {
    const message = (value as { message?: string } | undefined)?.message;
    if (message) out[key] = message;
  }
  return out;
}

export function ReceiptForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [options, setOptions] = React.useState<InventoryFormOptions | null>(null);
  const [purchaseOrders, setPurchaseOrders] = React.useState<PurchaseOrderOption[]>([]);
  const [siteId, setSiteId] = React.useState("");
  const [stockLocationId, setStockLocationId] = React.useState("");
  const [poId, setPoId] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [deliveryDate, setDeliveryDate] = React.useState(today());
  const [lines, setLines] = React.useState<ReceiptLineDraft[]>([newLine()]);
  const [picked, setPicked] = React.useState<Record<string, InventoryPickerItem>>({});
  const [headerError, setHeaderError] = React.useState<string | null>(null);
  const { itemOptions, query, setQuery, loading } = useItemPicker(siteId);

  React.useEffect(() => {
    let cancelled = false;
    getInventoryFormOptions()
      .then((value) => !cancelled && setOptions(value))
      .catch(() => !cancelled && setHeaderError("Could not load form options."));
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    listPurchaseOrdersForPicker(siteId || undefined)
      .then((value) => !cancelled && setPurchaseOrders(value))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const availableOptions = React.useMemo(() => {
    const map = new Map<string, InventoryPickerItem>();
    for (const option of itemOptions) map.set(option.id, option);
    for (const option of Object.values(picked)) map.set(option.id, option);
    return Array.from(map.values());
  }, [itemOptions, picked]);

  React.useEffect(() => {
    setLines((current) =>
      current.map((line) => {
        if (line.inventoryItemId) return line;
        const match = availableOptions.find(
          (option) =>
            option.name.trim().toLowerCase() === line.description.trim().toLowerCase() ||
            option.sku.trim().toLowerCase() === line.description.trim().toLowerCase()
        );
        if (!match) return line;
        return {
          ...line,
          inventoryItemId: match.id,
          unitCost: Number(line.unitCost || 0) === 0 ? String(match.unitCost) : line.unitCost,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableOptions]);

  const { register, formState, submit, submitting, serverError } = useFormAction<
    CreateValues,
    { id: string; receiptNumber: string }
  >(
    async (values) =>
      createReceipt({
        ...values,
        siteId,
        stockLocationId,
        poId,
        supplierId,
        deliveryDate,
        lines: lines.map(toPayloadLine),
      }),
    {
      successMessage: (data) => `Receipt ${data.receiptNumber} created`,
      onSuccess: (data) => {
        onDone?.();
        router.push(`/inventory/receive/${data.id}`);
        router.refresh();
      },
    }
  );

  const fieldErrors = fieldErrorMap(formState.errors as unknown as Record<string, unknown>);
  const locations = (options?.stockLocations ?? []).filter((location) => location.siteId === siteId);
  const selectedPo = purchaseOrders.find((order) => order.id === poId);

  function handleSiteChange(value: string) {
    setSiteId(value);
    setStockLocationId("");
    setPoId("");
    setSupplierId("");
  }

  function handlePoChange(value: string) {
    const order = purchaseOrders.find((candidate) => candidate.id === value);
    setPoId(value);
    if (!order) return;
    setSiteId(order.siteId);
    setSupplierId(order.supplierId);
    const openItems = order.items.filter((item) => item.receivedQty < item.quantity);
    setLines(
      openItems.length
        ? openItems.map((item) =>
            newLine({
              description: item.description,
              quantity: String(Math.max(item.quantity - item.receivedQty, 1)),
              unitCost: String(item.unitCost),
            })
          )
        : [newLine()]
    );
  }

  function handleSubmit(event?: React.BaseSyntheticEvent) {
    event?.preventDefault();
    if (!siteId) {
      setHeaderError("Select the site this delivery belongs to.");
      return;
    }
    if (lines.length === 0) {
      setHeaderError("Add at least one line.");
      return;
    }
    if (lines.some((line) => !line.inventoryItemId)) {
      setHeaderError("Every line must be linked to an inventory item.");
      return;
    }
    if (lines.some((line) => !Number(line.quantity) || Number(line.quantity) <= 0)) {
      setHeaderError("Every line needs a quantity greater than zero.");
      return;
    }
    setHeaderError(null);
    void submit(event);
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[72vh] space-y-4 overflow-y-auto pr-1" noValidate>
      <FormError error={headerError ?? serverError} />

      {!options ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading form…
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Receipt details</CardTitle>
              <CardDescription>
                Create the receipt first, then complete it to post the quantities to stock.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Site" htmlFor="siteId" required error={fieldErrors.siteId}>
                <Select value={siteId} onValueChange={handleSiteChange}>
                  <SelectTrigger id="siteId">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} ({site.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Stock location" htmlFor="stockLocationId" error={fieldErrors.stockLocationId}>
                <Select
                  value={stockLocationId}
                  onValueChange={(value) => setStockLocationId(value)}
                >
                  <SelectTrigger id="stockLocationId">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Use each item&apos;s home location</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({location.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Purchase order" htmlFor="poId" error={fieldErrors.poId} hint="Optional">
                <Select value={poId} onValueChange={handlePoChange}>
                  <SelectTrigger id="poId">
                    <SelectValue placeholder="Manual receipt (no PO)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Manual receipt (no PO)</SelectItem>
                    {purchaseOrders.map((order) => (
                      <SelectItem key={order.id} value={order.id}>
                        {order.poNumber} — {order.supplierName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Supplier" htmlFor="supplierId" error={fieldErrors.supplierId}>
                <Select
                  value={supplierId}
                  onValueChange={(value) => setSupplierId(value)}
                  disabled={Boolean(selectedPo)}
                >
                  <SelectTrigger id="supplierId">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {options.suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Delivery date" htmlFor="deliveryDate" error={fieldErrors.deliveryDate}>
                <Input
                  id="deliveryDate"
                  type="date"
                  value={deliveryDate}
                  onChange={(event) => setDeliveryDate(event.target.value)}
                />
              </Field>

              <Field label="Invoice number" htmlFor="invoiceNumber" error={fieldErrors.invoiceNumber}>
                <Input id="invoiceNumber" className="font-mono" {...register("invoiceNumber")} />
              </Field>

              <Field label="Reference number" htmlFor="referenceNumber" error={fieldErrors.referenceNumber}>
                <Input id="referenceNumber" className="font-mono" {...register("referenceNumber")} />
              </Field>

              <Field label="Notes" htmlFor="notes" error={fieldErrors.notes} className="sm:col-span-2 lg:col-span-3">
                <Textarea id="notes" rows={2} {...register("notes")} />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Lines</CardTitle>
                  <CardDescription>
                    {selectedPo
                      ? `Prefilled from ${selectedPo.poNumber} — map each line to a stock item.`
                      : "Link every line to an inventory item so stock is posted on completion."}
                  </CardDescription>
                </div>
                <ItemSearchInput query={query} onQuery={setQuery} loading={loading} />
              </div>
            </CardHeader>
            <CardContent>
              <LinesEditor
                lines={lines}
                onChange={setLines}
                options={availableOptions}
                fieldErrors={fieldErrors}
                onPick={(item) => setPicked((current) => ({ ...current, [item.id]: item }))}
              />
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {lines.length} line{lines.length === 1 ? "" : "s"} ·{" "}
              {formatCurrency(
                lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0)
              )}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onDone?.()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Create receipt"}
              </Button>
            </div>
          </div>
        </>
      )}
    </form>
  );
}

export function ReceiptLinesForm({
  receivingId,
  siteId,
  onDone,
}: {
  receivingId: string;
  siteId: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [lines, setLines] = React.useState<ReceiptLineDraft[]>([newLine()]);
  const [picked, setPicked] = React.useState<Record<string, InventoryPickerItem>>({});
  const [headerError, setHeaderError] = React.useState<string | null>(null);
  const { itemOptions, query, setQuery, loading } = useItemPicker(siteId);

  const availableOptions = React.useMemo(() => {
    const map = new Map<string, InventoryPickerItem>();
    for (const option of itemOptions) map.set(option.id, option);
    for (const option of Object.values(picked)) map.set(option.id, option);
    return Array.from(map.values());
  }, [itemOptions, picked]);

  const { formState, submit, submitting, serverError } = useFormAction<
    Record<string, unknown>,
    { id: string }
  >(
    async () =>
      addReceiptLines({
        id: receivingId,
        lines: lines.map(toPayloadLine),
      }),
    {
      successMessage: "Lines added",
      onSuccess: () => {
        onDone?.();
        router.refresh();
      },
    }
  );

  const fieldErrors = fieldErrorMap(formState.errors as unknown as Record<string, unknown>);

  function handleSubmit(event?: React.BaseSyntheticEvent) {
    event?.preventDefault();
    if (lines.some((line) => !line.inventoryItemId)) {
      setHeaderError("Every line must be linked to an inventory item.");
      return;
    }
    if (lines.some((line) => !Number(line.quantity) || Number(line.quantity) <= 0)) {
      setHeaderError("Every line needs a quantity greater than zero.");
      return;
    }
    setHeaderError(null);
    void submit(event);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <FormError error={headerError ?? serverError} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Added lines post to stock only when the receipt is completed.
        </p>
        <ItemSearchInput query={query} onQuery={setQuery} loading={loading} />
      </div>
      <LinesEditor
        lines={lines}
        onChange={setLines}
        options={availableOptions}
        fieldErrors={fieldErrors}
        onPick={(item) => setPicked((current) => ({ ...current, [item.id]: item }))}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onDone?.()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Add lines"}
        </Button>
      </div>
    </form>
  );
}

export function ReceiptFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>New receipt</DialogTitle>
          <DialogDescription>
            Record a delivery against a purchase order or as a manual receipt.
          </DialogDescription>
        </DialogHeader>
        <ReceiptForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function NewReceiptButton({ label = "New receipt" }: { label?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <ReceiptFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ReceiptLinesDialog({
  receivingId,
  siteId,
  open,
  onOpenChange,
}: {
  receivingId: string;
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>Add receipt lines</DialogTitle>
          <DialogDescription>
            Lines can only be added while the receipt is still open.
          </DialogDescription>
        </DialogHeader>
        <ReceiptLinesForm
          receivingId={receivingId}
          siteId={siteId}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
