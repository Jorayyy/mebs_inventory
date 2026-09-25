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
import { CONSUME_REASONS } from "@/lib/validations/inventory";
import { issueStock, consumeStock, replenishStock } from "@/actions/inventory";
import type { InventoryItemLite } from "@/components/inventory/inventory-columns";

export type IssueMode = "issue" | "consume" | "replenish";

const TITLES: Record<IssueMode, string> = {
  issue: "Issue stock",
  consume: "Consume stock",
  replenish: "Replenish stock",
};

const DESCRIPTIONS: Record<IssueMode, string> = {
  issue: "Stock leaves the store for a person, team or work order.",
  consume: "Stock is used up, damaged or written off.",
  replenish: "Stock is added from a supplier delivery or another source.",
};

type Values = {
  quantity: number | string;
  issuedTo?: string;
  reason?: string;
  unitCost?: number | string;
  reference?: string;
  notes?: string;
};

export function StockIssueDialog({
  mode,
  item,
  open,
  onOpenChange,
}: {
  mode: IssueMode;
  item: InventoryItemLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const currentQty = Number(item.currentQty);
  const reservedQty = Number(item.reservedQty);
  const available = currentQty - reservedQty;

  const { register, setValue, watch, formState, submit, submitting, serverError } =
    useFormAction<Values, { id: string; balance: number }>(
      async (values) => {
        const payload = {
          inventoryItemId: item.id,
          quantity: Number(values.quantity),
          reference: values.reference ?? "",
          notes: values.notes ?? "",
          ...(mode === "issue" ? { issuedTo: values.issuedTo ?? "" } : {}),
          ...(mode === "consume" ? { reason: values.reason ?? "USAGE" } : {}),
          ...(mode === "replenish"
            ? { unitCost: Number(values.unitCost ?? 0), supplierId: "" }
            : {}),
        };
        if (mode === "issue") return issueStock(payload);
        if (mode === "consume") return consumeStock(payload);
        return replenishStock(payload);
      },
      {
        successMessage:
          mode === "issue"
            ? "Stock issued"
            : mode === "consume"
              ? "Stock consumed"
              : "Stock replenished",
        onSuccess: () => {
          onOpenChange(false);
          router.refresh();
        },
      }
    );

  const err = (name: keyof Values) => formState.errors[name]?.message as string | undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[mode]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormError error={serverError} />

          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <p className="font-medium">
              {item.sku} · {item.name}
            </p>
            <p className="mt-1 text-muted-foreground">
              On hand {formatNumber(currentQty, 3)} {item.unit} · Reserved{" "}
              {formatNumber(reservedQty, 3)} · Available {formatNumber(available, 3)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity" htmlFor="quantity" required error={err("quantity")}>
              <Input
                id="quantity"
                type="number"
                step="any"
                min="0"
                placeholder="0"
                autoFocus
                {...register("quantity")}
              />
            </Field>

            {mode === "issue" && (
              <Field label="Issued to" htmlFor="issuedTo" error={err("issuedTo")}>
                <Input id="issuedTo" placeholder="Person, team or desk" {...register("issuedTo")} />
              </Field>
            )}

            {mode === "consume" && (
              <Field label="Reason" htmlFor="reason" required error={err("reason")}>
                <Select
                  value={watch("reason") ?? "USAGE"}
                  onValueChange={(value) => setValue("reason", value)}
                >
                  <SelectTrigger id="reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONSUME_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason === "WRITE_OFF"
                          ? "Write-off"
                          : reason.charAt(0) + reason.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {mode === "replenish" && (
              <Field label="Unit cost" htmlFor="unitCost" error={err("unitCost")}>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={Number(item.unitCost)}
                  {...register("unitCost")}
                />
              </Field>
            )}

            <Field label="Reference" htmlFor="reference" error={err("reference")}>
              <Input id="reference" placeholder="e.g. WO-1042" {...register("reference")} />
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
              {submitting ? "Saving…" : TITLES[mode]}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
