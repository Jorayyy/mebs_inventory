"use client";

import * as React from "react";

const PermissionsContext = React.createContext<readonly string[]>([]);

export function PermissionsProvider({
  permissions,
  children,
}: {
  permissions: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <PermissionsContext.Provider value={permissions}>{children}</PermissionsContext.Provider>
  );
}

/** Client-side permission check for UI gating (server actions still enforce). */
export function useCan(permission: string): boolean {
  return React.useContext(PermissionsContext).includes(permission);
}
