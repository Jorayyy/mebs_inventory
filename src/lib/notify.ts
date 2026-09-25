import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { NotificationType } from "@/generated/prisma";

export type NotifyInput = {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  link?: string;
};

/** Creates in-app notifications. Email delivery is intentionally optional (see `sendEmail`). */
export async function notify(input: NotifyInput): Promise<void> {
  const userIds = Array.from(new Set(input.userIds.filter(Boolean)));
  if (userIds.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        link: input.link ?? null,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    logger.error("notify.failed", { type: input.type, error: String(error) });
  }
}

/** Users who should receive stock / inventory alerts for a site. */
export async function inventoryAlertRecipients(siteId?: string | null): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      role: { key: { in: ["SUPER_ADMIN", "INVENTORY_ADMIN", "SITE_ADMIN", "INVENTORY_STAFF"] } },
      ...(siteId ? { siteScopes: { some: { siteId } } } : {}),
    },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

/**
 * Optional SMTP hook. The system must never depend on email, so this is a
 * no-op unless a provider is configured — set EMAIL_WEBHOOK_URL to forward.
 */
export async function sendEmail(payload: {
  to: string | string[];
  subject: string;
  body: string;
}): Promise<void> {
  const url = process.env.EMAIL_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    logger.error("email.failed", { subject: payload.subject, error: String(error) });
  }
}
