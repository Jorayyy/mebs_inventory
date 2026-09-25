import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  buildQuery,
  num,
  orderByFrom,
  parseTableQuery,
  str,
} from "@/lib/query";

describe("parseTableQuery", () => {
  it("applies defaults", () => {
    expect(parseTableQuery(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      sort: "",
      dir: "asc",
      q: "",
    });
  });

  it("clamps page, pageSize and dir", () => {
    const parsed = parseTableQuery(new URLSearchParams("page=0&pageSize=1000&dir=up&q=laptop"));
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(200);
    expect(parsed.dir).toBe("asc");
    expect(parsed.q).toBe("laptop");

    expect(parseTableQuery(new URLSearchParams("page=-4&pageSize=2")).pageSize).toBe(5);
    expect(parseTableQuery(new URLSearchParams("page=abc")).page).toBe(1);
    expect(parseTableQuery(new URLSearchParams("dir=desc")).dir).toBe("desc");
  });

  it("accepts plain records with array values (Next searchParams)", () => {
    const parsed = parseTableQuery({ page: ["3"], sort: "name", dir: "desc" });
    expect(parsed.page).toBe(3);
    expect(parsed.sort).toBe("name");
    expect(parsed.dir).toBe("desc");
  });
});

describe("str / num", () => {
  const params = { q: "mouse", page: "2", empty: "", list: ["first", "second"] };

  it("reads single values", () => {
    expect(str(params, "q")).toBe("mouse");
    expect(str(params, "list")).toBe("first");
    expect(str(params, "empty")).toBeUndefined();
    expect(str(params, "missing")).toBeUndefined();
    expect(str(undefined, "q")).toBeUndefined();
  });

  it("falls back on missing or invalid numbers", () => {
    expect(num(params, "page", 1)).toBe(2);
    expect(num(params, "missing", 7)).toBe(7);
    expect(num({ page: "NaN" }, "page", 7)).toBe(7);
  });
});

describe("buildQuery", () => {
  it("merges patches and drops empty values", () => {
    const current = { q: "dell", page: "2", site: "s1" };
    expect(buildQuery(current, { page: "3" })).toBe("?q=dell&page=3&site=s1");
    expect(buildQuery(current, { q: "" })).toBe("?page=2&site=s1");
    expect(buildQuery(current, { site: undefined })).toBe("?q=dell&page=2");
    expect(buildQuery({}, { q: "x" })).toBe("?q=x");
    expect(buildQuery({ q: "dell" }, { q: "" })).toBe("");
  });
});

describe("orderByFrom", () => {
  const whitelist = { name: "name", createdAt: "createdAt", status: "status" };

  it("maps whitelisted columns", () => {
    expect(orderByFrom("name", "desc", whitelist, "createdAt")).toEqual({ name: "desc" });
    expect(orderByFrom("", "asc", whitelist, "createdAt")).toEqual({ createdAt: "asc" });
  });

  it("ignores unknown sort keys", () => {
    expect(orderByFrom("secret; drop table", "asc", whitelist, "createdAt")).toEqual({
      createdAt: "asc",
    });
  });
});
