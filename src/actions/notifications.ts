"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { AppError, withAction, type ActionResult } from "@/lib/errors";
import { getSessionUser, can } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

async function requireSession() {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("You need to sign in to continue.", { status: 401, code: "UNAUTHENTICATED" });
  }
  return user;
}

/** Unread notification count for a user — feeds the header badge. */
export async function getUnreadCount(userId: string): Promise<number> {
  if (!userId) return 0;
  const user = await requireSession();
  if (user.id !== userId && !can(user, PERMISSIONS.NOTIFICATIONS_MANAGE)) {
    throw new AppError("You do not have permission to perform this action.", {
      status: 403,
      code: "FORBIDDEN",
    });
  }
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Marks a single notification as read (own notifications, or any when managing). */
export async function markNotificationRead(id: string): Promise<ActionResult<{ id: string }>> {
  return withAction(
    async () => {
      const user = await requireSession();
      const notification = await prisma.notification.findUnique({
        where: { id },
        select: { id: true, userId: true, readAt: true },
      });
      if (!notification) throw new AppError("Notification not found.", { status: 404, code: "NOT_FOUND" });
      if (notification.userId !== user.id && !can(user, PERMISSIONS.NOTIFICATIONS_MANAGE)) {
        throw new AppError("You do not have permission to perform this action.", {
          status: 403,
          code: "FORBIDDEN",
        });
      }
      if (!notification.readAt) {
        await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
      }
      revalidatePath("/notifications");
      return { id };
    },
    { action: "markNotificationRead", notificationId: id }
  );
}

/** Marks every unread notification of the signed-in user as read. */
export async function markAllNotificationsRead(): Promise<ActionResult<{ updated: number }>> {
  return withAction(
    async () => {
      const user = await requireSession();
      const result = await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      revalidatePath("/notifications");
      return { updated: result.count };
    },
    { action: "markAllNotificationsRead" }
  );
}
