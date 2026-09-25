import { z } from "zod";
import { ASSET_CONDITIONS, optionalText, dateString } from "@/lib/validations/common";

export const transferItemLineSchema = z.object({
  inventoryItemId: z.string().min(1, "Select a consumable"),
  quantity: z.coerce
    .number({ invalid_type_error: "Enter a quantity" })
    .positive("Quantity must be greater than zero"),
  notes: optionalText(500),
});

export type TransferItemLine = z.infer<typeof transferItemLineSchema>;

export const transferCreateSchema = z
  .object({
    fromSiteId: z.string().min(1, "Source site is required"),
    toSiteId: z.string().min(1, "Destination site is required"),
    fromLocationId: z.string().optional().or(z.literal("")),
    toLocationId: z.string().optional().or(z.literal("")),
    courier: optionalText(160),
    referenceNumber: optionalText(120),
    expectedArrival: dateString,
    notes: optionalText(4000),
    assetIds: z.array(z.string().min(1)).default([]),
    items: z.array(transferItemLineSchema).default([]),
    submit: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.fromSiteId === value.toSiteId) {
      ctx.addIssue({
        code: "custom",
        path: ["toSiteId"],
        message: "Source and destination sites must be different",
      });
    }
    if (value.assetIds.length === 0 && value.items.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["assetIds"],
        message: "Add at least one asset or consumable line",
      });
    }
    if (new Set(value.assetIds).size !== value.assetIds.length) {
      ctx.addIssue({ code: "custom", path: ["assetIds"], message: "Remove duplicate assets" });
    }
  });

export type TransferCreateInput = z.infer<typeof transferCreateSchema>;

export const transferIdSchema = z.object({
  id: z.string().min(1),
  notes: optionalText(2000),
});

export const transferRejectSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().min(3, "Provide a reason for rejecting").max(2000),
});

export const transferShipSchema = z.object({
  id: z.string().min(1),
  courier: optionalText(160),
  referenceNumber: optionalText(120),
  expectedArrival: dateString,
  notes: optionalText(2000),
});

export const transferReceiveSchema = z.object({
  id: z.string().min(1),
  notes: optionalText(2000),
  conditions: z
    .array(
      z.object({
        assetId: z.string().min(1),
        condition: z.enum(ASSET_CONDITIONS),
      })
    )
    .default([]),
});

export type TransferReceiveInput = z.infer<typeof transferReceiveSchema>;
