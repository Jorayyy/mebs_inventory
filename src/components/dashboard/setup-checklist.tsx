import Link from "next/link";
import { ArrowRight, Rocket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export type SetupCounts = {
  sites: number;
  departments: number;
  categories: number;
  employees: number;
  assets: number;
  assignments: number;
};

export type SetupPermissions = {
  org: boolean;
  catalog: boolean;
  employee: boolean;
  asset: boolean;
  assign: boolean;
};

type Step = {
  title: string;
  hint: string;
  href: string;
  done: boolean;
};

/**
 * First-run checklist on the dashboard: the ordered path from an empty
 * database to a first assignment, hidden once everything exists.
 */
export function SetupChecklist({
  counts,
  can,
}: {
  counts: SetupCounts;
  can: SetupPermissions;
}) {
  const steps: Step[] = [
    {
      title: "Add a site",
      hint: "Your operating location — everything else hangs off it.",
      href: "/settings/organization/sites",
      done: counts.sites > 0,
    },
    {
      title: "Add an asset category",
      hint: "Decides tag prefixes and how items are tracked.",
      href: "/settings/organization/catalog",
      done: counts.categories > 0,
    },
    {
      title: "Add a department",
      hint: "Where your people sit — required before adding employees.",
      href: "/settings/organization/departments",
      done: counts.departments > 0,
    },
    {
      title: "Add an employee",
      hint: "The person who will hold the equipment.",
      href: "/employees/new",
      done: counts.employees > 0,
    },
    {
      title: "Register an asset",
      hint: "Name, category and site are the only required fields.",
      href: "/assets/new",
      done: counts.assets > 0,
    },
    {
      title: "Assign it to someone",
      hint: "Hand custody over and start tracking returns.",
      href: "/assets?assign=1",
      done: counts.assignments > 0,
    },
  ];

  const visible = steps.filter((_, index) => {
    if (index === 1) return can.catalog;
    if (index === 0 || index === 2) return can.org;
    if (index === 3) return can.employee;
    if (index === 4) return can.asset;
    return can.assign;
  });
  const remaining = visible.filter((step) => !step.done);
  const doneCount = visible.length - remaining.length;

  if (remaining.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" /> Set up your inventory
        </CardTitle>
        <CardDescription>
          {doneCount} of {visible.length} steps done — {remaining.length} to go until your first
          assignment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-1">
          {remaining.map((step, index) => (
            <li key={step.title}>
              <Link
                href={step.href}
                className="group flex items-center gap-3 rounded-md border border-transparent px-2 py-2.5 transition-colors hover:border-border hover:bg-accent/40"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted/50 text-xs font-medium tabular-nums text-muted-foreground">
                  {doneCount + index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{step.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{step.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
