import type { Tone } from "@/lib/constants";

export const NOTIFICATION_TYPES = [
  "LOW_STOCK",
  "PENDING_APPROVAL",
  "TRANSFER_UPDATE",
  "ASSIGNMENT_RETURN_DUE",
  "ASSIGNMENT_RETURNED",
  "WARRANTY_EXPIRING",
  "MAINTENANCE_UPDATE",
  "ASSET_DAMAGED",
  "ASSET_LOST",
  "RECEIVING_COMPLETED",
  "GENERAL",
] as const;

const TYPE_META: Record<(typeof NOTIFICATION_TYPES)[number], { label: string; tone: Tone }> = {
  LOW_STOCK: { label: "Low stock", tone: "danger" },
  PENDING_APPROVAL: { label: "Pending approval", tone: "warning" },
  TRANSFER_UPDATE: { label: "Transfer update", tone: "info" },
  ASSIGNMENT_RETURN_DUE: { label: "Return due", tone: "warning" },
  ASSIGNMENT_RETURNED: { label: "Return received", tone: "success" },
  WARRANTY_EXPIRING: { label: "Warranty expiring", tone: "warning" },
  MAINTENANCE_UPDATE: { label: "Maintenance update", tone: "info" },
  ASSET_DAMAGED: { label: "Asset damaged", tone: "danger" },
  ASSET_LOST: { label: "Asset lost", tone: "danger" },
  RECEIVING_COMPLETED: { label: "Receiving completed", tone: "success" },
  GENERAL: { label: "General", tone: "muted" },
};

export const NOTIFICATION_BADGES: Record<string, { label: string; tone: Tone }> = TYPE_META;

export const NOTIFICATION_TYPE_OPTIONS = NOTIFICATION_TYPES.map((type) => ({
  value: type,
  label: TYPE_META[type].label,
}));
