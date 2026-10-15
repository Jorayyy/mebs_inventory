import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  NAV_PERMISSIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  ROLE_KEYS,
} from "@/lib/permissions";

describe("permission catalogue", () => {
  it("exposes 44 unique permission keys", () => {
    expect(ALL_PERMISSIONS).toHaveLength(44);
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });

  it("uses dotted snake_case values", () => {
    for (const key of ALL_PERMISSIONS) {
      expect(key).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it("every role only grants known permissions", () => {
    for (const role of ROLE_KEYS) {
      for (const permission of ROLE_DEFINITIONS[role].permissions) {
        expect(ALL_PERMISSIONS).toContain(permission);
      }
    }
  });

  it("roles never grant the same permission twice", () => {
    for (const role of ROLE_KEYS) {
      const permissions = ROLE_DEFINITIONS[role].permissions;
      expect(new Set(permissions).size).toBe(permissions.length);
    }
  });

  it("super admin gets everything and employee only self-service", () => {
    expect(ROLE_DEFINITIONS.SUPER_ADMIN.permissions).toEqual([...ALL_PERMISSIONS]);
    expect(ROLE_DEFINITIONS.EMPLOYEE.permissions).toEqual([
      PERMISSIONS.SELF_SERVICE_VIEW,
      PERMISSIONS.SELF_SERVICE_REQUEST,
    ]);
    expect(ROLE_DEFINITIONS.EMPLOYEE.permissions).not.toContain(PERMISSIONS.DASHBOARD_VIEW);
    expect(ROLE_DEFINITIONS.EMPLOYEE.permissions).not.toContain(PERMISSIONS.ASSETS_VIEW);
  });

  it("site-scoped roles are exactly SITE_ADMIN, TECHNICIAN, DEPARTMENT_MANAGER and INVENTORY_STAFF", () => {
    const scoped = ROLE_KEYS.filter((key) => ROLE_DEFINITIONS[key].siteScoped).sort();
    expect(scoped).toEqual([
      "DEPARTMENT_MANAGER",
      "INVENTORY_STAFF",
      "SITE_ADMIN",
      "TECHNICIAN",
    ]);
  });

  it("nav entries reference known permissions", () => {
    for (const permission of Object.values(NAV_PERMISSIONS)) {
      expect(ALL_PERMISSIONS).toContain(permission);
    }
    expect(Object.keys(NAV_PERMISSIONS)).toContain("assets");
    expect(NAV_PERMISSIONS.settings).toBe(PERMISSIONS.SETTINGS_MANAGE);
  });
});
