import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth-config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    /*
     * Protect everything except Next internals, static assets and the auth endpoints.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
