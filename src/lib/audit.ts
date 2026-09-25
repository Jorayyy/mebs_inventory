import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { AuditAction } from "@/generated/prisma";

export type AuditInput = {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  siteId?: string | null;
  description?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

/**
 * Appends an immutable audit record.
 * Never throws — auditing must not break the business operation that is being logged,
 * but failures are surfaced to the structured log for the diagnostics console.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        siteId: input.siteId ?? null,
        description: input.description ?? null,
        previousValue: (input.previousValue as object) ?? undefined,
        newValue: (input.newValue as object) ?? undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        requestId: input.requestId ?? null,
      },
    });
  } catch (error) {
    logger.error("audit.write_failed", { action: input.action, error: String(error) });
  }
}

/** Strips a Prisma record down to the fields we are willing to persist in the audit trail. */
export function snapshot<T extends object>(value: T, keys?: (keyof T)[]): Partial<T> {
  const entries = keys ?? (Object.keys(value) as (keyof T)[]);
  const out: Partial<T> = {};
  for (const key of entries) {
    if (key === "passwordHash") continue;
    out[key] = value[key];
  }
  return out;
}
