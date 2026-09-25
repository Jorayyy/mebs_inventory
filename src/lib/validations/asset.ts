import { z } from "zod";
import { ASSET_CONDITIONS, ASSET_STATUSES, optionalText } from "@/lib/validations/common";

export const assetCreateSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  categoryId: z.string().min(1, "Category is required"),
  itemTypeId: z.string().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name is required").max(200),
  assetTag: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9._\-\/]*$/, "Use letters, numbers, hyphen, dot, slash or underscore only")
    .optional()
    .or(z.literal(""))
    .refine((v) => v === undefined || v === "" || v.length >= 2, "Asset tag is too short"),
  serialNumber: optionalText(120),
  barcode: optionalText(120),
  description: optionalText(2000),
  manufacturer: optionalText(120),
  brand: optionalText(120),
  model: optionalText(160),
  purchaseDate: z.string().optional().or(z.literal("")),
  purchasePrice: z.union([z.string(), z.number()]).optional(),
  supplierId: z.string().optional().or(z.literal("")),
  warrantyMonths: z.union([z.string(), z.number()]).optional(),
  warrantyStart: z.string().optional().or(z.literal("")),
  roomId: z.string().optional().or(z.literal("")),
  stockLocationId: z.string().optional().or(z.literal("")),
  departmentId: z.string().optional().or(z.literal("")),
  costCenterId: z.string().optional().or(z.literal("")),
  status: z.enum(ASSET_STATUSES).default("IN_STORAGE"),
  condition: z.enum(ASSET_CONDITIONS).default("GOOD"),
  notes: optionalText(4000),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;

export const assetUpdateSchema = assetCreateSchema.partial().extend({
  id: z.string().min(1),
});

export const assetBulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one asset"),
});

export const assetStatusChangeSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one asset"),
  status: z.enum(ASSET_STATUSES),
  condition: z.enum(ASSET_CONDITIONS).optional(),
  notes: optionalText(2000),
});

export const assetAssignmentSchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1, "Select at least one asset"),
  employeeId: z.string().min(1, "Employee is required"),
  conditionAtAssignment: z.enum(ASSET_CONDITIONS).default("GOOD"),
  expectedReturnAt: z.string().optional().or(z.literal("")),
  notes: optionalText(2000),
});

export const assetLabelSchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1, "Select at least one asset"),
  copies: z.coerce.number().int().min(1).max(50).default(1),
});
