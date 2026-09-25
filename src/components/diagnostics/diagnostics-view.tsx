"use client";

import * as React from "react";
import { Activity, Database, RefreshCw, ShieldAlert, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard, EmptyState } from "@/components/shared/page-header";
import { FormError } from "@/components/ui/form";
import { runDiagnostics, type DiagnosticsReport } from "@/actions/diagnostics";

function formatCheckedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function DiagnosticsView({ initial }: { initial: DiagnosticsReport }) {
  const [report, setReport] = React.useState<DiagnosticsReport>(initial);
  const [running, setRunning] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function rerun() {
    setRunning(true);
    setError(null);
    try {
      const next = await runDiagnostics();
      setReport(next);
    } catch {
      setError("Diagnostics could not be run. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  const criticalEnvMissing = report.env.filter(
    (entry) => !entry.present && (entry.key === "DATABASE_URL" || entry.key === "AUTH_SECRET")
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Last checked {formatCheckedAt(report.checkedAt)} — every run is written to the audit trail.
        </p>
        <Button size="sm" variant="outline" onClick={rerun} disabled={running}>
          <RefreshCw className={running ? "animate-spin" : undefined} />
          {running ? "Running checks…" : "Run checks again"}
        </Button>
      </div>

      <FormError error={error} />

      {criticalEnvMissing.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Missing environment variable{criticalEnvMissing.length > 1 ? "s" : ""}:{" "}
            <span className="font-mono">{criticalEnvMissing.map((entry) => entry.key).join(", ")}</span>
            . The app cannot authenticate or reach the database without them — see .env.example.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Database"
          value={report.database.connected ? "Connected" : "Unreachable"}
          hint={
            report.database.connected
              ? `${report.database.latencyMs ?? "—"}ms round trip`
              : report.database.problem ?? "Check DATABASE_URL"
          }
          tone={report.database.connected ? "success" : "danger"}
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          label="Audit events (24h)"
          value={report.errors.auditTotal.toLocaleString()}
          hint={`${report.errors.loginFailed} failed sign-in · ${report.errors.deletionAttempted} deletion attempts`}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Failed sign-ins (7d)"
          value={report.errors.loginFailed7d.toLocaleString()}
          hint={`${report.errors.deletionAttempted7d} deletion attempts in the same window`}
          tone={report.errors.loginFailed7d > 20 ? "warning" : "default"}
        />
        <StatCard
          label="Error share of audit"
          value={`${report.errors.ratePct}%`}
          hint={`Failures ÷ audit events over ${report.errors.windowHours}h`}
          tone={report.errors.ratePct > 50 ? "warning" : "default"}
          icon={<Terminal className="h-4 w-4" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Presence only — values are never displayed or logged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.env.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <span className="font-mono text-xs">{entry.key}</span>
                <Badge variant={entry.present ? "success" : "danger"}>
                  {entry.present ? "Set" : "Missing"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runtime versions</CardTitle>
            <CardDescription>Detected from the installed packages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(report.versions).map(([name, version]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
              >
                <span className="text-xs capitalize">{name}</span>
                <span className="font-mono text-xs text-muted-foreground">{version}</span>
              </div>
            ))}
            <div className="rounded-md border px-3 py-2">
              <p className="mb-1.5 text-xs font-medium">Applied migrations</p>
              {report.migrations.length === 0 ? (
                <p className="text-xs text-muted-foreground">None found in prisma/migrations.</p>
              ) : (
                <ul className="space-y-1">
                  {report.migrations.map((migration) => (
                    <li key={migration} className="font-mono text-[11px] text-muted-foreground">
                      {migration}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Row counts</CardTitle>
          <CardDescription>Quick sanity check that data is flowing into every table.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.rows.every((row) => row.count === null) ? (
            <EmptyState
              title="No tables could be counted"
              description="The database did not answer any count queries."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {report.rows.map((row) => (
                <div key={row.table} className="rounded-md border p-3">
                  <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                    {row.table}
                  </p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {row.count === null ? "—" : row.count.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
