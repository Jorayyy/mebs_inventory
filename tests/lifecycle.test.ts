import { describe, expect, it } from "vitest";
import type { AssetStatus } from "@/generated/prisma";
import {
  ASSET_TRANSITIONS,
  TERMINAL_STATUSES,
  assetActionsForStatus,
  assetStatusLabel,
  assertAssignable,
  assertAssetTransition,
  assertTransferable,
  canTransition,
  describeReturnOutcome,
  isAssignable,
  isTransferable,
  nextStepHint,
  permittedAssetActions,
  returnAssetStatus,
} from "@/lib/lifecycle";

describe("asset status transitions", () => {
  it("maps every status to itself", () => {
    for (const status of Object.keys(ASSET_TRANSITIONS) as AssetStatus[]) {
      expect(canTransition(status, status)).toBe(true);
    }
  });

  it("never allows an asset to leave DISPOSED", () => {
    expect(ASSET_TRANSITIONS.DISPOSED).toHaveLength(0);
    expect(() => assertAssetTransition("DISPOSED", "AVAILABLE")).toThrowError(/cannot move/i);
  });

  it("keeps ASSIGNED out of disposal — return first", () => {
    expect(canTransition("ASSIGNED", "DISPOSED")).toBe(false);
    expect(() => assertAssetTransition("ASSIGNED", "DISPOSED", "PC-1")).toThrowError(
      /PC-1 cannot move from Assigned to Disposed/
    );
  });

  it("rejects unknown transitions with a human message", () => {
    expect(() => assertAssetTransition("RETIRED", "ASSIGNED", "AST-9")).toThrowError(
      /AST-9 cannot move from Retired to Assigned/
    );
  });
});

describe("custody guards", () => {
  it("only lets free assets be assigned", () => {
    expect(isAssignable("AVAILABLE")).toBe(true);
    expect(isAssignable("IN_STORAGE")).toBe(true);
    expect(isAssignable("TRANSFERRED")).toBe(true);
    expect(isAssignable("ASSIGNED")).toBe(false);
    expect(isAssignable("DISPOSED")).toBe(false);
    expect(isAssignable("UNDER_MAINTENANCE")).toBe(false);
  });

  it("explains why an assignment is blocked", () => {
    expect(() => assertAssignable("ASSIGNED", "PC-2")).toThrowError(/already assigned/);
    expect(() => assertAssignable("UNDER_MAINTENANCE", "PC-2")).toThrowError(/out of service/);
    expect(() => assertAssignable("DISPOSED", "PC-2")).toThrowError(/disposed/);
    expect(() => assertAssignable("AVAILABLE", "PC-2")).not.toThrow();
  });

  it("requires the return to be recorded before a transfer", () => {
    expect(isTransferable("AVAILABLE")).toBe(true);
    expect(isTransferable("ASSIGNED")).toBe(false);
    expect(() => assertTransferable("ASSIGNED", "PC-3")).toThrowError(/Record the return/);
    expect(() => assertTransferable("RETIRED", "PC-3")).toThrowError(/cannot be transferred/);
  });
});

describe("return outcome → resulting status", () => {
  it("sends a missing asset to LOST", () => {
    expect(returnAssetStatus("MISSING", "GOOD")).toBe("LOST");
    expect(returnAssetStatus("MISSING", "DAMAGED")).toBe("LOST");
  });

  it("routes damage to maintenance", () => {
    expect(returnAssetStatus("DAMAGED", "GOOD")).toBe("UNDER_MAINTENANCE");
    expect(returnAssetStatus("RETURNED", "DAMAGED")).toBe("UNDER_MAINTENANCE");
    expect(returnAssetStatus("RETURNED", "POOR")).toBe("UNDER_MAINTENANCE");
  });

  it("returns good and fair stock to AVAILABLE", () => {
    expect(returnAssetStatus("RETURNED", "GOOD")).toBe("AVAILABLE");
    expect(returnAssetStatus("RETURNED", "FAIR")).toBe("AVAILABLE");
  });

  it("describes every outcome in plain language", () => {
    expect(describeReturnOutcome("MISSING", "GOOD")).toMatch(/Lost/);
    expect(describeReturnOutcome("DAMAGED", "GOOD")).toMatch(/maintenance/i);
    expect(describeReturnOutcome("RETURNED", "GOOD")).toMatch(/Available/);
  });
});

describe("contextual actions", () => {
  it("offers assign/transfer/maintenance for a free asset", () => {
    const keys = assetActionsForStatus("AVAILABLE").map((action) => action.key);
    expect(keys).toContain("assign");
    expect(keys).toContain("transfer");
    expect(keys).toContain("maintenance");
    expect(keys).not.toContain("return");
  });

  it("makes Return the primary action for an assigned asset", () => {
    const actions = assetActionsForStatus("ASSIGNED");
    expect(actions[0]?.key).toBe("return");
    expect(actions[0]?.primary).toBe(true);
  });

  it("offers only history for a disposed asset", () => {
    expect(assetActionsForStatus("DISPOSED").map((action) => action.key)).toEqual(["edit"]);
  });

  it("adds a return action when custody is open even if parked elsewhere", () => {
    const keys = assetActionsForStatus("UNDER_MAINTENANCE", { openAssignment: true }).map(
      (action) => action.key
    );
    expect(keys).toContain("return");
  });

  it("filters actions the user cannot perform", () => {
    const keys = assetActionsForStatus("AVAILABLE").map((action) => action.key);
    const filtered = permittedAssetActions("AVAILABLE", []);
    expect(keys.length).toBeGreaterThan(0);
    expect(filtered).toHaveLength(0);
    expect(
      permittedAssetActions("AVAILABLE", ["assets.assign", "transfers.create"]).map(
        (action) => action.key
      )
    ).toEqual(["assign", "transfer"]);
  });
});

describe("next-step hints", () => {
  it("gives every known status a next step", () => {
    for (const status of Object.keys(ASSET_TRANSITIONS)) {
      expect(nextStepHint(status)).not.toBe("");
      expect(nextStepHint(status).length).toBeGreaterThan(10);
    }
  });

  it("labels terminal statuses as history only", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(nextStepHint(status)).toMatch(/history/i);
    }
    expect(assetStatusLabel("DISPOSED")).toBe("Disposed");
  });
});
