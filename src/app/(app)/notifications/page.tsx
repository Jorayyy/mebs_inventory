import type { Metadata } from "next";
import Link from "next/link";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import type { Prisma, NotificationType } from "@/generated/prisma";
import { requireUser, can, isGlobal } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildQuery, parseTableQuery, str } from "@/lib/query";
import { PageHeader, SectionCard, EmptyState } from "@/components/shared/page-header";
import { Badge, toneToVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterSelect, SearchInput } from "@/components/shared/filters";
import {
  NotificationList,
  type NotificationItem,
} from "@/components/notifications/notification-list";
import { NOTIFICATION_BADGES, NOTIFICATION_TYPE_OPTIONS } from "@/components/notifications/notification-types";
import { formatDate, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const UNREAD_OPTIONS = [
  { value: "yes", label: "Unread only" },
  { value: "no", label: "Read only" },
];

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const canManage = can(user, PERMISSIONS.NOTIFICATIONS_MANAGE);
  const query = parseTableQuery(searchParams);

  const [mine, myUnread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const typeFilter = str(searchParams, "type");
  const unreadFilter = str(searchParams, "unread");
  const q = str(searchParams, "q");
  const userFilter: Prisma.UserWhereInput = {
    ...(isGlobal(user) ? {} : { siteScopes: { some: { siteId: { in: user.siteIds } } } }),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const where: Prisma.NotificationWhereInput = {
    ...(Object.keys(userFilter).length > 0 ? { user: userFilter } : {}),
    ...(typeFilter ? { type: typeFilter as NotificationType } : {}),
    ...(unreadFilter === "yes" ? { readAt: null } : unreadFilter === "no" ? { readAt: { not: null } } : {}),
  };

  const [total, adminRows] = canManage
    ? await Promise.all([
        prisma.notification.count({ where }),
        prisma.notification.findMany({
          where,
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ])
    : [0, []];

  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const startRow = total === 0 ? 0 : (query.page - 1) * query.pageSize + 1;
  const endRow = Math.min(query.page * query.pageSize, total);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description={`${myUnread} unread · low stock, approvals, returns and warranty reminders for your sites.`}
      />

      <SectionCard title="My notifications" description="The 50 most recent updates for your account.">
        <NotificationList
          items={mine.map((notification) => ({
            id: notification.id,
            type: notification.type,
            title: notification.title,
            body: notification.body,
            link: notification.link,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
          } satisfies NotificationItem))}
        />
      </SectionCard>

      {canManage && (
        <SectionCard
          title="All notifications"
          description="Everything queued for users across your sites."
        >
          <div className="space-y-3">
            <FilterBar>
              <FilterSelect
                param="type"
                label="Type"
                options={NOTIFICATION_TYPE_OPTIONS}
                allLabel="All types"
                defaultValue={typeFilter}
              />
              <FilterSelect
                param="unread"
                label="Read status"
                options={UNREAD_OPTIONS}
                allLabel="All"
                defaultValue={unreadFilter}
              />
              <SearchInput placeholder="User name or email…" defaultValue={q ?? ""} />
            </FilterBar>

            {adminRows.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-8 w-8" />}
                title="No notifications match your filters"
                description="Clear a filter to widen the search."
              />
            ) : (
              <div className="space-y-2">
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Recipient</th>
                        <th className="px-3 py-2 font-medium">Type</th>
                        <th className="px-3 py-2 font-medium">Title</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminRows.map((notification) => {
                        const badge = NOTIFICATION_BADGES[notification.type] ?? {
                          label: notification.type,
                          tone: "muted" as const,
                        };
                        return (
                          <tr key={notification.id} className="border-b last:border-0 hover:bg-accent/30">
                            <td className="px-3 py-2">
                              <p className="font-medium">{notification.user.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {notification.user.email}
                              </p>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={toneToVariant(badge.tone)}>{badge.label}</Badge>
                            </td>
                            <td className="max-w-[280px] px-3 py-2">
                              <p className="truncate text-xs">{notification.title}</p>
                              {notification.body && (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {notification.body}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {notification.readAt ? (
                                <span className="text-muted-foreground">
                                  Read {formatRelative(notification.readAt)}
                                </span>
                              ) : (
                                <span className="font-medium text-primary">Unread</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums">
                              {formatDate(notification.createdAt, true)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {startRow.toLocaleString()}–{endRow.toLocaleString()} of {total.toLocaleString()} records
                  </span>
                  {pageCount > 1 && (
                    <div className="flex items-center gap-1.5">
                      {query.page <= 1 ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border opacity-50">
                          <ChevronLeft className="h-4 w-4" />
                        </span>
                      ) : (
                        <Button variant="outline" size="icon-sm" asChild>
                          <Link
                            href={`/notifications${buildQuery(searchParams, {
                              page: String(query.page - 1),
                            })}`}
                            aria-label="Previous page"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      <span className="tabular-nums">
                        Page {query.page} of {pageCount}
                      </span>
                      {query.page >= pageCount ? (
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border opacity-50">
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      ) : (
                        <Button variant="outline" size="icon-sm" asChild>
                          <Link
                            href={`/notifications${buildQuery(searchParams, {
                              page: String(query.page + 1),
                            })}`}
                            aria-label="Next page"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
