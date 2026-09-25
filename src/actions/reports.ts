"use server";

import { prisma } from "@/lib/prisma";

export type ReportRunMeta = {
  at: Date;
  by: string | null;
  count: number | null;
};

/** Latest export run per report slug, used for the `/reports` card metadata. */
export async function getLastRunMetadata(slugs: string[]): Promise<Record<string, ReportRunMeta>> {
  if (slugs.length === 0) return {};

  const logs = await prisma.auditLog.findMany({
    where: { action: "EXPORT_GENERATED", entityType: "Report", entityId: { in: slugs } },
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      entityId: true,
      createdAt: true,
      newValue: true,
      user: { select: { name: true } },
    },
  });

  const meta: Record<string, ReportRunMeta> = {};
  for (const log of logs) {
    if (!log.entityId || meta[log.entityId]) continue;
    const payload = (log.newValue ?? null) as unknown as { count?: number } | null;
    meta[log.entityId] = {
      at: log.createdAt,
      by: log.user?.name ?? null,
      count: typeof payload?.count === "number" ? payload.count : null,
    };
  }
  return meta;
}
