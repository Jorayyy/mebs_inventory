import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs text-muted-foreground">{breadcrumb}</div>}
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 text-muted-foreground/60">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  href,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  href?: string;
  className?: string;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "danger"
          ? "text-red-600 dark:text-red-400"
          : tone === "info"
            ? "text-sky-600 dark:text-sky-400"
            : "text-foreground";

  const body = (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border bg-card p-3.5 shadow-sm transition-colors",
        href && "hover:border-primary/50 hover:bg-accent/40",
        className
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-1 truncate text-xl font-semibold tabular-nums", toneClass)}>{value}</p>
        {hint && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {icon && <div className="mt-0.5 shrink-0 text-muted-foreground/70">{icon}</div>}
    </div>
  );

  return href ? <a href={href}>{body}</a> : body;
}

export function DetailGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</dl>;
}

export function DetailItem({
  label,
  children,
  className,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("min-w-0 border-b border-border/60 pb-2", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-sm", mono && "font-mono text-[13px]")}>
        {children ?? "—"}
      </dd>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
