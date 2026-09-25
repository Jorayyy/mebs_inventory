import type { PermissionKey } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import type { ReportParams } from "@/lib/validations/report";

export type ColumnKind =
  | "text"
  | "mono"
  | "currency"
  | "number"
  | "percent"
  | "date"
  | "datetime"
  | "badge";

export type BadgeKey =
  | "ASSET_STATUS"
  | "ASSET_CONDITION"
  | "ASSIGNMENT_STATUS"
  | "TRANSFER_STATUS"
  | "MAINTENANCE_STATUS"
  | "STOCK_TX"
  | "STOCK_LEVEL"
  | "AUDIT_ACTION";

export type ReportColumn = {
  key: string;
  header: string;
  kind?: ColumnKind;
  badge?: BadgeKey;
  align?: "left" | "right";
  sortable?: boolean;
};

export type ReportRowValue = string | number | boolean | Date | null | undefined;

export type ReportRow = Record<string, ReportRowValue>;

export type ReportSummaryMetric = { label: string; value: string; hint?: string };

export type ReportScope = {
  user: SessionUser;
  /** Site ids the user may see — `null` means every site. */
  siteIds: string[] | null;
  /** Site requested through the filter (already validated against `siteIds`). */
  siteId: string | null;
};

export type ReportRunResult = {
  rows: ReportRow[];
  total: number;
  summary: ReportSummaryMetric[];
};

export type ReportParamKey = "site" | "from" | "to" | "q" | "status" | "categoryId" | "days";

export type StatusOptionsKey =
  | "ASSET_STATUS"
  | "ASSIGNMENT_STATUS"
  | "TRANSFER_STATUS"
  | "MAINTENANCE_STATUS"
  | "STOCK_TX";

export type ReportParamDef = {
  key: ReportParamKey;
  label: string;
  type: "site" | "date" | "text" | "status" | "category" | "number";
  optionsKey?: StatusOptionsKey;
};

export type ReportDefinition = {
  slug: string;
  title: string;
  description: string;
  permission: PermissionKey;
  params: ReportParamDef[];
  columns: ReportColumn[];
  /** Row-level reports page/sort on the server; grouped reports sort in the browser. */
  serverPaging: boolean;
  run: (params: ReportParams, scope: ReportScope) => Promise<ReportRunResult>;
};
