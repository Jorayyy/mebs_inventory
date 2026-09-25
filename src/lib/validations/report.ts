import { z } from "zod";

export type RawSearchParams = Record<string, string | string[] | undefined> | undefined;

/** Collapses Next's `searchParams` (array values, empty strings) into a flat record. */
export function flattenSearchParams(raw: RawSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const single = Array.isArray(value) ? value[0] : value;
    if (typeof single === "string" && single.length > 0) out[key] = single;
  }
  return out;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .optional()
  .catch(undefined);

/** Query params understood by every report (`/reports/[slug]` + `/api/export/report`). */
export const reportQuerySchema = z.object({
  site: z.string().max(40).optional().catch(undefined),
  from: isoDate,
  to: isoDate,
  status: z.string().max(40).optional().catch(undefined),
  categoryId: z.string().max(40).optional().catch(undefined),
  q: z.string().max(120).optional().catch(undefined),
  days: z.coerce.number().int().min(1).max(3650).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(500).catch(25),
  sort: z.string().max(40).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).catch("asc"),
});

export type ReportParams = z.infer<typeof reportQuerySchema>;

export function parseReportParams(raw: RawSearchParams): ReportParams {
  return reportQuerySchema.parse(flattenSearchParams(raw));
}

/** Query params understood by the audit trail page and its CSV export. */
export const auditQuerySchema = z.object({
  action: z.string().max(40).optional().catch(undefined),
  entityType: z.string().max(60).optional().catch(undefined),
  userId: z.string().max(40).optional().catch(undefined),
  site: z.string().max(40).optional().catch(undefined),
  from: isoDate,
  to: isoDate,
  q: z.string().max(120).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(200).catch(25),
  sort: z.enum(["createdAt", "action", "entityType"]).catch("createdAt"),
  dir: z.enum(["asc", "desc"]).catch("desc"),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export function parseAuditQuery(raw: RawSearchParams): AuditQuery {
  return auditQuerySchema.parse(flattenSearchParams(raw));
}
