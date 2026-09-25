"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { formatNumber } from "@/lib/utils";
import { adjustStock } from "@/actions/inventory";
import type { InventoryItemLite } from "@/components/inventory/inventory-columns";

type Values = {
  mode?: "delta" | "count";
  quantity?: number | string;
  countedQuantity?: number | string;
  reason?: string;
  reference?: string;
  notes?: string;
};

const round3 = (value: number) => Math.round(value * 1000) / 1000;

export function StockAdjustDialog({
  item,
  open,
  onOpenChange,
}: {
  item: InventoryItemLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"delta" | "count">("delta");
  const currentQty = Number(item.currentQty);

  const {
    register,
    setValue,
    watch,
    setError,
    clearErrors,
    formState,
    submit,
    submitting,
    serverError,
  } = useFormAction<Values, { id: string; balance: number }>(
    async (values) => {
      const counted = Number(values.countedQuantity);
      const delta =
        mode === "count" ? round3(counted - currentQty) : Number(values.quantity);
      return adjustStock({
        inventoryItemId: item.id,
        quantity: delta,
        reason: values.reason ?? "",
        reference: values.reference ?? "",
        notes: values.notes ?? "",
      });
    },
    {
      successMessage: "Stock adjusted",
      onSuccess: () => {
        onOpenChange(false);
        router.refresh();
      },
    }
  );

  const err = (name: keyof Values) => formState.errors[name]?.message as string | undefined;
  const quantityValue = mode === "count" ? Number(watch("countedQuantity") || 0) : Number(watch("quantity") || 0);
  const nextBalance =
    mode === "count" ? round3(quantityValue) : round3(currentQty + (Number.isFinite(quantityValue) ? quantityValue : 0));

  function handleSubmit(event?: React.BaseSyntheticEvent) {
    clearErrors();
    if (mode === "count") {
      const counted = Number(watch("countedQuantity"));
      if (!Number.isFinite(counted) || counted < 0) {
        setError("countedQuantity", { type: "manual", message: "Enter the counted quantity" });
        return;
      }
      if (round3(counted - currentQty) === 0) {
        setError("countedQuantity", {
          type: "manual",
          message: "The count matches the on-hand quantity — nothing to adjust",
        });
        return;
      }
    }
    if (!watch("reason") || String(watch("reason")).trim().length < 3) {
      setError("reason", { type: "manual", message: "A reason is required" });
      return;
    }
    void submit(event);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Correct the on-hand quantity after a count, damage check or write-down. Every
            adjustment is recorded in the ledger with your reason.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormError error={serverError} />

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <p className="font-medium">
              {item.sku} · {item.name}
            </p>
            <p className="mt-1 text-muted-foreground">
              On hand {formatNumber(currentQty, 3)} {item.unit} · New balance{" "}
              <span className="font-medium text-foreground">
                {formatNumber(nextBalance, 3)} {item.unit}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Adjustment type" htmlFor="mode">
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as "delta" | "count")}
              >
                <SelectTrigger id="mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delta">Adjust by amount (±)</SelectItem>
                  <SelectItem value="count">Set counted quantity</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {mode === "delta" ? (
              <Field
                label="Adjustment (±)"
                htmlFor="quantity"
                required
                error={err("quantity")}
                hint="Use a negative number to remove stock"
              >
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  placeholder="-3"
                  autoFocus
                  {...register("quantity")}
                />
              </Field>
            ) : (
              <Field
                label="Counted quantity"
                htmlFor="countedQuantity"
                required
                error={err("countedQuantity")}
              >
                <Input
                  id="countedQuantity"
                  type="number"
                  step="any"
                  min="0"
                  placeholder={String(currentQty)}
                  autoFocus
                  {...register("countedQuantity")}
                />
              </Field>
            )}

            <Field label="Reason" htmlFor="reason" required error={err("reason")} className="col-span-2">
              <Input
                id="reason"
                placeholder="e.g. Cycle count variance — rack B3"
                {...register("reason")}
              />
            </Field>

            <Field label="Reference" htmlFor="reference" error={err("reference")}>
              <Input id="reference" placeholder="Optional reference" {...register("reference")} />
            </Field>
          </div>

          <Field label="Notes" htmlFor="notes" error={err("notes")}>
            <Textarea id="notes" rows={2} {...register("notes")} />
          </Field>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Apply adjustment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
