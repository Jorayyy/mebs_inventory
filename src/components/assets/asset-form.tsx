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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { assetCreateSchema } from "@/lib/validations/asset";
import { ASSET_STATUS, ASSET_CONDITION, DEPRECIATION_METHODS } from "@/lib/constants";
import type { FormOptions } from "@/actions/catalog";
import type { Asset } from "@/generated/prisma";
import type { z } from "zod";

type Values = z.infer<typeof assetCreateSchema>;

type AssetInitial = Partial<Values> & { id?: string };

export function AssetForm({
  options,
  initial,
  mode,
}: {
  options: FormOptions;
  initial?: AssetInitial;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [siteId, setSiteId] = React.useState(initial?.siteId ?? "");
  const [categoryId, setCategoryId] = React.useState(initial?.categoryId ?? "");

  // Register + assign in one sitting: the common case for new equipment.
  const [assignNow, setAssignNow] = React.useState(false);
  const [assigneeId, setAssigneeId] = React.useState("");
  const [assignCondition, setAssignCondition] = React.useState<Values["condition"]>("GOOD");
  const [assignDue, setAssignDue] = React.useState("");

  const {
    register,
    setValue,
    watch,
    formState,
    submit,
    submitting,
    serverError,
    reset,
  } = useFormAction<Values, Asset>(
      async (values) => {
        const { createAsset, updateAsset } = await import("@/actions/assets");
        return mode === "edit" && initial?.id
          ? updateAsset({ ...values, id: initial.id })
          : createAsset(values);
      },
      {
        successMessage: mode === "edit" ? "Asset updated" : "Asset created",
        onSuccess: async (asset) => {
          if (mode === "create" && assignNow && assigneeId) {
            const { assignAssets } = await import("@/actions/assets");
            const result = await assignAssets({
              assetIds: [asset.id],
              employeeId: assigneeId,
              conditionAtAssignment: assignCondition,
              expectedReturnAt: assignDue,
              notes: "Assigned at registration",
            });
            if (result.ok) {
              toast.success("Asset registered and assigned", {
                description: `${asset.assetTag} is now in custody.`,
              });
            } else {
              toast.error(result.error, {
                description: "The asset was created but not assigned — use Assign asset on its page.",
              });
            }
          }
          router.push(`/assets/${asset.id}`);
          router.refresh();
        },
      },
      { defaultValues: initial as Values }
    );

  React.useEffect(() => {
    if (initial?.id) reset(initial as Values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  const category = options.categories.find((c) => c.id === categoryId);
  const filteredDepartments = options.departments.filter((d) => !siteId || d.siteId === siteId);
  const filteredRooms = options.rooms.filter((r) => !siteId || r.siteId === siteId);
  const filteredLocations = options.stockLocations.filter((s) => !siteId || s.siteId === siteId);

  const err = (name: keyof Values) => formState.errors[name]?.message as string | undefined;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError error={serverError} />

      <Card>
        <CardHeader>
          <CardTitle>Identification</CardTitle>
          <CardDescription>
            Leave the asset tag blank to auto-generate one using the category prefix and site code.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Asset name" htmlFor="name" required error={err("name")}>
            <Input id="name" placeholder="e.g. Dell OptiPlex 7010" {...register("name")} />
          </Field>

          <Field label="Asset tag" htmlFor="assetTag" error={err("assetTag")} hint="Auto-generated if blank">
            <Input
              id="assetTag"
              placeholder="e.g. PC-MNL-00001"
              className="font-mono"
              {...register("assetTag")}
            />
          </Field>

          <Field label="Serial number" htmlFor="serialNumber" error={err("serialNumber")}>
            <Input id="serialNumber" className="font-mono" {...register("serialNumber")} />
          </Field>

          <Field label="Category" htmlFor="categoryId" required error={err("categoryId")}>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                setValue("categoryId", value, { shouldValidate: true });
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

          <Field label="Barcode / QR value" htmlFor="barcode" error={err("barcode")}>
            <Input id="barcode" className="font-mono" {...register("barcode")} />
          </Field>

          <Field label="Brand" htmlFor="brand" error={err("brand")}>
            <Input id="brand" placeholder="e.g. Dell" {...register("brand")} />
          </Field>

          <Field label="Model" htmlFor="model" error={err("model")}>
            <Input id="model" placeholder="e.g. OptiPlex 7010 SFF" {...register("model")} />
          </Field>

          <Field label="Manufacturer" htmlFor="manufacturer" error={err("manufacturer")}>
            <Input id="manufacturer" {...register("manufacturer")} />
          </Field>

          <Field label="Description" htmlFor="description" error={err("description")} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="description" rows={2} {...register("description")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location &amp; ownership</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Site" htmlFor="siteId" required error={err("siteId")}>
            <Select
              value={siteId}
              onValueChange={(value) => {
                setSiteId(value);
                setValue("siteId", value, { shouldValidate: true });
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

          <Field label="Department" htmlFor="departmentId" error={err("departmentId")}>
            <Select
              value={watch("departmentId") ?? ""}
              onValueChange={(value) => setValue("departmentId", value)}
            >
              <SelectTrigger id="departmentId">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {filteredDepartments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Room / workstation" htmlFor="roomId" error={err("roomId")}>
            <Select
              value={watch("roomId") ?? ""}
              onValueChange={(value) => setValue("roomId", value)}
            >
              <SelectTrigger id="roomId">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {filteredRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.path}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Storage location" htmlFor="stockLocationId" error={err("stockLocationId")}>
            <Select
              value={watch("stockLocationId") ?? ""}
              onValueChange={(value) => setValue("stockLocationId", value)}
            >
              <SelectTrigger id="stockLocationId">
                <SelectValue placeholder="Select storage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {filteredLocations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Cost centre" htmlFor="costCenterId" error={err("costCenterId")}>
            <Select
              value={watch("costCenterId") ?? ""}
              onValueChange={(value) => setValue("costCenterId", value)}
            >
              <SelectTrigger id="costCenterId">
                <SelectValue placeholder="Select cost centre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {options.costCenters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status" htmlFor="status" error={err("status")}>
            <Select
              value={watch("status") ?? "IN_STORAGE"}
              onValueChange={(value) => setValue("status", value as Values["status"])}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASSET_STATUS)
                  .filter(([value]) => mode === "edit" || (value !== "ASSIGNED" && value !== "DISPOSED"))
                  .map(([value, meta]) => (
                    <SelectItem key={value} value={value}>
                      {meta.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Condition" htmlFor="condition" error={err("condition")}>
            <Select
              value={watch("condition") ?? "GOOD"}
              onValueChange={(value) => setValue("condition", value as Values["condition"])}
            >
              <SelectTrigger id="condition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ASSET_CONDITION).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Procurement &amp; warranty</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Purchase date" htmlFor="purchaseDate" error={err("purchaseDate")}>
            <Input id="purchaseDate" type="date" {...register("purchaseDate")} />
          </Field>

          <Field label="Purchase price" htmlFor="purchasePrice" error={err("purchasePrice")}>
            <Input id="purchasePrice" type="number" step="0.01" min="0" placeholder="0.00" {...register("purchasePrice")} />
          </Field>

          <Field label="Supplier" htmlFor="supplierId" error={err("supplierId")}>
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

          <Field label="Warranty (months)" htmlFor="warrantyMonths" error={err("warrantyMonths")}>
            <Input id="warrantyMonths" type="number" min="0" {...register("warrantyMonths")} />
          </Field>

          <Field label="Warranty start" htmlFor="warrantyStart" error={err("warrantyStart")}>
            <Input id="warrantyStart" type="date" {...register("warrantyStart")} />
          </Field>

          <Field label="Notes" htmlFor="notes" error={err("notes")} className="sm:col-span-2 lg:col-span-3">
            <Textarea id="notes" rows={2} {...register("notes")} />
          </Field>
        </CardContent>
      </Card>

      {mode === "create" && options.employees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Custody</CardTitle>
            <CardDescription>
              Register and hand over in one step. The asset is recorded first, then assigned —
              leaving an open assignment from which it can be returned later.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="assignNow"
                checked={assignNow}
                onCheckedChange={(checked) => setAssignNow(checked === true)}
              />
              <Label htmlFor="assignNow" className="cursor-pointer text-sm font-medium">
                Assign this asset to an employee now
              </Label>
            </div>

            {assignNow && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
                <Field label="Assign to" htmlFor="assigneeId" required>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger id="assigneeId">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Condition on handover" htmlFor="assignCondition">
                  <Select
                    value={assignCondition}
                    onValueChange={(value) => setAssignCondition(value as Values["condition"])}
                  >
                    <SelectTrigger id="assignCondition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ASSET_CONDITION).map(([value, meta]) => (
                        <SelectItem key={value} value={value}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Expected return" htmlFor="assignDue" hint="Optional">
                  <Input
                    id="assignDue"
                    type="date"
                    value={assignDue}
                    onChange={(event) => setAssignDue(event.target.value)}
                  />
                </Field>

                <p className="text-xs text-muted-foreground sm:col-span-3">
                  The asset will move straight to Assigned and appear on the employee&apos;s
                  profile, ready for a one-click return.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : mode === "edit" ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </form>
  );
}
