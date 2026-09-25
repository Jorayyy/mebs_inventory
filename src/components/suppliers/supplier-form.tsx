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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createSupplier, updateSupplier } from "@/actions/suppliers";

export type SupplierEditable = {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  taxId: string | null;
  productsSupplied: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  archived?: boolean;
};

type SupplierFormValues = {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  taxId: string;
  productsSupplied: string;
  notes: string;
  status: "ACTIVE" | "INACTIVE";
};

function toValues(supplier?: SupplierEditable | null): SupplierFormValues {
  return {
    name: supplier?.name ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    website: supplier?.website ?? "",
    address: supplier?.address ?? "",
    taxId: supplier?.taxId ?? "",
    productsSupplied: supplier?.productsSupplied ?? "",
    notes: supplier?.notes ?? "",
    status: supplier?.status ?? "ACTIVE",
  };
}

export function SupplierForm({
  supplier,
  onDone,
  submitLabel,
}: {
  supplier?: SupplierEditable | null;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const router = useRouter();
  const editing = Boolean(supplier);

  const { register, formState, setValue, watch, submit, submitting, serverError } = useFormAction<
    SupplierFormValues,
    { id: string }
  >(
    async (values) =>
      editing && supplier
        ? updateSupplier({ id: supplier.id, ...values })
        : createSupplier(values),
    {
      successMessage: editing ? "Supplier updated" : "Supplier created",
      onSuccess: () => {
        if (onDone) onDone();
        else {
          router.push("/suppliers");
          router.refresh();
        }
      },
    },
    { defaultValues: toValues(supplier) }
  );

  const status = watch("status");

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
      <FormError error={serverError} />
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Supplier details" : "New supplier"}</CardTitle>
          <CardDescription>
            Used across purchase orders, receipts and inventory items.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier name" htmlFor="supplier-name" required error={formState.errors.name?.message}>
            <Input id="supplier-name" autoComplete="organization" {...register("name")} />
          </Field>

          <Field label="Contact person" htmlFor="supplier-contact" error={formState.errors.contactPerson?.message}>
            <Input id="supplier-contact" {...register("contactPerson")} />
          </Field>

          <Field label="Email" htmlFor="supplier-email" error={formState.errors.email?.message}>
            <Input id="supplier-email" type="email" autoComplete="email" {...register("email")} />
          </Field>

          <Field label="Phone" htmlFor="supplier-phone" error={formState.errors.phone?.message}>
            <Input id="supplier-phone" type="tel" autoComplete="tel" {...register("phone")} />
          </Field>

          <Field label="Website" htmlFor="supplier-website" error={formState.errors.website?.message}>
            <Input id="supplier-website" placeholder="https://" {...register("website")} />
          </Field>

          <Field label="Tax ID" htmlFor="supplier-tax" error={formState.errors.taxId?.message}>
            <Input id="supplier-tax" className="font-mono" {...register("taxId")} />
          </Field>

          <Field
            label="Products supplied"
            htmlFor="supplier-products"
            error={formState.errors.productsSupplied?.message}
            className="sm:col-span-2"
          >
            <Input id="supplier-products" placeholder="e.g. Headsets, toner, network cables" {...register("productsSupplied")} />
          </Field>

          <Field
            label="Address"
            htmlFor="supplier-address"
            error={formState.errors.address?.message}
            className="sm:col-span-2"
          >
            <Textarea id="supplier-address" rows={2} {...register("address")} />
          </Field>

          <Field label="Status" htmlFor="supplier-status" error={formState.errors.status?.message}>
            <Select value={status} onValueChange={(value) => setValue("status", value as "ACTIVE" | "INACTIVE")}>
              <SelectTrigger id="supplier-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Notes"
            htmlFor="supplier-notes"
            error={formState.errors.notes?.message}
            className="sm:col-span-2"
          >
            <Textarea id="supplier-notes" rows={3} {...register("notes")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel ?? (editing ? "Save changes" : "Create supplier")}
        </Button>
      </div>
    </form>
  );
}

export function SupplierFormDialog({
  supplier,
  open,
  onOpenChange,
}: {
  supplier?: SupplierEditable | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide>
        <DialogHeader>
          <DialogTitle>{supplier ? `Edit ${supplier.name}` : "New supplier"}</DialogTitle>
          <DialogDescription>
            {supplier
              ? "Update contact and commercial details for this supplier."
              : "Register a supplier to link against purchase orders and stock items."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[72vh] overflow-y-auto pr-1">
          <SupplierForm supplier={supplier} onDone={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
