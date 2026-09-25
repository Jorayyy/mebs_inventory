import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, UserSearch } from "lucide-react";
import { can, requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str } from "@/lib/query";
import { PageHeader, EmptyState, SectionCard } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  ClearanceEmployeeSearch,
  ClearancePanel,
} from "@/components/assignments/clearance-panel";
import { getClearanceCandidates, getClearanceChecklist } from "@/actions/clearance";

export const metadata: Metadata = { title: "Employee clearance" };

export default async function ClearancePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermissionPage("/my", 
    PERMISSIONS.ASSIGNMENTS_CLEARANCE,
    PERMISSIONS.ASSIGNMENTS_VIEW
  );
  const employeeId = str(searchParams, "employee");

  if (employeeId) {
    let checklist: Awaited<ReturnType<typeof getClearanceChecklist>> | null = null;
    try {
      checklist = await getClearanceChecklist(employeeId);
    } catch {
      checklist = null;
    }
    if (!checklist) notFound();

    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumb={
            <Link href="/assignments" className="inline-flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Assignments
            </Link>
          }
          title={`Clearance · ${checklist.employee.firstName} ${checklist.employee.lastName}`}
          description={`${checklist.employee.employeeNo} · ${checklist.employee.jobTitle ?? "Employee"} · ${checklist.employee.employmentStatus}`}
        />
        <ClearancePanel
          checklist={checklist}
          backHref="/assignments/clearance"
          canClear={can(user, PERMISSIONS.ASSIGNMENTS_CLEARANCE)}
        />
      </div>
    );
  }

  const candidates = await getClearanceCandidates();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/assignments" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Assignments
          </Link>
        }
        title="Employee clearance"
        description="Offboarding desk — close every asset assignment a departing employee still holds."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/assignments">
              <ShieldCheck /> All assignments
            </Link>
          </Button>
        }
      />

      <SectionCard title="Find an employee" description="Search by name, email or employee number.">
        <ClearanceEmployeeSearch />
      </SectionCard>

      <SectionCard
        title="Employees with open assets"
        description="Everyone who still has equipment checked out — pick one to start clearance."
      >
        {candidates.length === 0 ? (
          <EmptyState
            icon={<UserSearch className="h-8 w-8" />}
            title="Nothing to clear"
            description="No employee in your sites currently holds an open assignment."
          />
        ) : (
          <ul className="divide-y">
            {candidates.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/assignments/clearance?employee=${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-2.5 hover:bg-accent/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.jobTitle ?? "—"} · {row.departmentName} · {row.siteName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs">
                    {row.exitDate && (
                      <span className="text-amber-700 dark:text-amber-400">
                        Exit {new Date(row.exitDate).toLocaleDateString("en-PH")}
                      </span>
                    )}
                    <span className="rounded bg-muted px-2 py-1 font-medium tabular-nums">
                      {row.openAssignments} open
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
