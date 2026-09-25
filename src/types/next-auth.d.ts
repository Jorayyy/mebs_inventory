import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      permissions: string[];
      siteIds: string[];
      employeeId: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    permissions: string[];
    siteIds: string[];
    employeeId?: string | null;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    permissions?: string[];
    siteIds?: string[];
    employeeId?: string | null;
    mustChangePassword?: boolean;
  }
}
