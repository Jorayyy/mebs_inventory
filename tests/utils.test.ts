import { describe, expect, it } from "vitest";
import {
  cn,
  daysUntil,
  downloadFilename,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelative,
  initials,
  slugify,
  toCSV,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names and keeps the last tailwind winner", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", false && "text-blue-500", "font-bold")).toBe(
      "text-red-500 font-bold"
    );
  });
});

describe("formatters", () => {
  it("formats currency in PHP", () => {
    expect(formatCurrency(1234.5)).toContain("1,234.50");
    expect(formatCurrency(null)).toContain("0.00");
    expect(formatCurrency("not-a-number")).toContain("0.00");
  });

  it("formats numbers", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(12.3456, 2)).toBe("12.35");
  });

  it("renders an em dash for empty or invalid dates", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDate("2025-10-01")).toMatch(/2025/);
    expect(formatDate("2025-10-01T10:00:00", true)).toMatch(/2025/);
  });

  it("describes relative times", () => {
    expect(formatRelative(new Date(Date.now() - 10_000))).toContain("second");
    expect(formatRelative(new Date(Date.now() - 3 * 3_600_000))).toContain("hour");
    expect(formatRelative(null)).toBe("—");
  });

  it("counts days until a date", () => {
    expect(daysUntil(new Date(Date.now() + 18 * 3_600_000))).toBe(1);
    expect(daysUntil(new Date(Date.now() - 26 * 3_600_000))).toBe(-1);
    expect(daysUntil(null)).toBeNull();
  });
});

describe("slugify / initials", () => {
  it("slugifies titles", () => {
    expect(slugify("  Dell Latitude 7440! ")).toBe("dell-latitude-7440");
    expect(slugify("a///b")).toBe("a-b");
  });

  it("builds initials", () => {
    expect(initials("Juan Dela Cruz")).toBe("JD");
    expect(initials(null)).toBe("?");
  });
});

describe("toCSV", () => {
  it("prefixes a UTF-8 BOM for Excel", () => {
    expect(toCSV([["a"]]).charCodeAt(0)).toBe(0xfeff);
  });

  it("escapes commas, quotes and newlines", () => {
    const csv = toCSV([
      ["name", "note"],
      ['Doe, "Jane"', "line1\nline2"],
      [null, undefined],
    ]);
    const [, ...rows] = csv.split("\r\n");
    expect(rows[0]).toBe('"Doe, ""Jane""","line1\nline2"');
    expect(rows[1]).toBe(",");
  });

  it("generates a timestamped filename", () => {
    expect(downloadFilename("assets")).toMatch(/^assets-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.csv$/);
  });
});
