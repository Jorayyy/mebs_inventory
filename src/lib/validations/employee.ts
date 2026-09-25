import { z } from "zod";

export const employeeCreateSchema = z.object({
  siteId: z.string().min(1, "Site is required"),
  departmentId: z.string().min(1, "Department is required"),
  teamId: z.string().optional().or(z.literal("")),
  employeeNo: z.string().trim().min(1, "Employee number is required").max(60),
  firstName: z.string().trim().min(1, "First name is required").max(120),
  lastName: z.string().trim().min(1, "Last name is required").max(120),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().max(60).optional().or(z.literal("")),
  jobTitle: z.string().max(160).optional().or(z.literal("")),
  hireDate: z.string().optional().or(z.literal("")),
  employmentStatus: z.enum(["ACTIVE", "ON_LEAVE", "ENDING", "EXITED"]).default("ACTIVE"),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
