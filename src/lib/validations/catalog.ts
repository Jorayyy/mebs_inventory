import { z } from "zod";

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  group: z.enum([
    "IT_EQUIPMENT",
    "OFFICE_EQUIPMENT",
    "OFFICE_SUPPLIES",
    "FACILITIES_SAFETY",
    "CUSTOM",
  ]),
  trackingMode: z.enum(["ASSET", "CONSUMABLE", "BOTH"]).default("BOTH"),
  tagPrefix: z
    .string()
    .trim()
    .max(8)
    .regex(/^[A-Za-z0-9]*$/, "Letters and numbers only")
    .optional()
    .or(z.literal("")),
  description: z.string().max(1000).optional().or(z.literal("")),
});

export const itemTypeCreateSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  tagPrefix: z.string().trim().max(8).optional().or(z.literal("")),
  defaultWarrantyMonths: z.union([z.string(), z.number()]).optional(),
});
