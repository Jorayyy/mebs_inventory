import { z } from "zod";
import { MAINTENANCE_STATUSES } from "@/lib/validations/common";

export const maintenanceCreateSchema = z.object({
  assetId: z.string().min(1, "Asset is required"),
  issue: z.string().trim().min(5, "Describe the issue").max(2000),
  technicianId: z.string().optional().or(z.literal("")),
  vendorId: z.string().optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export const maintenanceUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(MAINTENANCE_STATUSES),
  diagnosis: z.string().max(4000).optional().or(z.literal("")),
  repairAction: z.string().max(4000).optional().or(z.literal("")),
  partsUsed: z.string().max(2000).optional().or(z.literal("")),
  cost: z.union([z.string(), z.number()]).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
