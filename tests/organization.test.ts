import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { NAV_GROUPS, resolveActiveHref } from "@/components/layout/nav-config";
import { ORG_SECTIONS, ORG_SECTION_HREFS } from "@/lib/organization-nav";

describe("organization setup sections", () => {
  it("starts at the setup overview and nests every other screen under it", () => {
    expect(ORG_SECTIONS[0]).toEqual({ label: "Overview", href: "/settings/organization" });
    expect(new Set(ORG_SECTION_HREFS).size).toBe(ORG_SECTIONS.length);
    expect(new Set(ORG_SECTIONS.map((section) => section.label)).size).toBe(ORG_SECTIONS.length);
    for (const section of ORG_SECTIONS) {
      expect(section.href === "/settings/organization" || section.href.startsWith("/settings/organization/")).toBe(
        true
      );
    }
  });

  it("lights the right section for its own path", () => {
    for (const href of ORG_SECTION_HREFS) {
      expect(resolveActiveHref(href, ORG_SECTION_HREFS)).toBe(href);
    }
  });

  it("keeps the overview lit for unknown organization sub-paths", () => {
    expect(resolveActiveHref("/settings/organization/nope", ORG_SECTION_HREFS)).toBe(
      "/settings/organization"
    );
  });

  it("has a page file behind every section", () => {
    const missing = ORG_SECTIONS.filter(
      (section) => !fs.existsSync(path.join("src", "app", "(app)", section.href, "page.tsx"))
    ).map((section) => section.label);
    expect(missing).toEqual([]);
  });
});

describe("navigation groups", () => {
  it("groups people, reporting and administration the way the IA specifies", () => {
    const labels = NAV_GROUPS.map((group) => group.label);
    expect(labels).toEqual(["Overview", "Inventory", "People", "Reports", "Administration"]);

    const people = NAV_GROUPS.find((group) => group.label === "People");
    expect(people?.items.map((item) => item.label)).toEqual(["Employees", "My Assets", "Suppliers"]);

    const reports = NAV_GROUPS.find((group) => group.label === "Reports");
    expect(reports?.items.map((item) => item.label)).toEqual([
      "Reports",
      "Audit Trail",
      "Notifications",
    ]);
  });

  it("keeps the organization entry pointing at the setup center", () => {
    const admin = NAV_GROUPS.find((group) => group.label === "Administration");
    const organization = admin?.items.find((item) => item.label === "Organization");
    expect(organization?.href).toBe("/settings/organization");
  });

  it("keeps every nav href unique and the pinned routes present", () => {
    const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const pinned of [
      "/inventory",
      "/inventory/receive",
      "/assets",
      "/assignments",
      "/my",
      "/settings/users",
    ]) {
      expect(hrefs).toContain(pinned);
    }
  });
});
