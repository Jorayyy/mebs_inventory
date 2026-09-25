import { z } from "zod";

export const id = z.string().min(1, "Required").cuid("Invalid id");

export const optionalId = z.string().cuid().optional().or(z.literal("")).optional();

export const dateString = z
  .string()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Enter a valid date");

export const decimalInput = z
  .union([z.string(), z.number()])
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "Must be a number");

export const optionalText = (max = 2000) => z.string().max(max).optional().or(z.literal(""));

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(200).default(25),
});

/** Rejects client-supplied ids/unknown keys from create/update payloads. */
export function stripUnknown<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

export const ASSET_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "IN_STORAGE",
  "UNDER_MAINTENANCE",
  "DAMAGED",
  "LOST",
  "STOLEN",
  "FOR_REPAIR",
  "RETIRED",
  "DISPOSED",
  "TRANSFERRED",
] as const;

export const ASSET_CONDITIONS = ["NEW", "EXCELLENT", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;

export const TRANSFER_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "IN_TRANSIT",
  "RECEIVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const MAINTENANCE_STATUSES = [
  "REPORTED",
  "DIAGNOSED",
  "IN_REPAIR",
  "AWAITING_PARTS",
  "COMPLETED",
  "RETURNED_TO_SERVICE",
  "CANCELLED",
] as const;
