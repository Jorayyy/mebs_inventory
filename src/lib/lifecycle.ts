/**
 * Single source of truth for the asset inventory lifecycle.
 *
 * The mental model the whole app follows:
 *
 *   Add → Receive → Available → Assign / Transfer → Return → Maintenance / Available → Dispose
 *
 * Everything in here is pure and isomorphic: server actions use it to reject
 * invalid state transitions, and UI components use it to decide which action to
 * show for the asset's current status. Never hard-code a status rule elsewhere.
 */

import { AppError } from "@/lib/errors";
import { ASSET_STATUS } from "@/lib/constants";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import type { AssetCondition, AssetStatus, AssignmentStatus } from "@/generated/prisma";

/** Statuses that end the asset's life — no destructive or custody actions apply. */
export const TERMINAL_STATUSES: readonly AssetStatus[] = ["DISPOSED"];

/** Statuses where the asset is parked and cannot be handed out. */
export const OUT_OF_SERVICE: readonly AssetStatus[] = ["UNDER_MAINTENANCE", "FOR_REPAIR"];

/**
 * Allowed status transitions. A status always maps to itself (no-op) plus the
 * states it can legitimately move to. Anything not listed is rejected server-side.
 */
export const ASSET_TRANSITIONS: Record<AssetStatus, readonly AssetStatus[]> = {
  AVAILABLE: [
    "ASSIGNED",
    "IN_STORAGE",
    "UNDER_MAINTENANCE",
    "FOR_REPAIR",
    "TRANSFERRED",
    "DAMAGED",
    "LOST",
    "STOLEN",
    "RETIRED",
    "DISPOSED",
  ],
  ASSIGNED: [
    "AVAILABLE",
    "IN_STORAGE",
    "UNDER_MAINTENANCE",
    "FOR_REPAIR",
    "TRANSFERRED",
    "DAMAGED",
    "LOST",
    "STOLEN",
    "RETIRED",
  ],
  IN_STORAGE: [
    "AVAILABLE",
    "ASSIGNED",
    "UNDER_MAINTENANCE",
    "FOR_REPAIR",
    "TRANSFERRED",
    "RETIRED",
    "DISPOSED",
  ],
  UNDER_MAINTENANCE: [
    "AVAILABLE",
    "ASSIGNED",
    "IN_STORAGE",
    "FOR_REPAIR",
    "DAMAGED",
    "RETIRED",
    "DISPOSED",
  ],
  FOR_REPAIR: [
    "AVAILABLE",
    "ASSIGNED",
    "IN_STORAGE",
    "UNDER_MAINTENANCE",
    "DAMAGED",
    "RETIRED",
    "DISPOSED",
  ],
  DAMAGED: ["AVAILABLE", "UNDER_MAINTENANCE", "FOR_REPAIR", "IN_STORAGE", "RETIRED", "DISPOSED"],
  LOST: ["AVAILABLE", "UNDER_MAINTENANCE", "RETIRED", "DISPOSED"],
  STOLEN: ["AVAILABLE", "RETIRED", "DISPOSED"],
  TRANSFERRED: ["AVAILABLE", "ASSIGNED", "IN_STORAGE", "UNDER_MAINTENANCE", "RETIRED"],
  RETIRED: ["AVAILABLE", "DISPOSED"],
  DISPOSED: [],
};

export function assetStatusLabel(status: string): string {
  return ASSET_STATUS[status as AssetStatus]?.label ?? status;
}

export function canTransition(from: AssetStatus, to: AssetStatus): boolean {
  if (from === to) return true;
  return (ASSET_TRANSITIONS[from] ?? []).includes(to);
}

/** Server-side guard: throws a user-safe error when `to` is not reachable from `from`. */
export function assertAssetTransition(
  from: AssetStatus,
  to: AssetStatus,
  assetTag?: string
): void {
  if (canTransition(from, to)) return;
  const subject = assetTag ? `${assetTag} ` : "This asset ";
  if (to === "DISPOSED" && from === "DISPOSED") {
    throw new AppError(`${subject}is already disposed.`, { code: "INVALID_TRANSITION" });
  }
  throw new AppError(
    `${subject}cannot move from ${assetStatusLabel(from)} to ${assetStatusLabel(to)}.`,
    { code: "INVALID_TRANSITION" }
  );
}

export function isTerminal(status: AssetStatus | string): boolean {
  return TERMINAL_STATUSES.includes(status as AssetStatus);
}

export function isOutOFService(status: AssetStatus | string): boolean {
  return OUT_OF_SERVICE.includes(status as AssetStatus);
}

/** True when the asset may be handed to an employee right now. */
export function isAssignable(status: AssetStatus | string): boolean {
  return status === "AVAILABLE" || status === "IN_STORAGE" || status === "TRANSFERRED";
}

/** True when a return can be recorded (an open assignment implies ASSIGNED). */
export function isReturnable(status: AssetStatus | string): boolean {
  return status === "ASSIGNED";
}

export function isTransferable(status: AssetStatus | string): boolean {
  return status === "AVAILABLE" || status === "IN_STORAGE" || status === "TRANSFERRED";
}

/** Server-side guard for adding an asset to a transfer. */
export function assertTransferable(status: AssetStatus | string, assetTag: string): void {
  if (isTransferable(status)) return;
  if (status === "ASSIGNED") {
    throw new AppError(`${assetTag} is assigned. Record the return before transferring it.`, {
      code: "UNAVAILABLE",
    });
  }
  if (isOutOFService(status)) {
    throw new AppError(`${assetTag} is out of service (${assetStatusLabel(status)}) and cannot be transferred.`, {
      code: "UNAVAILABLE",
    });
  }
  throw new AppError(`${assetTag} is ${assetStatusLabel(status).toLowerCase()} and cannot be transferred.`, {
    code: "UNAVAILABLE",
  });
}

/** Server-side guard for the assign action. */
export function assertAssignable(status: AssetStatus | string, assetTag: string): void {
  if (isAssignable(status)) return;
  if (isTerminal(status)) {
    throw new AppError(`${assetTag} is ${assetStatusLabel(status).toLowerCase()} and cannot be assigned.`, {
      code: "UNAVAILABLE",
    });
  }
  if (status === "ASSIGNED") {
    throw new AppError(`${assetTag} is already assigned. Return it before assigning it again.`, {
      code: "UNAVAILABLE",
    });
  }
  if (isOutOFService(status)) {
    throw new AppError(`${assetTag} is out of service (${assetStatusLabel(status)}) and cannot be assigned.`, {
      code: "UNAVAILABLE",
    });
  }
  throw new AppError(`${assetTag} is ${assetStatusLabel(status).toLowerCase()} and cannot be assigned.`, {
    code: "UNAVAILABLE",
  });
}

export type ReturnOutcome = "RETURNED" | "DAMAGED" | "MISSING";

/**
 * Condition after return → the asset status the system should apply automatically.
 * Users never pick the resulting status by hand; they describe what came back.
 */
export function returnAssetStatus(outcome: ReturnOutcome, condition: AssetCondition): AssetStatus {
  if (outcome === "MISSING") return "LOST";
  if (outcome === "DAMAGED") return "UNDER_MAINTENANCE";
  if (condition === "DAMAGED") return "UNDER_MAINTENANCE";
  if (condition === "POOR") return "UNDER_MAINTENANCE";
  if (condition === "FAIR") return "AVAILABLE";
  return "AVAILABLE";
}

/** Plain-language explanation shown in the return dialog before confirming. */
export function describeReturnOutcome(outcome: ReturnOutcome, condition: AssetCondition): string {
  const status = returnAssetStatus(outcome, condition);
  if (outcome === "MISSING") return "Asset will be marked Lost and an investigation note is recorded.";
  if (outcome === "DAMAGED" || condition === "DAMAGED") {
    return "Asset will be sent to maintenance and marked Under Maintenance.";
  }
  if (condition === "POOR") {
    return "Asset will be sent for inspection and marked Under Maintenance.";
  }
  if (condition === "FAIR") return "Asset returns to stock as Available — noted as Fair condition.";
  return "Asset returns to stock as Available.";
}

/** Statuses an assignment can be in for an open (unsettled) custody record. */
export const OPEN_ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = ["ACTIVE", "RETURN_PENDING"];

export type AssetActionKey =
  | "assign"
  | "return"
  | "transfer"
  | "maintenance"
  | "receive"
  | "dispose"
  | "edit"
  | "label";

export type AssetAction = {
  key: AssetActionKey;
  label: string;
  /** Tab on the asset detail page the action lives behind. */
  tab: "overview" | "assignment" | "maintenance" | "transfers" | "qr";
  /** Optional deep link when the action leaves the page. */
  href?: string;
  permission: PermissionKey | null;
  /** Only one action is promoted to the primary button. */
  primary?: boolean;
};

/**
 * Contextual actions for an asset's current status — the UI must not show
 * buttons that would fail. Order matters: the first entry is the primary action.
 * `openAssignment` adds the Return action for assets that are out on loan but
 * parked in another status (e.g. sent to maintenance while assigned).
 */
export function assetActionsForStatus(
  status: AssetStatus | string,
  options: { openAssignment?: boolean } = {}
): AssetAction[] {
  const actions: AssetAction[] = [];
  const s = status as AssetStatus;
  const showReturn = options.openAssignment ?? isReturnable(s);

  if (isAssignable(s)) {
    actions.push({
      key: "assign",
      label: "Assign asset",
      tab: "assignment",
      permission: PERMISSIONS.ASSETS_ASSIGN,
      primary: true,
    });
    actions.push({
      key: "transfer",
      label: "Transfer",
      tab: "transfers",
      permission: PERMISSIONS.TRANSFERS_CREATE,
    });
    actions.push({
      key: "maintenance",
      label: "Send to maintenance",
      tab: "maintenance",
      permission: PERMISSIONS.MAINTENANCE_MANAGE,
    });
    actions.push({ key: "dispose", label: "Dispose", tab: "overview", permission: PERMISSIONS.ASSETS_DISPOSE });
  } else if (s === "ASSIGNED") {
    actions.push({
      key: "return",
      label: "Return asset",
      tab: "assignment",
      permission: PERMISSIONS.ASSIGNMENTS_RETURN,
      primary: true,
    });
    actions.push({
      key: "maintenance",
      label: "Report issue",
      tab: "maintenance",
      permission: PERMISSIONS.MAINTENANCE_MANAGE,
    });
  } else if (s === "UNDER_MAINTENANCE" || s === "FOR_REPAIR" || s === "DAMAGED") {
    actions.push({
      key: "maintenance",
      label: "View maintenance",
      tab: "maintenance",
      permission: PERMISSIONS.MAINTENANCE_VIEW,
      primary: true,
    });
    actions.push({ key: "dispose", label: "Dispose", tab: "overview", permission: PERMISSIONS.ASSETS_DISPOSE });
  } else if (s === "LOST" || s === "STOLEN") {
    actions.push({
      key: "edit",
      label: "Update record",
      tab: "overview",
      permission: PERMISSIONS.ASSETS_UPDATE,
      primary: true,
    });
    actions.push({ key: "dispose", label: "Dispose", tab: "overview", permission: PERMISSIONS.ASSETS_DISPOSE });
  } else if (s === "RETIRED") {
    actions.push({
      key: "dispose",
      label: "Dispose",
      tab: "overview",
      permission: PERMISSIONS.ASSETS_DISPOSE,
      primary: true,
    });
    actions.push({ key: "edit", label: "Reinstate", tab: "overview", permission: PERMISSIONS.ASSETS_UPDATE });
  } else if (s === "DISPOSED") {
    actions.push({ key: "edit", label: "View history", tab: "overview", permission: null, primary: true });
  }

  if (showReturn && !actions.some((action) => action.key === "return")) {
    actions.splice(1, 0, {
      key: "return",
      label: "Return asset",
      tab: "assignment",
      permission: PERMISSIONS.ASSIGNMENTS_RETURN,
    });
  }

  return actions;
}

/** Actions the signed-in user may actually perform (permission-filtered). */
export function permittedAssetActions(
  status: AssetStatus | string,
  permissions: readonly string[],
  options: { openAssignment?: boolean } = {}
): AssetAction[] {
  return assetActionsForStatus(status, options).filter(
    (action) => action.permission === null || permissions.includes(action.permission)
  );
}

/** One-line hint describing the next sensible step for this status. */
export function nextStepHint(status: AssetStatus | string): string {
  switch (status as AssetStatus) {
    case "AVAILABLE":
      return "Ready to assign or transfer.";
    case "ASSIGNED":
      return "With an employee — record the return when it comes back.";
    case "IN_STORAGE":
    case "TRANSFERRED":
      return "In storage — make it available, assign it or transfer it.";
    case "UNDER_MAINTENANCE":
    case "FOR_REPAIR":
      return "Out of service — complete maintenance to release it.";
    case "DAMAGED":
      return "Send to maintenance or dispose.";
    case "LOST":
    case "STOLEN":
      return "Custody lost — close it out or reinstate if found.";
    case "RETIRED":
      return "Retired — dispose or reinstate.";
    case "DISPOSED":
      return "Disposed — history only.";
    default:
      return "";
  }
}
