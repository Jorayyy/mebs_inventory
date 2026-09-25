"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bell, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page-header";
import { markAllNotificationsRead, markNotificationRead } from "@/actions/notifications";
import { NOTIFICATION_BADGES } from "./notification-types";
import { cn, formatRelative } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [markingAll, setMarkingAll] = React.useState(false);
  const unreadCount = items.filter((item) => !item.readAt).length;

  async function handleMarkOne(id: string) {
    setPendingId(id);
    try {
      const result = await markNotificationRead(id);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    } finally {
      setPendingId(null);
    }
  }

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      const result = await markAllNotificationsRead();
      if (result.ok) {
        toast.success("All notifications marked as read");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setMarkingAll(false);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Bell className="h-8 w-8" />}
        title="No notifications yet"
        description="Low stock, approvals, warranty expiries and returns will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {unreadCount} unread · showing the {items.length} most recent
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={unreadCount === 0 || markingAll}
          onClick={handleMarkAll}
        >
          <CheckCheck /> Mark all read
        </Button>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const badge = NOTIFICATION_BADGES[item.type] ?? {
            label: item.type,
            tone: "muted" as const,
          };
          const isUnread = !item.readAt;
          return (
            <li
              key={item.id}
              className={cn(
                "rounded-lg border bg-card p-3 shadow-sm",
                isUnread && "border-l-2 border-l-primary bg-accent/30",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={toneToVariant(badge.tone)}>{badge.label}</Badge>
                    {isUnread && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{item.title}</p>
                  {item.body && (
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatRelative(item.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {item.link && (
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={item.link}>
                        Open <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  {isUnread && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendingId === item.id}
                      onClick={() => handleMarkOne(item.id)}
                    >
                      <Check /> Mark read
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
