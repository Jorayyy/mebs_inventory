/* Structured JSON logging. Vercel captures stdout/stderr per invocation. */

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, event: string, context?: Record<string, unknown>) {
  const entry = {
    level,
    event,
    time: new Date().toISOString(),
    env: process.env.NODE_ENV,
    ...context,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, context?: Record<string, unknown>) =>
    process.env.NODE_ENV === "development" && emit("debug", event, context),
  info: (event: string, context?: Record<string, unknown>) => emit("info", event, context),
  warn: (event: string, context?: Record<string, unknown>) => emit("warn", event, context),
  error: (event: string, context?: Record<string, unknown>) => emit("error", event, context),
};

/** Generates a short, human-quotable error id (e.g. `err_9f3a1c`) shown to end users. */
export function newErrorId(): string {
  return `err_${Math.random().toString(36).slice(2, 8)}`;
}

export function newRequestId(): string {
  return `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
