import { z } from "zod";
import { optionalText } from "@/lib/validations/common";

export const RECEIPT_LINE_CONDITIONS = ["GOOD", "DAMAGED", "EXPIRED", "RETURNED"] as const;
export type ReceiptLineCondition = (typeof RECEIPT_LINE_CONDITIONS)[number];

export const CONSUME_REASONS = ["USAGE", "DAMAGE", "WRITE_OFF", "SAMPLE", "OTHER"] as const;

const qty = z.coerce.number().positive("Enter a quantity greater than zero");
const amount = z.coerce.number().min(0, "Cannot be negative");
const itemId = z.string().min(1, "Item is required");

export const stockIssueSchema = z.object({
  inventoryItemId: itemId,
  quantity: qty,
  issuedTo: optionalText(160),
  reference: optionalText(120),
  notes: optionalText(2000),
});
export type StockIssueInput = z.infer<typeof stockIssueSchema>;

export const stockConsumeSchema = z.object({
  inventoryItemId: itemId,
  quantity: qty,
  reason: z.enum(CONSUME_REASONS).default("USAGE"),
  reference: optionalText(120),
  notes: optionalText(2000),
});
export type StockConsumeInput = z.infer<typeof stockConsumeSchema>;

export const stockAdjustSchema = z.object({
  inventoryItemId: itemId,
  quantity: z.coerce.number().refine((v) => v !== 0, "Enter a non-zero adjustment"),
  reason: z.string().trim().min(3, "A reason is required").max(300),
  reference: optionalText(120),
  notes: optionalText(2000),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

export const stockReplenishSchema = z.object({
  inventoryItemId: itemId,
  quantity: qty,
  unitCost: amount.optional(),
  supplierId: z.string().optional().or(z.literal("")),
  reference: optionalText(120),
  notes: optionalText(2000),
});
export type StockReplenishInput = z.infer<typeof stockReplenishSchema>;

export const inventoryItemCreateSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(60),
  name: z.string().trim().min(2, "Name is required").max(200),
  description: optionalText(2000),
  categoryId: z.string().min(1, "Category is required"),
  itemTypeId: z.string().optional().or(z.literal("")),
  siteId: z.string().min(1, "Site is required"),
  stockLocationId: z.string().min(1, "Stock location is required"),
  binLocation: optionalText(80),
  unit: z.string().trim().min(1, "Unit is required").max(30).default("EACH"),
  minQty: amount.default(0),
  maxQty: amount.optional(),
  reorderLevel: amount.default(0),
  unitCost: amount.default(0),
  supplierId: z.string().optional().or(z.literal("")),
  openingQty: amount.default(0),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "true")
    .default(true),
});
export type InventoryItemCreateInput = z.infer<typeof inventoryItemCreateSchema>;

export const inventoryItemUpdateSchema = inventoryItemCreateSchema
  .omit({ openingQty: true })
  .partial()
  .extend({ id: z.string().min(1) });

export const receiptLineSchema = z.object({
  inventoryItemId: itemId,
  description: z.string().trim().min(1, "Description is required").max(500),
  quantity: qty,
  unitCost: amount.default(0),
  condition: z.enum(RECEIPT_LINE_CONDITIONS).default("GOOD"),
  expiryDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), "Enter a valid expiry date"),
  batch: optionalText(80),
});
export type ReceiptLineInput = z.infer<typeof receiptLineSchema>;

export const receiptCreateSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  stockLocationId: z.string().optional().or(z.literal("")),
  poId: z.string().optional().or(z.literal("")),
  supplierId: z.string().optional().or(z.literal("")),
  deliveryDate: z.string().optional().or(z.literal("")),
  invoiceNumber: optionalText(80),
  referenceNumber: optionalText(80),
  notes: optionalText(4000),
  lines: z.array(receiptLineSchema).min(1, "Add at least one line"),
});
export type ReceiptCreateInput = z.infer<typeof receiptCreateSchema>;

export const receiptLinesSchema = z.object({
  id: z.string().min(1),
  lines: z.array(receiptLineSchema).min(1, "Add at least one line"),
});

export const receiptCompleteSchema = z.object({ id: z.string().min(1) });

export const receiptLineRemoveSchema = z.object({
  lineId: z.string().min(1),
  receivingId: z.string().min(1),
});

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required").max(160),
  contactPerson: optionalText(160),
  email: z
    .string()
    .trim()
    .max(160)
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  phone: optionalText(60),
  website: optionalText(200),
  address: optionalText(400),
  taxId: optionalText(80),
  productsSupplied: optionalText(400),
  notes: optionalText(4000),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;

export const supplierUpdateSchema = supplierCreateSchema.partial().extend({
  id: z.string().min(1),
});

export type ReceiptLineMeta = {
  batch?: string;
  expiryDate?: string;
  condition?: string;
};

const META_MARKER = "\n[meta]";

/** ReceivingItem has no batch/expiry/condition columns, so line metadata rides on the description. */
export function withLineMeta(description: string, meta?: ReceiptLineMeta | null): string {
  const base = description.trim();
  if (!meta) return base;
  const payload: Record<string, string> = {};
  if (meta.batch) payload.batch = meta.batch;
  if (meta.expiryDate) payload.expiryDate = meta.expiryDate;
  if (meta.condition) payload.condition = meta.condition;
  if (Object.keys(payload).length === 0) return base;
  return `${base}${META_MARKER}${JSON.stringify(payload)}`;
}

export function splitLineMeta(description: string | null | undefined): {
  text: string;
  meta: ReceiptLineMeta;
} {
  const raw = description ?? "";
  const index = raw.indexOf(META_MARKER);
  if (index === -1) return { text: raw.trim(), meta: {} };
  const text = raw.slice(0, index).trim();
  try {
    const parsed = JSON.parse(raw.slice(index + META_MARKER.length)) as ReceiptLineMeta;
    return { text, meta: parsed ?? {} };
  } catch {
    return { text, meta: {} };
  }
}
