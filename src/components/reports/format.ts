import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type { ColumnKind, ReportRowValue } from "./types";

/** Renders a cell value as plain text — used by the CSV export and the table renderer. */
export function formatCellText(
  value: ReportRowValue,
  kind: ColumnKind | undefined,
  empty = "—"
): string {
  if (value === null || value === undefined || value === "") return empty;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  switch (kind) {
    case "currency":
      return formatCurrency(Number(value));
    case "number":
      return formatNumber(Number(value));
    case "percent":
      return `${formatNumber(Number(value), 1)}%`;
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDate(value, true);
    default:
      return value instanceof Date ? formatDate(value, true) : String(value);
  }
}
