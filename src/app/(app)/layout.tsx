import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/shell";
import { ROLE_DEFINITIONS, type RoleKey } from "@/lib/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const unread = await prisma.notification
    .count({ where: { userId: user.id, readAt: null } })
    .catch(() => 0);

  return (
    <Shell
      user={{
        name: user.name,
        email: user.email,
        role: ROLE_DEFINITIONS[user.role as RoleKey]?.name ?? user.role,
        permissions: user.permissions,
      }}
      unread={unread}
    >
      {children}
    </Shell>
  );
}
