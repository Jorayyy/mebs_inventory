import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config (no Prisma / Node-only imports).
 * Used by middleware for route protection; the full config with the
 * Credentials provider lives in `src/lib/auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;
      const isAuthPage = pathname.startsWith("/login");

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", request.nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.permissions = user.permissions;
        token.siteIds = user.siteIds;
        token.employeeId = user.employeeId ?? null;
        token.mustChangePassword = user.mustChangePassword ?? false;
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
  providers: [],
} satisfies NextAuthConfig;
