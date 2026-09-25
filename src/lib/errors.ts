import { ZodError } from "zod";
import { logger, newErrorId } from "@/lib/logger";

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      errorId: string;
      fieldErrors?: Record<string, string[]>;
      code?: string;
    };

/** Application-level error carrying a user-safe message and an internal error id. */
export class AppError extends Error {
  readonly userMessage: string;
  readonly errorId: string;
  readonly status: number;
  readonly code?: string;

  constructor(userMessage: string, options?: { status?: number; code?: string; cause?: unknown }) {
    super(userMessage, { cause: options?.cause });
    this.name = "AppError";
    this.userMessage = userMessage;
    this.errorId = newErrorId();
    this.status = options?.status ?? 400;
    this.code = options?.code;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

type ErrorContext = Record<string, unknown>;

/**
 * Central error handler for server actions / route handlers.
 * Logs the technical detail, returns only a user-safe payload.
 */
export function handleActionError(error: unknown, context?: ErrorContext): ActionResult<never> {
  const errorId = isAppError(error) ? error.errorId : newErrorId();

  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    logger.warn("action.validation_failed", { errorId, ...context, issues: error.issues.length });
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      errorId,
      fieldErrors,
      code: "VALIDATION",
    };
  }

  if (isAppError(error)) {
    logger.warn("action.app_error", {
      errorId,
      message: error.userMessage,
      code: error.code,
      status: error.status,
      ...context,
    });
    return { ok: false, error: error.userMessage, errorId, code: error.code };
  }

  const raw = error instanceof Error ? error : new Error(String(error));

  // Prisma known request errors → friendly messages
  const prismaCode = (raw as { code?: string }).code;
  if (prismaCode === "P2002") {
    logger.error("action.unique_constraint", { errorId, ...context, message: raw.message });
    return {
      ok: false,
      error: "That record conflicts with an existing entry (duplicate unique value).",
      errorId,
      code: "DUPLICATE",
    };
  }
  if (prismaCode === "P2025") {
    return { ok: false, error: "The requested record no longer exists.", errorId, code: "NOT_FOUND" };
  }
  if (prismaCode === "P2003") {
    return {
      ok: false,
      error: "This record is referenced by other data and cannot be changed.",
      errorId,
      code: "IN_USE",
    };
  }

  logger.error("action.unhandled", {
    errorId,
    message: raw.message,
    stack: raw.stack?.split("\n").slice(0, 6).join(" | "),
    ...context,
  });

  return {
    ok: false,
    error: "Something went wrong while saving your changes. Please try again.",
    errorId,
    code: "INTERNAL",
  };
}

/** Wraps a server action body with uniform error handling. */
export async function withAction<T>(
  fn: () => Promise<T>,
  context?: ErrorContext
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    return handleActionError(error, context);
  }
}
