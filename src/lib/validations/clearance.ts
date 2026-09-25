import { z } from "zod";
import { ASSET_CONDITIONS, optionalText } from "@/lib/validations/common";

/** Offboarding checklist + one-shot clearance for an employee. */
export const clearanceEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
});

export const clearEmployeeSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  condition: z.enum(ASSET_CONDITIONS).default("GOOD"),
  notes: optionalText(2000),
});

export type ClearEmployeeInput = z.infer<typeof clearEmployeeSchema>;
