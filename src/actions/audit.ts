"use server";

import { requirePermission, isGlobal } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@/generated/prisma";

export type AuditLogFilters = {
  action?: string;
  entityType?: string;
  userId?: string;
  site?: string;
  from?: string;
  to?: string;
  q?: string;
};

export type AuditLogInput = {
  filters?: AuditLogFilters;
  page?: number;
  pageSize?: number;
  sort?: "createdAt" | "action" | "entityType";
  dir?: "asc" | "desc";
};

export type AuditLogRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  user: { id: string; name: string; email: string | null } | null;
  siteName: string | null;
  previousJson: string | null;
  newJson: string | null;
};

export type AuditLogPage = { rows: AuditLogRow[]; total: number };

export type AuditFilterOptions = {
  entityTypes: string[];
  users: { id: string; name: string }[];
  sites: { id: string; name: string }[];
};

const SENSITIVE_KEY = /(pass(word)?|hash|secret|token|credential)/i;

/** Deep-copies a JSON payload with credential-like fields masked before rendering. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? "***" : redact(entry);
    }
    return out;
  }
  return value;
}

function serialize(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(redact(value), null, 2);
  } catch {
    return null;
  }
}

function auditWhere(filters: AuditLogFilters, siteIds: string[] | null): Prisma.AuditLogWhereInput {
  return {
    ...(siteIds ? { OR: [{ siteId: { in: siteIds } }, { siteId: null }] } : {}),
    ...(filters.action ? { action: filters.action as AuditAction } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.site ? { siteId: filters.site } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? { description: { contains: filters.q, mode: "insensitive" } }
      : {}),
  };
}

/** Server-paginated audit query shared by `/audit` and `/api/export/audit`. */
export async function queryAuditLogs(input: AuditLogInput = {}): Promise<AuditLogPage> {
  const user = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const siteIds = isGlobal(user) ? null : user.siteIds;
  const where = auditWhere(input.filters ?? {}, siteIds);

  const sortField = (input.sort ?? "createdAt") as "createdAt" | "action" | "entityType";
  const dir = input.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(Math.max(1, input.pageSize ?? 25), 100_000);

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { [sortField]: dir } as never,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const loggedSiteIds = Array.from(
    new Set(items.map((log) => log.siteId).filter((id): id is string => Boolean(id)))
  );
  const loggedSites = loggedSiteIds.length
    ? await prisma.site.findMany({
        where: { id: { in: loggedSiteIds } },
        select: { id: true, name: true },
      })
    : [];
  const siteNameById = new Map(loggedSites.map((site) => [site.id, site.name]));

  return {
    total,
    rows: items.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
      ip: log.ip,
      userAgent: log.userAgent,
      requestId: log.requestId,
      user: log.user,
      siteName: log.siteId ? siteNameById.get(log.siteId) ?? null : null,
      previousJson: serialize(log.previousValue),
      newJson: serialize(log.newValue),
    })),
  };
}

/** Distinct filter values for the audit page controls. */
export async function getAuditFilterOptions(): Promise<AuditFilterOptions> {
  const user = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const siteIds = isGlobal(user) ? null : user.siteIds;

  const [entityRows, users, sites] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: { auditLogs: { some: {} }, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.site.findMany({
      where: { deletedAt: null, ...(siteIds ? { id: { in: siteIds } } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    entityTypes: entityRows.map((row) => row.entityType),
    users,
    sites,
  };
}
