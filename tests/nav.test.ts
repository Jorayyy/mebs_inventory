import { describe, expect, it } from "vitest";
import { NAV_GROUPS, resolveActiveHref } from "@/components/layout/nav-config";

const hrefs = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

describe("resolveActiveHref", () => {
  it("lights exactly one entry for sibling inventory routes", () => {
    expect(resolveActiveHref("/inventory", hrefs)).toBe("/inventory");
    expect(resolveActiveHref("/inventory/receive", hrefs)).toBe("/inventory/receive");
    expect(resolveActiveHref("/inventory/receive/r_1", hrefs)).toBe("/inventory/receive");
    expect(resolveActiveHref("/inventory/i_1", hrefs)).toBe("/inventory");
  });

  it("keeps the parent entry lit for its own detail pages", () => {
    expect(resolveActiveHref("/assets/a_1", hrefs)).toBe("/assets");
    expect(resolveActiveHref("/assets/a_1/edit", hrefs)).toBe("/assets");
    expect(resolveActiveHref("/assignments/clearance", hrefs)).toBe("/assignments");
    expect(resolveActiveHref("/my/assignments", hrefs)).toBe("/my");
    expect(resolveActiveHref("/settings/users/u_1", hrefs)).toBe("/settings/users");
  });

  it("only matches on path-segment boundaries", () => {
    expect(resolveActiveHref("/inventoryish", hrefs)).toBe("");
    expect(resolveActiveHref("/assetsome", hrefs)).toBe("");
    expect(resolveActiveHref("/unknown", hrefs)).toBe("");
    expect(resolveActiveHref("/", hrefs)).toBe("");
  });

  it("prefers the longest matching href", () => {
    expect(resolveActiveHref("/inventory/receive/r_1", ["/inventory", "/inventory/receive"])).toBe(
      "/inventory/receive"
    );
  });
});
