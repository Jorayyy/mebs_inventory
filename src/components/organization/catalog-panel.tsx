"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, PackageSearch } from "lucide-react";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/page-header";
import { createCategory, createItemType } from "@/actions/catalog";
import type { OrgCategory } from "@/components/organization/organization-view";

const GROUPS = [
  "IT_EQUIPMENT",
  "OFFICE_EQUIPMENT",
  "OFFICE_SUPPLIES",
  "FACILITIES_SAFETY",
  "CUSTOM",
] as const;

const GROUP_LABELS: Record<string, string> = {
  IT_EQUIPMENT: "IT equipment",
  OFFICE_EQUIPMENT: "Office equipment",
  OFFICE_SUPPLIES: "Office supplies",
  FACILITIES_SAFETY: "Facilities & safety",
  CUSTOM: "Custom",
};

const TRACKING_LABELS: Record<string, string> = {
  ASSET: "Assets only",
  CONSUMABLE: "Consumables only",
  BOTH: "Assets & consumables",
};

type CategoryValues = {
  name: string;
  group: string;
  trackingMode: string;
  tagPrefix: string;
  description: string;
};

type ItemTypeValues = {
  categoryId: string;
  name: string;
  tagPrefix: string;
  defaultWarrantyMonths: string;
};

const EMPTY_CATEGORY: CategoryValues = {
  name: "",
  group: "IT_EQUIPMENT",
  trackingMode: "BOTH",
  tagPrefix: "",
  description: "",
};

const EMPTY_ITEM_TYPE: ItemTypeValues = {
  categoryId: "",
  name: "",
  tagPrefix: "",
  defaultWarrantyMonths: "",
};

export function CatalogPanel({
  categories,
  canCatalog,
}: {
  categories: OrgCategory[];
  canCatalog: boolean;
}) {
  const router = useRouter();
  const [categoryOpen, setCategoryOpen] = React.useState(false);
  const [itemTypeFor, setItemTypeFor] = React.useState<string | null>(null);

  const categoryForm = useFormAction<CategoryValues, { id: string }>(createCategory, {
    successMessage: "Category created",
    onSuccess: () => {
      setCategoryOpen(false);
      categoryForm.reset(EMPTY_CATEGORY);
      router.refresh();
    },
  });

  const itemTypeForm = useFormAction<ItemTypeValues, { id: string }>(createItemType, {
    successMessage: "Item type created",
    onSuccess: () => {
      setItemTypeFor(null);
      itemTypeForm.reset(EMPTY_ITEM_TYPE);
      router.refresh();
    },
  });

  const errCategory = (name: keyof CategoryValues) =>
    categoryForm.formState.errors[name]?.message as string | undefined;
  const errItemType = (name: keyof ItemTypeValues) =>
    itemTypeForm.formState.errors[name]?.message as string | undefined;

  if (categories.length === 0 && !canCatalog) {
    return (
      <EmptyState
        title="No categories"
        description="Ask an administrator to create categories and item types."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Categories &amp; item types</CardTitle>
              <CardDescription>
                Categories drive tag prefixes, tracking mode and form options across the system.
              </CardDescription>
            </div>
            {canCatalog &&
              (categoryOpen ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCategoryOpen(false);
                    categoryForm.reset(EMPTY_CATEGORY);
                  }}
                >
                  <X /> Cancel
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    categoryForm.reset(EMPTY_CATEGORY);
                    setCategoryOpen(true);
                  }}
                >
                  <Plus /> Category
                </Button>
              ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canCatalog && categoryOpen && (
            <form
              onSubmit={categoryForm.submit}
              className="space-y-3 rounded-md border bg-muted/30 p-4"
              noValidate
            >
              <FormError error={categoryForm.serverError} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Category name" htmlFor="cat-name" required error={errCategory("name")}>
                  <Input id="cat-name" {...categoryForm.register("name")} />
                </Field>
                <Field label="Group" htmlFor="cat-group" required error={errCategory("group")}>
                  <Select
                    value={categoryForm.watch("group")}
                    onValueChange={(value) =>
                      categoryForm.setValue("group", value, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="cat-group">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>
                          {GROUP_LABELS[group]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tracking mode" htmlFor="cat-tracking" required error={errCategory("trackingMode")}>
                  <Select
                    value={categoryForm.watch("trackingMode")}
                    onValueChange={(value) =>
                      categoryForm.setValue("trackingMode", value, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="cat-tracking">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["BOTH", "ASSET", "CONSUMABLE"] as const).map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {TRACKING_LABELS[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Tag prefix"
                  htmlFor="cat-prefix"
                  error={errCategory("tagPrefix")}
                  hint="Letters and numbers, up to 8 characters"
                >
                  <Input id="cat-prefix" className="font-mono" maxLength={8} {...categoryForm.register("tagPrefix")} />
                </Field>
                <Field
                  label="Description"
                  htmlFor="cat-description"
                  error={errCategory("description")}
                  className="sm:col-span-2"
                >
                  <Input id="cat-description" {...categoryForm.register("description")} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={categoryForm.submitting}>
                  {categoryForm.submitting ? "Saving…" : "Create category"}
                </Button>
              </div>
            </form>
          )}

          {canCatalog && itemTypeFor && (
            <form
              onSubmit={itemTypeForm.submit}
              className="space-y-3 rounded-md border bg-muted/30 p-4"
              noValidate
            >
              <FormError error={itemTypeForm.serverError} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label="Item type name" htmlFor="itype-name" required error={errItemType("name")}>
                  <Input id="itype-name" {...itemTypeForm.register("name")} />
                </Field>
                <Field label="Tag prefix" htmlFor="itype-prefix" error={errItemType("tagPrefix")}>
                  <Input
                    id="itype-prefix"
                    className="font-mono"
                    maxLength={8}
                    {...itemTypeForm.register("tagPrefix")}
                  />
                </Field>
                <Field
                  label="Warranty (months)"
                  htmlFor="itype-warranty"
                  error={errItemType("defaultWarrantyMonths")}
                >
                  <Input
                    id="itype-warranty"
                    type="number"
                    min={0}
                    max={120}
                    {...itemTypeForm.register("defaultWarrantyMonths")}
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <Button type="submit" size="sm" disabled={itemTypeForm.submitting}>
                    {itemTypeForm.submitting ? "Saving…" : "Add"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setItemTypeFor(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          )}

          {categories.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Create the first category to start cataloguing inventory."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {categories.map((category) => (
                <div key={category.id} className="rounded-md border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <PackageSearch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{category.name}</span>
                      <Badge variant="outline">{GROUP_LABELS[category.group] ?? category.group}</Badge>
                      <Badge variant="muted">{TRACKING_LABELS[category.trackingMode] ?? category.trackingMode}</Badge>
                      {category.tagPrefix && (
                        <Badge variant="info" className="font-mono">
                          {category.tagPrefix}
                        </Badge>
                      )}
                    </div>
                    {canCatalog && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          itemTypeForm.reset({ ...EMPTY_ITEM_TYPE, categoryId: category.id });
                          setItemTypeFor(category.id);
                        }}
                      >
                        <Plus /> Item type
                      </Button>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    {category.itemTypes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No item types yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {category.itemTypes.map((itemType) => (
                          <span
                            key={itemType.id}
                            className="inline-flex items-center gap-1.5 rounded border bg-muted px-2 py-1 text-xs"
                          >
                            <span className="font-medium">{itemType.name}</span>
                            {itemType.tagPrefix && (
                              <span className="font-mono text-muted-foreground">{itemType.tagPrefix}</span>
                            )}
                            {itemType.defaultWarrantyMonths !== null && (
                              <span className="text-muted-foreground">
                                · {itemType.defaultWarrantyMonths} mo
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
