"use server";

import { readFile, readdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requirePermission, getClientIp } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/permissions";

export type DiagnosticRow = { table: string; count: number | null };

export type DiagnosticsReport = {
  checkedAt: string;
  database: { connected: boolean; latencyMs: number | null; problem: string | null };
  rows: DiagnosticRow[];
  versions: { node: string; next: string; prisma: string; react: string };
  env: { key: string; present: boolean }[];
  errors: {
    windowHours: number;
    loginFailed: number;
    deletionAttempted: number;
    auditTotal: number;
    loginFailed7d: number;
    deletionAttempted7d: number;
    ratePct: number;
  };
  migrations: string[];
};

const ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

const COUNTED_TABLES = [
  { key: "users", label: "users" },
  { key: "employees", label: "employees" },
  { key: "sites", label: "sites" },
  { key: "assets", label: "assets" },
  { key: "assetAssignments", label: "asset_assignments" },
  { key: "inventoryItems", label: "inventory_items" },
  { key: "transfers", label: "transfers" },
  { key: "maintenanceRecords", label: "maintenance_records" },
  { key: "auditLogs", label: "audit_logs" },
] as const;

async function packageVersion(specifier: string): Promise<string> {
  try {
    const file = path.join(process.cwd(), "node_modules", ...specifier.split("/"), "package.json");
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function readMigrations(): Promise<string[]> {
  try {
    const dir = path.join(process.cwd(), "prisma", "migrations");
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .slice(-5);
  } catch {
    return [];
  }
}

async function countTable(model: string, label: string): Promise<DiagnosticRow> {
  try {
    const client = prisma as unknown as Record<string, { count: (args?: object) => Promise<number> }>;
    const count = await client[model]?.count();
    return { table: label, count: count ?? null };
  } catch {
    return { table: label, count: null };
  }
}

/** Runs every diagnostics check and records a DIAGNOSTIC_VIEWED audit entry. */
export async function runDiagnostics(): Promise<DiagnosticsReport> {
  const user = await requirePermission(PERMISSIONS.DIAGNOSTICS_VIEW);

  let connected = false;
  let latencyMs: number | null = null;
  let problem: string | null = null;
  try {
    const started = performance.now();
    await prisma.$queryRaw`SELECT 1`;
    latencyMs = Math.round(performance.now() - started);
    connected = true;
  } catch (error) {
    const code = (error as { code?: string }).code;
    problem = code ?? "Connection failed";
  }

  const counts = await Promise.all(
    COUNTED_TABLES.map((entry) => countTable(entry.key, entry.label))
  );

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [loginFailed, deletionAttempted, auditTotal, loginFailed7d, deletionAttempted7d] =
    await Promise.all([
      prisma.auditLog.count({ where: { action: "LOGIN_FAILED", createdAt: { gte: since24h } } }),
      prisma.auditLog.count({ where: { action: "DELETION_ATTEMPTED", createdAt: { gte: since24h } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: since24h } } }),
      prisma.auditLog.count({ where: { action: "LOGIN_FAILED", createdAt: { gte: since7d } } }),
      prisma.auditLog.count({ where: { action: "DELETION_ATTEMPTED", createdAt: { gte: since7d } } }),
    ]);

  const [node, next, prismaVersion, react] = await Promise.all([
    Promise.resolve(process.version),
    packageVersion("next"),
    packageVersion("@prisma/client"),
    packageVersion("react"),
  ]);

  const report: DiagnosticsReport = {
    checkedAt: new Date().toISOString(),
    database: { connected, latencyMs, problem },
    rows: counts,
    versions: { node, next, prisma: prismaVersion, react },
    env: ENV_KEYS.map((key) => ({ key, present: Boolean(process.env[key]) })),
    errors: {
      windowHours: 24,
      loginFailed,
      deletionAttempted,
      auditTotal,
      loginFailed7d,
      deletionAttempted7d,
      ratePct: auditTotal > 0 ? Math.round(((loginFailed + deletionAttempted) / auditTotal) * 100) : 0,
    },
    migrations: await readMigrations(),
  };

  await recordAudit({
    userId: user.id,
    action: "DIAGNOSTIC_VIEWED",
    entityType: "Diagnostics",
    entityId: null,
    description: `Ran diagnostics — database ${connected ? "ok" : "unreachable"}${latencyMs !== null ? ` (${latencyMs}ms)` : ""}`,
    newValue: { connected, latencyMs, tables: counts.length },
    ip: await getClientIp(),
  });

  return report;
}
