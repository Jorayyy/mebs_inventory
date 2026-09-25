import {
  ASSET_CONDITION,
  ASSET_STATUS,
  ASSIGNMENT_STATUS,
  MAINTENANCE_STATUS,
  STOCK_TX_LABELS,
  TRANSFER_STATUS,
  type Tone,
} from "@/lib/constants";
import { AUDIT_ACTION_BADGES } from "@/components/audit/audit-constants";
import type { BadgeKey } from "./types";

const STOCK_TX_BADGES: Record<string, { label: string; tone: Tone }> = Object.fromEntries(
  Object.entries(STOCK_TX_LABELS).map(([value, label]) => [value, { label, tone: "info" as Tone }])
);

const STOCK_LEVEL_BADGES: Record<string, { label: string; tone: Tone }> = {
  LOW: { label: "Reorder", tone: "danger" },
  OK: { label: "In stock", tone: "success" },
  OVERSTOCK: { label: "Overstock", tone: "warning" },
};

/** Badge maps keyed by `ReportColumn.badge`, resolved inside client components. */
export const BADGE_MAPS: Record<BadgeKey, Record<string, { label: string; tone: Tone }>> = {
  ASSET_STATUS,
  ASSET_CONDITION,
  ASSIGNMENT_STATUS,
  TRANSFER_STATUS,
  MAINTENANCE_STATUS,
  STOCK_TX: STOCK_TX_BADGES,
  STOCK_LEVEL: STOCK_LEVEL_BADGES,
  AUDIT_ACTION: AUDIT_ACTION_BADGES,
};
