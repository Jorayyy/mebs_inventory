import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth-config";
import { ROLE_DEFINITIONS, type RoleKey } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { rateLimit, rateLimitKey } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email and password",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        let ip: string | null = null;
        let userAgent: string | null = null;
        try {
          const h = await headers();
          ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
          userAgent = h.get("user-agent");
        } catch {
          /* headers unavailable */
        }

        // Brute-force protection: 10 attempts / minute per IP+email
        const limited = rateLimit(rateLimitKey("login", `${ip ?? "unknown"}:${email}`), {
          limit: 10,
          windowMs: 60_000,
        });
        if (!limited.success) {
          logger.warn("auth.rate_limited", { ip, email });
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        });

        if (!user || user.deletedAt) {
          await recordAudit({
            action: "LOGIN_FAILED",
            ip: ip,
            userAgent: userAgent,
            entityType: "User",
            entityId: null,
            description: `Failed sign-in for unknown email ${email}`,
            newValue: { email },
          });
          return null;
        }

        if (user.status !== "ACTIVE") {
          await recordAudit({
            action: "LOGIN_FAILED",
            ip: ip,
            userAgent: userAgent,
            entityType: "User",
            entityId: user.id,
            description: `Sign-in blocked: account status ${user.status}`,
            newValue: { email, status: user.status },
          });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await recordAudit({
            action: "LOGIN_FAILED",
            ip: ip,
            userAgent: userAgent,
            entityType: "User",
            entityId: user.id,
            description: "Sign-in blocked: account temporarily locked",
          });
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const failedAttempts = user.failedAttempts + 1;
          const lockedUntil =
            failedAttempts >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCK_MINUTES * 60_000)
              : null;
          await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts, lockedUntil },
          });
          await recordAudit({
            action: "LOGIN_FAILED",
            ip: ip,
            userAgent: userAgent,
            entityType: "User",
            entityId: user.id,
            description: `Invalid password (attempt ${failedAttempts})`,
            newValue: { email, failedAttempts },
          });
          return null;
        }

        if (user.failedAttempts || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedAttempts: 0, lockedUntil: null },
          });
        }

        const siteScopes = await prisma.userSite.findMany({
          where: { userId: user.id },
          select: { siteId: true },
        });

        const roleKey = user.role.key as RoleKey;
        const storedPermissions = user.role.permissions.map((rp) => rp.permission.key);
        const permissions =
          storedPermissions.length > 0
            ? storedPermissions
            : ROLE_DEFINITIONS[roleKey]?.permissions ?? [];

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        await recordAudit({
          userId: user.id,
          action: "LOGIN",
          ip: ip,
          userAgent: userAgent,
          entityType: "User",
          entityId: user.id,
          description: `${user.name} signed in`,
        });

        logger.info("auth.login", { userId: user.id, email: user.email, role: roleKey });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.key,
          permissions,
          siteIds: siteScopes.map((s) => s.siteId),
          employeeId: null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissions = user.permissions;
        token.siteIds = user.siteIds;
        token.employeeId = user.employeeId ?? null;
        token.mustChangePassword = user.mustChangePassword ?? false;
        return token;
      }

      // Refresh authorisation data periodically (max once per 5 minutes)
      const issuedAt = (token.iat as number) ?? 0;
      const now = Math.floor(Date.now() / 1000);
      if (trigger === "update" || now - issuedAt > 300) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            include: {
              role: { include: { permissions: { include: { permission: true } } } },
              siteScopes: { select: { siteId: true } },
              employee: { select: { id: true } },
            },
          });
          if (dbUser && !dbUser.deletedAt && dbUser.status === "ACTIVE") {
            token.role = dbUser.role.key;
            token.permissions = dbUser.role.permissions.map((rp) => rp.permission.key);
            token.siteIds = dbUser.siteScopes.map((s) => s.siteId);
            token.employeeId = dbUser.employee?.id ?? null;
            token.mustChangePassword = dbUser.mustChangePassword;
          } else {
            return null as unknown as typeof token; // force sign-out
          }
        } catch (error) {
          logger.error("auth.session_refresh_failed", { error: String(error) });
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.siteIds = (token.siteIds as string[]) ?? [];
        session.user.employeeId = (token.employeeId as string | null) ?? null;
        session.user.mustChangePassword = (token.mustChangePassword as boolean) ?? false;
      }
      return session;
    },
  },
  events: {
    async signOut() {
      // Logout audit is recorded explicitly by the sign-out action (has request context).
    },
  },
});
