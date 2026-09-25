import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { getFormOptions } from "@/actions/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeForm } from "@/components/employees/employee-form";

export const metadata: Metadata = { title: "New employee" };

export default async function NewEmployeePage() {
  await requirePermissionPage("/my", PERMISSIONS.EMPLOYEES_MANAGE);
  const options = await getFormOptions();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={
          <Link href="/employees" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Employees
          </Link>
        }
        title="Add employee"
        description="Identity, placement and employment status for a new headcount record."
      />
      <EmployeeForm
        options={{
          sites: options.sites,
          departments: options.departments,
          teams: options.teams,
        }}
      />
    </div>
  );
}
