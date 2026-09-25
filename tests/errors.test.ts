import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError, handleActionError, withAction } from "@/lib/errors";

describe("AppError", () => {
  it("carries a user-safe message, status and generated error id", () => {
    const error = new AppError("Nope.", { status: 403, code: "FORBIDDEN" });
    expect(error.userMessage).toBe("Nope.");
    expect(error.status).toBe(403);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.errorId).toMatch(/^err_/);
    expect(error instanceof Error).toBe(true);
  });

  it("defaults to a 400 status", () => {
    expect(new AppError("bad").status).toBe(400);
  });
});

describe("handleActionError", () => {
  it("passes AppError messages through with their code", () => {
    const result = handleActionError(new AppError("Already registered.", { code: "DUPLICATE" }));
    expect(result).toMatchObject({ ok: false, error: "Already registered.", code: "DUPLICATE" });
    if (!result.ok) expect(result.errorId).toMatch(/^err_/);
  });

  it("flattens Zod issues into fieldErrors", () => {
    const schema = z.object({ name: z.string().min(3), qty: z.number() });
    const parsed = schema.safeParse({ name: "ab", qty: "x" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const result = handleActionError(parsed.error);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    if (result.ok) return;
    expect(result.fieldErrors?.name?.[0]).toBeTruthy();
    expect(result.fieldErrors?.qty?.[0]).toBeTruthy();
  });

  it("maps Prisma error codes to friendly messages", () => {
    const unique = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    expect(handleActionError(unique)).toMatchObject({ ok: false, code: "DUPLICATE" });

    const missing = Object.assign(new Error("Record not found"), { code: "P2025" });
    expect(handleActionError(missing)).toMatchObject({ ok: false, code: "NOT_FOUND" });

    const referenced = Object.assign(new Error("FK violation"), { code: "P2003" });
    expect(handleActionError(referenced)).toMatchObject({ ok: false, code: "IN_USE" });
  });

  it("hides unexpected errors behind a generic message", () => {
    const result = handleActionError(new Error("connection string leaked"));
    expect(result).toMatchObject({ ok: false, code: "INTERNAL" });
    if (result.ok) return;
    expect(result.error).not.toContain("connection string");
    expect(result.errorId).toMatch(/^err_/);
  });
});

describe("withAction", () => {
  it("wraps a successful action", async () => {
    await expect(withAction(async () => 42)).resolves.toEqual({ ok: true, data: 42 });
  });

  it("converts thrown errors into an ActionResult", async () => {
    const result = await withAction(() => Promise.reject(new AppError("Denied.")), {
      action: "test",
    });
    expect(result).toMatchObject({ ok: false, error: "Denied." });
  });

  it("does not throw for non-Error values", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await withAction(() => Promise.reject("boom"));
    expect(result.ok).toBe(false);
    spy.mockRestore();
  });
});
