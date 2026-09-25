export type SortDirection = "asc" | "desc";

export type TableQuery = {
  page: number;
  pageSize: number;
  sort: string;
  dir: SortDirection;
  q: string;
};

export type ParsedSearchParams = Record<string, string>;

export const DEFAULT_PAGE_SIZE = 25;

export function parseTableQuery(params: URLSearchParams | Record<string, string | string[] | undefined>): TableQuery {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = Math.max(1, parseInt(get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(200, Math.max(5, parseInt(get("pageSize") ?? `${DEFAULT_PAGE_SIZE}`, 10) || DEFAULT_PAGE_SIZE));
  const dir: SortDirection = get("dir") === "desc" ? "desc" : "asc";

  return { page, pageSize, sort: get("sort") ?? "", dir, q: get("q") ?? "" };
}

/** Reads a single string filter from Next's searchParams. */
export function str(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string
): string | undefined {
  if (!params) return undefined;
  const value = params[key];
  const resolved = Array.isArray(value) ? value[0] : value;
  return resolved && resolved.length > 0 ? resolved : undefined;
}

export function num(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
  fallback: number
): number {
  const raw = str(params, key);
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildQuery(current: Record<string, string | string[] | undefined>, patch: Record<string, string | undefined>) {
  const next = new URLSearchParams();
  const merged: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(current)) {
    merged[key] = Array.isArray(value) ? value[0] : value;
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") delete merged[key];
    else merged[key] = value;
  }
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== "") next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

/** Stable `order by` for Prisma from a whitelist — never interpolate user input. */
export function orderByFrom<T extends Record<string, unknown>>(
  sort: string,
  dir: SortDirection,
  whitelist: T,
  fallback: keyof T
): Record<string, "asc" | "desc"> {
  const key = (sort || String(fallback)) as keyof T;
  const column = whitelist[key] ?? whitelist[fallback];
  return { [String(column)]: dir };
}
