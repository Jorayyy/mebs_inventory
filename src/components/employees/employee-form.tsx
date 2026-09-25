"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createEmployee } from "@/actions/employees";

type Values = {
  siteId: string;
  departmentId: string;
  teamId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  hireDate: string;
  employmentStatus: string;
  notes: string;
};

export type EmployeeFormOptions = {
  sites: { id: string; name: string; code: string }[];
  departments: { id: string; name: string; siteId: string }[];
  teams: { id: string; name: string; departmentId: string }[];
};

const DEFAULTS: Values = {
  siteId: "",
  departmentId: "",
  teamId: "",
  employeeNo: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  jobTitle: "",
  hireDate: "",
  employmentStatus: "ACTIVE",
  notes: "",
};

export function EmployeeForm({ options }: { options: EmployeeFormOptions }) {
  const router = useRouter();
  const [siteId, setSiteId] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");

  const {
    register,
    setValue,
    formState,
    submit,
    submitting,
    serverError,
  } = useFormAction<Values, { id: string }>(
    async (values) => createEmployee({ ...values, teamId: values.teamId === "NONE" ? "" : values.teamId }),
    {
      successMessage: "Employee created",
      onSuccess: (employee) => {
        router.push(`/employees/${employee.id}`);
        router.refresh();
      },
    }
  );

  const departments = options.departments.filter((d) => !siteId || d.siteId === siteId);
  const teams = options.teams.filter((t) => !departmentId || t.departmentId === departmentId);
  const err = (name: keyof Values) => formState.errors[name]?.message as string | undefined;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError error={serverError} />

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>
            Employee number is unique per company — use your HR/payroll reference.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee number" htmlFor="employeeNo" required error={err("employeeNo")}>
            <Input id="employeeNo" placeholder="e.g. EMP-00042" className="font-mono" {...register("employeeNo")} />
          </Field>
          <Field label="First name" htmlFor="firstName" required error={err("firstName")}>
            <Input id="firstName" autoComplete="given-name" {...register("firstName")} />
          </Field>
          <Field label="Last name" htmlFor="lastName" required error={err("lastName")}>
            <Input id="lastName" autoComplete="family-name" {...register("lastName")} />
          </Field>
          <Field label="Work email" htmlFor="email" error={err("email")}>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={err("phone")}>
            <Input id="phone" autoComplete="tel" {...register("phone")} />
          </Field>
          <Field label="Job title" htmlFor="jobTitle" error={err("jobTitle")}>
            <Input id="jobTitle" placeholder="e.g. Claims Processor" {...register("jobTitle")} />
          </Field>
          <Field label="Hire date" htmlFor="hireDate" error={err("hireDate")}>
            <Input id="hireDate" type="date" {...register("hireDate")} />
          </Field>
          <Field label="Employment status" htmlFor="employmentStatus" error={err("employmentStatus")}>
            <Select
              defaultValue="ACTIVE"
              onValueChange={(value) => setValue("employmentStatus", value)}
            >
              <SelectTrigger id="employmentStatus">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="ON_LEAVE">On leave</SelectItem>
                <SelectItem value="ENDING">Ending</SelectItem>
                <SelectItem value="EXITED">Exited</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Placement</CardTitle>
          <CardDescription>Site, department and team drive scoping and reporting.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Site" htmlFor="siteId" required error={err("siteId")}>
            <Select
              value={siteId}
              onValueChange={(value) => {
                setSiteId(value);
                setDepartmentId("");
                setValue("siteId", value, { shouldValidate: true });
                setValue("departmentId", "");
                setValue("teamId", "");
              }}
            >
              <SelectTrigger id="siteId">
                <SelectValue placeholder="Select site" />
              </SelectTrigger>
              <SelectContent>
                {options.sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name} ({site.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Department" htmlFor="departmentId" required error={err("departmentId")}>
            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value);
                setValue("departmentId", value, { shouldValidate: true });
                setValue("teamId", "");
              }}
            >
              <SelectTrigger id="departmentId">
                <SelectValue placeholder={siteId ? "Select department" : "Select a site first"} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Team" htmlFor="teamId" error={err("teamId")}>
            <Select value={undefined} onValueChange={(value) => setValue("teamId", value)}>
              <SelectTrigger id="teamId">
                <SelectValue placeholder="Optional team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No team</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Notes"
            htmlFor="notes"
            error={err("notes")}
            className="sm:col-span-2 lg:col-span-3"
          >
            <Textarea id="notes" rows={3} placeholder="Cost centre, shift, clearance notes…" {...register("notes")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Create employee"}
        </Button>
      </div>
    </form>
  );
}
