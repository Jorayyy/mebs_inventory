"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Pencil, PauseCircle, PlayCircle, Users } from "lucide-react";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/page-header";
import {
  saveDepartment,
  setDepartmentActive,
  createTeam,
  setTeamActive,
  saveCostCenter,
} from "@/actions/org";
import type { ActionResult } from "@/lib/errors";
import type {
  OrgCostCenter,
  OrgDepartment,
  OrgSite,
} from "@/components/organization/organization-view";

type DeptValues = {
  id: string;
  siteId: string;
  code: string;
  name: string;
  description: string;
  costCenterId: string;
  isActive: boolean;
};

type TeamValues = { departmentId: string; code: string; name: string };

type CostValues = { id: string; code: string; name: string; budget: string; isActive: boolean };

const EMPTY_DEPT: DeptValues = {
  id: "",
  siteId: "",
  code: "",
  name: "",
  description: "",
  costCenterId: "",
  isActive: true,
};

const EMPTY_COST: CostValues = { id: "", code: "", name: "", budget: "", isActive: true };

const EMPTY_TEAM: TeamValues = { departmentId: "", code: "", name: "" };

export function StructurePanel({
  departments,
  costCenters,
  sites,
  canManage,
}: {
  departments: OrgDepartment[];
  costCenters: OrgCostCenter[];
  sites: OrgSite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [filterSite, setFilterSite] = React.useState("all");
  const [deptOpen, setDeptOpen] = React.useState(false);
  const [costOpen, setCostOpen] = React.useState(false);
  const [teamDept, setTeamDept] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [toggleError, setToggleError] = React.useState<string | null>(null);

  const deptForm = useFormAction<DeptValues, { id: string }>(saveDepartment, {
    successMessage: "Department saved",
    onSuccess: () => {
      setDeptOpen(false);
      deptForm.reset(EMPTY_DEPT);
      router.refresh();
    },
  });

  const teamForm = useFormAction<TeamValues, { id: string }>(createTeam, {
    successMessage: "Team created",
    onSuccess: () => {
      setTeamDept(null);
      teamForm.reset(EMPTY_TEAM);
      router.refresh();
    },
  });

  const costForm = useFormAction<CostValues, { id: string }>(saveCostCenter, {
    successMessage: "Cost centre saved",
    onSuccess: () => {
      setCostOpen(false);
      costForm.reset(EMPTY_COST);
      router.refresh();
    },
  });

  const errDept = (name: keyof DeptValues) =>
    deptForm.formState.errors[name]?.message as string | undefined;
  const errTeam = (name: keyof TeamValues) =>
    teamForm.formState.errors[name]?.message as string | undefined;
  const errCost = (name: keyof CostValues) =>
    costForm.formState.errors[name]?.message as string | undefined;

  const visible = departments.filter((d) => filterSite === "all" || d.siteId === filterSite);

  async function run<T>(
    action: (input: Record<string, unknown>) => Promise<ActionResult<T>>
  ) {
    setPending("busy");
    setToggleError(null);
    try {
      const result = await action({});
      if (!result.ok) setToggleError(result.error);
      else router.refresh();
    } catch {
      setToggleError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Departments &amp; teams</CardTitle>
              <CardDescription>Departments own teams; employees belong to both.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-[180px]">
                <Select value={filterSite} onValueChange={setFilterSite}>
                  <SelectTrigger aria-label="Filter by site">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sites</SelectItem>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canManage &&
                (deptOpen ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDeptOpen(false);
                      deptForm.reset(EMPTY_DEPT);
                    }}
                  >
                    <X /> Cancel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      deptForm.reset({
                        ...EMPTY_DEPT,
                        siteId: filterSite === "all" ? "" : filterSite,
                      });
                      setDeptOpen(true);
                    }}
                  >
                    <Plus /> Department
                  </Button>
                ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormError error={toggleError} />

          {canManage && deptOpen && (
            <form
              onSubmit={deptForm.submit}
              className="space-y-3 rounded-md border bg-muted/30 p-4"
              noValidate
            >
              <FormError error={deptForm.serverError} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Site" htmlFor="dept-site" required error={errDept("siteId")}>
                  <Select
                    value={deptForm.watch("siteId") || undefined}
                    onValueChange={(value) =>
                      deptForm.setValue("siteId", value, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="dept-site">
                      <SelectValue placeholder="Select site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Department code" htmlFor="dept-code" required error={errDept("code")}>
                  <Input id="dept-code" className="font-mono" {...deptForm.register("code")} />
                </Field>
                <Field label="Department name" htmlFor="dept-name" required error={errDept("name")}>
                  <Input id="dept-name" {...deptForm.register("name")} />
                </Field>
                <Field label="Cost centre" htmlFor="dept-cost" error={errDept("costCenterId")}>
                  <Select
                    value={deptForm.watch("costCenterId") || undefined}
                    onValueChange={(value) =>
                      deptForm.setValue("costCenterId", value, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="dept-cost">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map((cost) => (
                        <SelectItem key={cost.id} value={cost.id}>
                          {cost.code} · {cost.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Description"
                  htmlFor="dept-description"
                  error={errDept("description")}
                  className="sm:col-span-2"
                >
                  <Input id="dept-description" {...deptForm.register("description")} />
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={deptForm.watch("isActive")}
                    onChange={(event) => deptForm.setValue("isActive", event.target.checked)}
                  />
                  Active
                </label>
                <Button type="submit" size="sm" disabled={deptForm.submitting}>
                  {deptForm.submitting ? "Saving…" : deptForm.watch("id") ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          )}

          {canManage && teamDept && (
            <form
              onSubmit={teamForm.submit}
              className="space-y-3 rounded-md border bg-muted/30 p-4"
              noValidate
            >
              <FormError error={teamForm.serverError} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <Field label="Team code" htmlFor="team-code" required error={errTeam("code")}>
                  <Input id="team-code" className="font-mono" {...teamForm.register("code")} />
                </Field>
                <Field label="Team name" htmlFor="team-name" required error={errTeam("name")}>
                  <Input id="team-name" {...teamForm.register("name")} />
                </Field>
                <div className="flex items-end gap-2">
                  <Button type="submit" size="sm" disabled={teamForm.submitting}>
                    {teamForm.submitting ? "Saving…" : "Add team"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setTeamDept(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          )}

          {visible.length === 0 ? (
            <EmptyState
              title="No departments"
              description="Create a department to organise teams and employees."
            />
          ) : (
            <div className="space-y-3">
              {visible.map((department) => (
                <div key={department.id} className="rounded-md border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{department.name}</span>
                      <Badge variant="outline" className="font-mono">
                        {department.code}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{department.siteName}</span>
                      {department.costCenter && (
                        <span className="text-xs text-muted-foreground">
                          · {department.costCenter.code}
                        </span>
                      )}
                      <Badge variant={department.isActive ? "success" : "muted"}>
                        {department.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Add team"
                          onClick={() => {
                            teamForm.reset({ ...EMPTY_TEAM, departmentId: department.id });
                            setTeamDept(department.id);
                          }}
                        >
                          <Plus />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Edit department"
                          onClick={() => {
                            deptForm.reset({
                              id: department.id,
                              siteId: department.siteId,
                              code: department.code,
                              name: department.name,
                              description: department.description ?? "",
                              costCenterId: "",
                              isActive: department.isActive,
                            });
                            setDeptOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={department.isActive ? "Deactivate" : "Activate"}
                          disabled={pending !== null}
                          onClick={() =>
                            run(() =>
                              setDepartmentActive({
                                id: department.id,
                                isActive: !department.isActive,
                              })
                            )
                          }
                        >
                          {department.isActive ? <PauseCircle /> : <PlayCircle />}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    {department.teams.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No teams yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {department.teams.map((team) => (
                          <span
                            key={team.id}
                            className="inline-flex items-center gap-1.5 rounded border bg-muted px-2 py-1 text-xs"
                          >
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{team.name}</span>
                            <span className="font-mono text-muted-foreground">{team.code}</span>
                            {canManage && (
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive"
                                aria-label={team.isActive ? "Deactivate team" : "Activate team"}
                                disabled={pending !== null}
                                onClick={() =>
                                  run(() =>
                                    setTeamActive({ id: team.id, isActive: !team.isActive })
                                  )
                                }
                              >
                                {team.isActive ? <PauseCircle className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Cost centres</CardTitle>
              <CardDescription>Used for departmental budgeting and reporting.</CardDescription>
            </div>
            {canManage &&
              (costOpen ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCostOpen(false);
                    costForm.reset(EMPTY_COST);
                  }}
                >
                  <X /> Cancel
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    costForm.reset(EMPTY_COST);
                    setCostOpen(true);
                  }}
                >
                  <Plus /> Cost centre
                </Button>
              ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && costOpen && (
            <form
              onSubmit={costForm.submit}
              className="space-y-3 rounded-md border bg-muted/30 p-4"
              noValidate
            >
              <FormError error={costForm.serverError} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Code" htmlFor="cost-code" required error={errCost("code")}>
                  <Input id="cost-code" className="font-mono" {...costForm.register("code")} />
                </Field>
                <Field label="Name" htmlFor="cost-name" required error={errCost("name")}>
                  <Input id="cost-name" {...costForm.register("name")} />
                </Field>
                <Field label="Budget" htmlFor="cost-budget" error={errCost("budget")}>
                  <Input id="cost-budget" type="number" min={0} {...costForm.register("budget")} />
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={costForm.watch("isActive")}
                    onChange={(event) => costForm.setValue("isActive", event.target.checked)}
                  />
                  Active
                </label>
                <Button type="submit" size="sm" disabled={costForm.submitting}>
                  {costForm.submitting ? "Saving…" : costForm.watch("id") ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          )}

          {costCenters.length === 0 ? (
            <EmptyState title="No cost centres" description="Create one to attach to departments." />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Budget</th>
                    <th className="px-3 py-2 font-medium">Depts</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    {canManage && <th className="px-3 py-2 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {costCenters.map((cost) => (
                    <tr key={cost.id}>
                      <td className="px-3 py-2 font-mono text-xs">{cost.code}</td>
                      <td className="px-3 py-2">{cost.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {cost.budget === null ? "—" : cost.budget.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{cost.departmentCount}</td>
                      <td className="px-3 py-2">
                        <Badge variant={cost.isActive ? "success" : "muted"}>
                          {cost.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-3 py-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${cost.name}`}
                            onClick={() => {
                              costForm.reset({
                                id: cost.id,
                                code: cost.code,
                                name: cost.name,
                                budget: cost.budget === null ? "" : String(cost.budget),
                                isActive: cost.isActive,
                              });
                              setCostOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
