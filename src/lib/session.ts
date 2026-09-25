import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { PERMISSIONS, ROLE_DEFINITIONS, type PermissionKey, type RoleKey } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import type { ActionResult } from "@/lib/errors";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  permissions: string[];
  siteIds: string[];
  employeeId: string | null;
  mustChangePassword: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    permissions: u.permissions ?? [],
    siteIds: u.siteIds ?? [],
    employeeId: u.employeeId ?? null,
    mustChangePassword: u.mustChangePassword ?? false,
  };
}

/** For pages: redirects anonymous visitors to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export function can(user: Pick<SessionUser, "permissions">, permission: PermissionKey): boolean {
  return user.permissions.includes(permission);
}

export function canAny(user: Pick<SessionUser, "permissions">, permissions: PermissionKey[]): boolean {
  return permissions.some((p) => user.permissions.includes(p));
}

const GLOBAL_ROLES = new Set(["SUPER_ADMIN", "INVENTORY_ADMIN", "AUDITOR"]);

/** True when the user may see data from every site. */
export function isGlobal(user: Pick<SessionUser, "permissions" | "role">): boolean {
  if (GLOBAL_ROLES.has(user.role)) return true;
  const definition = ROLE_DEFINITIONS[user.role as RoleKey];
  if (definition && !definition.siteScoped) {
    return user.permissions.includes(PERMISSIONS.ASSETS_VIEW);
  }
  return false;
}

/**
 * Server-side authorisation gate. Always call this inside server actions —
 * the UI only mirrors these rules.
 */
export async function requirePermission(
  ...permissions: PermissionKey[]
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AppError("You need to sign in to continue.", { status: 401, code: "UNAUTHENTICATED" });
  }
  const missing = permissions.filter((p) => !user.permissions.includes(p));
  if (missing.length > 0) {
    await recordAudit({
      userId: user.id,
      action: "UNAUTHORIZED_ACCESS",
      entityType: "Permission",
      entityId: missing.join(","),
      description: `Denied: missing ${missing.join(", ")}`,
      ip: await getClientIp(),
    });
    throw new AppError("You do not have permission to perform this action.", {
      status: 403,
      code: "FORBIDDEN",
    });
  }
  return user;
}

/**
 * Page-level gate: like {@link requirePermission} but sends denied users to
 * `fallback` instead of throwing through the error boundary.
 */
export async function requirePermissionPage(
  fallback: string,
  ...permissions: PermissionKey[]
): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const missing = permissions.filter((p) => !user.permissions.includes(p));
  if (missing.length > 0) redirect(fallback);
  return user;
}

/** Throws when the user is not allowed to act on the given site. */
export function assertSiteAccess(user: SessionUser, siteId: string | null | undefined) {
  if (!siteId) return;
  if (isGlobal(user)) return;
  if (!user.siteIds.includes(siteId)) {
    throw new AppError("You do not have access to that site.", { status: 403, code: "SITE_FORBIDDEN" });
  }
}

/**
 * Returns a Prisma `where` fragment restricting rows to the sites the user may see.
 * Global users receive `true` (no restriction).
 */
export function siteScope(
  user: Pick<SessionUser, "siteIds" | "permissions" | "role">,
  field = "siteId"
): Record<string, unknown> | true {
  if (isGlobal(user)) return true;
  if (user.siteIds.length === 0) return { [field]: { in: [] } }; // no access
  return { [field]: { in: user.siteIds } };
}

export async function getClientIp(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  } catch {
    return null;
  }
}

export async function getClientUserAgent(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get("user-agent");
  } catch {
    return null;
  }
}

/** Helper for actions returning `ActionResult`. */
export async function guard<T>(
  permissions: PermissionKey[],
  fn: (user: SessionUser) => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const user = await requirePermission(...permissions);
    const data = await fn(user);
    return { ok: true, data };
  } catch (error) {
    const { handleActionError } = await import("@/lib/errors");
    return handleActionError(error, { action: fn.name });
  }
}
