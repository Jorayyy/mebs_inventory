import { describe, expect, it } from "vitest";
import { assetCreateSchema, assetLabelSchema, assetStatusChangeSchema } from "@/lib/validations/asset";
import { employeeCreateSchema } from "@/lib/validations/employee";
import {
  inventoryItemCreateSchema,
  receiptCreateSchema,
  stockAdjustSchema,
  stockIssueSchema,
} from "@/lib/validations/inventory";
import { maintenanceCreateSchema } from "@/lib/validations/maintenance";
import { transferCreateSchema } from "@/lib/validations/transfer";
import { paginationSchema } from "@/lib/validations/common";

const asset = {
  siteId: "site_1",
  categoryId: "cat_1",
  name: "Dell Latitude 7440",
  assetTag: "AST-0001",
};

describe("assetCreateSchema", () => {
  it("accepts a minimal asset and applies defaults", () => {
    const parsed = assetCreateSchema.safeParse(asset);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.status).toBe("IN_STORAGE");
    expect(parsed.data.condition).toBe("GOOD");
  });

  it("requires site, category and a usable name", () => {
    expect(assetCreateSchema.safeParse({ ...asset, siteId: "" }).success).toBe(false);
    expect(assetCreateSchema.safeParse({ ...asset, categoryId: "" }).success).toBe(false);
    expect(assetCreateSchema.safeParse({ ...asset, name: "x" }).success).toBe(false);
  });

  it("rejects malformed asset tags", () => {
    expect(assetCreateSchema.safeParse({ ...asset, assetTag: "not a tag!" }).success).toBe(false);
    expect(assetCreateSchema.safeParse({ ...asset, assetTag: "A" }).success).toBe(false);
    expect(assetCreateSchema.safeParse({ ...asset, assetTag: "" }).success).toBe(true);
  });
});

describe("asset bulk schemas", () => {
  it("requires at least one id", () => {
    expect(assetLabelSchema.safeParse({ assetIds: [], copies: 1 }).success).toBe(false);
    expect(assetLabelSchema.safeParse({ assetIds: ["a"], copies: "3" }).success).toBe(true);
    expect(assetLabelSchema.safeParse({ assetIds: ["a"], copies: "99" }).success).toBe(false);
  });

  it("validates status changes", () => {
    expect(
      assetStatusChangeSchema.safeParse({ ids: ["a"], status: "NOPE" }).success
    ).toBe(false);
    expect(
      assetStatusChangeSchema.safeParse({ ids: ["a"], status: "ASSIGNED" }).success
    ).toBe(true);
  });
});

describe("employeeCreateSchema", () => {
  const employee = {
    siteId: "site_1",
    departmentId: "dep_1",
    employeeNo: "EMP-001",
    firstName: "Maria",
    lastName: "Santos",
    email: "maria@mebs.local",
  };

  it("accepts a complete record with defaults", () => {
    const parsed = employeeCreateSchema.safeParse(employee);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.employmentStatus).toBe("ACTIVE");
  });

  it("requires the identifiers and a valid email when given", () => {
    expect(employeeCreateSchema.safeParse({ ...employee, employeeNo: "" }).success).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...employee, firstName: "" }).success).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...employee, email: "nope" }).success).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...employee, email: "" }).success).toBe(true);
  });
});

describe("inventoryItemCreateSchema", () => {
  const item = {
    sku: "CBL-HDMI-2M",
    name: "HDMI Cable 2m",
    categoryId: "cat_1",
    siteId: "site_1",
    stockLocationId: "loc_1",
  };

  it("accepts a minimal item and applies stock defaults", () => {
    const parsed = inventoryItemCreateSchema.safeParse(item);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.unit).toBe("EACH");
    expect(parsed.data.reorderLevel).toBe(0);
    expect(parsed.data.isActive).toBe(true);
  });

  it("requires sku, name, site and stock location", () => {
    expect(inventoryItemCreateSchema.safeParse({ ...item, sku: "" }).success).toBe(false);
    expect(inventoryItemCreateSchema.safeParse({ ...item, name: "" }).success).toBe(false);
    expect(inventoryItemCreateSchema.safeParse({ ...item, stockLocationId: "" }).success).toBe(false);
  });
});

describe("stock movements", () => {
  it("rejects zero and negative issues", () => {
    expect(stockIssueSchema.safeParse({ inventoryItemId: "i1", quantity: 0 }).success).toBe(false);
    expect(stockIssueSchema.safeParse({ inventoryItemId: "i1", quantity: -2 }).success).toBe(false);
    expect(stockIssueSchema.safeParse({ inventoryItemId: "i1", quantity: "5" }).success).toBe(true);
  });

  it("requires a reason for adjustments and forbids zero", () => {
    expect(stockAdjustSchema.safeParse({ inventoryItemId: "i1", quantity: 0, reason: "x" }).success).toBe(false);
    expect(stockAdjustSchema.safeParse({ inventoryItemId: "i1", quantity: -1, reason: "ok" }).success).toBe(false);
    expect(
      stockAdjustSchema.safeParse({ inventoryItemId: "i1", quantity: -1, reason: "Broken cable" })
        .success
    ).toBe(true);
  });
});

describe("receiptCreateSchema", () => {
  const receipt = {
    siteId: "site_1",
    lines: [{ inventoryItemId: "i1", description: "Cable", quantity: 10 }],
  };

  it("accepts at least one line", () => {
    expect(receiptCreateSchema.safeParse(receipt).success).toBe(true);
    expect(receiptCreateSchema.safeParse({ siteId: "site_1", lines: [] }).success).toBe(false);
    expect(
      receiptCreateSchema.safeParse({ siteId: "", lines: receipt.lines }).success
    ).toBe(false);
  });
});

describe("transferCreateSchema", () => {
  const base = {
    fromSiteId: "site_a",
    toSiteId: "site_b",
    expectedArrival: "",
    assetIds: ["asset_1"],
    items: [],
    submit: true,
  };

  it("accepts a transfer between two sites", () => {
    expect(transferCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects same-site transfers", () => {
    const parsed = transferCreateSchema.safeParse({ ...base, toSiteId: "site_a" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues.some((issue) => issue.path[0] === "toSiteId")).toBe(true);
  });

  it("requires at least one asset or consumable line", () => {
    expect(transferCreateSchema.safeParse({ ...base, assetIds: [], items: [] }).success).toBe(false);
  });

  it("rejects duplicate assets", () => {
    expect(transferCreateSchema.safeParse({ ...base, assetIds: ["asset_1", "asset_1"] }).success).toBe(false);
  });
});

describe("maintenanceCreateSchema", () => {
  it("requires an asset and a meaningful issue", () => {
    expect(
      maintenanceCreateSchema.safeParse({ assetId: "asset_1", issue: "Screen flickers when cold" })
        .success
    ).toBe(true);
    expect(maintenanceCreateSchema.safeParse({ issue: "Screen flickers" }).success).toBe(false);
    expect(
      maintenanceCreateSchema.safeParse({ assetId: "asset_1", issue: "bad" }).success
    ).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("coerces and bounds page sizes", () => {
    expect(paginationSchema.safeParse({ page: "3", pageSize: "50" }).success).toBe(true);
    expect(paginationSchema.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationSchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});
