import type { Tone } from "@/lib/constants";

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGOUT",
  "LOGIN_FAILED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_STATUS_CHANGED",
  "ROLE_CHANGED",
  "PERMISSION_CHANGED",
  "ASSET_CREATED",
  "ASSET_UPDATED",
  "ASSET_DELETED",
  "ASSET_STATUS_CHANGED",
  "ASSIGNMENT_CREATED",
  "ASSIGNMENT_RETURNED",
  "ASSIGNMENT_ACKNOWLEDGED",
  "STOCK_RECEIVED",
  "STOCK_ISSUED",
  "STOCK_CONSUMED",
  "STOCK_ADJUSTED",
  "TRANSFER_CREATED",
  "TRANSFER_APPROVED",
  "TRANSFER_REJECTED",
  "TRANSFER_SHIPPED",
  "TRANSFER_RECEIVED",
  "TRANSFER_COMPLETED",
  "MAINTENANCE_CREATED",
  "MAINTENANCE_UPDATED",
  "DISPOSAL_CREATED",
  "SUPPLIER_CREATED",
  "SUPPLIER_UPDATED",
  "PURCHASE_ORDER_CREATED",
  "ORG_UPDATED",
  "CATEGORY_UPDATED",
  "EXPORT_GENERATED",
  "DELETION_ATTEMPTED",
  "UNAUTHORIZED_ACCESS",
  "SETTINGS_UPDATED",
  "DIAGNOSTIC_VIEWED",
] as const;

const ACTION_TONE: Record<string, Tone> = {
  LOGIN: "info",
  LOGOUT: "muted",
  LOGIN_FAILED: "danger",
  USER_CREATED: "success",
  USER_UPDATED: "info",
  USER_STATUS_CHANGED: "warning",
  ROLE_CHANGED: "warning",
  PERMISSION_CHANGED: "warning",
  ASSET_CREATED: "success",
  ASSET_UPDATED: "info",
  ASSET_DELETED: "danger",
  ASSET_STATUS_CHANGED: "warning",
  ASSIGNMENT_CREATED: "info",
  ASSIGNMENT_RETURNED: "success",
  ASSIGNMENT_ACKNOWLEDGED: "success",
  STOCK_RECEIVED: "success",
  STOCK_ISSUED: "info",
  STOCK_CONSUMED: "info",
  STOCK_ADJUSTED: "warning",
  TRANSFER_CREATED: "info",
  TRANSFER_APPROVED: "success",
  TRANSFER_REJECTED: "danger",
  TRANSFER_SHIPPED: "purple",
  TRANSFER_RECEIVED: "info",
  TRANSFER_COMPLETED: "success",
  MAINTENANCE_CREATED: "warning",
  MAINTENANCE_UPDATED: "info",
  DISPOSAL_CREATED: "muted",
  SUPPLIER_CREATED: "success",
  SUPPLIER_UPDATED: "info",
  PURCHASE_ORDER_CREATED: "info",
  ORG_UPDATED: "info",
  CATEGORY_UPDATED: "info",
  EXPORT_GENERATED: "cyan",
  DELETION_ATTEMPTED: "danger",
  UNAUTHORIZED_ACCESS: "danger",
  SETTINGS_UPDATED: "info",
  DIAGNOSTIC_VIEWED: "muted",
};

export function auditActionLabel(action: string): string {
  return action
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const AUDIT_ACTION_BADGES: Record<string, { label: string; tone: Tone }> =
  Object.fromEntries(
    AUDIT_ACTIONS.map((action) => [action, { label: auditActionLabel(action), tone: ACTION_TONE[action] ?? "muted" }])
  );

export const AUDIT_ACTION_OPTIONS = AUDIT_ACTIONS.map((action) => ({
  value: action,
  label: auditActionLabel(action),
}));
