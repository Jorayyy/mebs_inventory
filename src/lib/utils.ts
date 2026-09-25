import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "PHP";

export function formatCurrency(value: number | string | null | undefined, currency = CURRENCY) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatNumber(value: number | string | null | undefined, digits = 0) {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: digits }).format(
    Number.isFinite(n) ? n : 0
  );
}

export function formatDate(value: Date | string | number | null | undefined, withTime = false) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
}

export function formatRelative(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return rtf.format(-Math.round(abs / 1000), "second");
  if (minutes < 60) return rtf.format(diff > 0 ? -minutes : minutes, "minute");
  const hours = Math.round(abs / 3_600_000);
  if (hours < 24) return rtf.format(diff > 0 ? -hours : hours, "hour");
  const days = Math.round(abs / 86_400_000);
  if (days < 30) return rtf.format(diff > 0 ? -days : days, "day");
  const months = Math.round(abs / 2_592_000_000);
  if (months < 12) return rtf.format(diff > 0 ? -months : months, "month");
  return rtf.format(diff > 0 ? -Math.round(abs / 31_536_000_000) : Math.round(abs / 31_536_000_000), "year");
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM so Excel opens UTF-8 correctly
  return "\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
}

export function downloadFilename(prefix: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${prefix}-${stamp}.csv`;
}

/** Days until a date (negative = past). */
export function daysUntil(date: Date | string | null | undefined) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}
