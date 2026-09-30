"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Building2, Layers, DoorOpen } from "lucide-react";
import { useFormAction, Field, FormError } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/page-header";
import { createBuilding, createFloor, createRoom } from "@/actions/org";
import type { OrgBuilding, OrgSite } from "@/lib/organization-types";

type Mode = "building" | "floor" | "room";

type BuildingValues = { code: string; name: string };
type FloorValues = { buildingId: string; code: string; name: string; level: string };
type RoomValues = { floorId: string; code: string; name: string; capacity: string };

const MODES: { value: Mode; label: string; icon: React.ReactNode }[] = [
  { value: "building", label: "Building", icon: <Building2 className="h-3.5 w-3.5" /> },
  { value: "floor", label: "Floor", icon: <Layers className="h-3.5 w-3.5" /> },
  { value: "room", label: "Room", icon: <DoorOpen className="h-3.5 w-3.5" /> },
];

export function FacilitiesPanel({
  sites,
  buildings,
  canManage,
}: {
  sites: OrgSite[];
  buildings: OrgBuilding[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [siteId, setSiteId] = React.useState(sites[0]?.id ?? "");
  const [mode, setMode] = React.useState<Mode>("building");
  const [open, setOpen] = React.useState(false);

  const buildingForm = useFormAction<BuildingValues, { id: string }>(
    createBuilding,
    {
      successMessage: "Building created",
      extra: () => ({ siteId }),
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    }
  );

  const floorForm = useFormAction<FloorValues, { id: string }>(createFloor, {
    successMessage: "Floor created",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const roomForm = useFormAction<RoomValues, { id: string }>(createRoom, {
    successMessage: "Room created",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const siteBuildings = buildings.filter((building) => building.siteId === siteId);
  const floorOptions = siteBuildings.flatMap((building) =>
    building.floors.map((floor) => ({
      id: floor.id,
      label: `${building.name} · ${floor.name}`,
    }))
  );

  const errB = (name: keyof BuildingValues) =>
    buildingForm.formState.errors[name]?.message as string | undefined;
  const errF = (name: keyof FloorValues) =>
    floorForm.formState.errors[name]?.message as string | undefined;
  const errR = (name: keyof RoomValues) =>
    roomForm.formState.errors[name]?.message as string | undefined;

  function switchMode(next: Mode) {
    setMode(next);
    setOpen(true);
  }

  if (sites.length === 0) {
    return (
      <EmptyState
        title="No sites yet"
        description="Create a site first — buildings, floors and rooms hang off it."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Places: buildings, floors &amp; rooms</CardTitle>
            <CardDescription>Where assets sit — room codes resolve to placement and scan results.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[220px]">
              <Select value={siteId || undefined} onValueChange={setSiteId}>
                <SelectTrigger aria-label="Site">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} ({site.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canManage &&
              (open ? (
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  <X /> Cancel
                </Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={() => switchMode("building")}>
                    <Building2 /> Building
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => switchMode("floor")}>
                    <Layers /> Floor
                  </Button>
                  <Button size="sm" onClick={() => switchMode("room")}>
                    <Plus /> Room
                  </Button>
                </>
              ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && open && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-4">
            <div className="flex gap-1.5">
              {MODES.map((entry) => (
                <Button
                  key={entry.value}
                  type="button"
                  size="sm"
                  variant={mode === entry.value ? "default" : "ghost"}
                  onClick={() => setMode(entry.value)}
                >
                  {entry.icon} {entry.label}
                </Button>
              ))}
            </div>

            {mode === "building" && (
              <form onSubmit={buildingForm.submit} className="space-y-3" noValidate>
                <FormError error={buildingForm.serverError} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Building code" htmlFor="bld-code" required error={errB("code")}>
                    <Input id="bld-code" className="font-mono" {...buildingForm.register("code")} />
                  </Field>
                  <Field label="Building name" htmlFor="bld-name" required error={errB("name")}>
                    <Input id="bld-name" {...buildingForm.register("name")} />
                  </Field>
                  <div className="flex items-end">
                    <Button type="submit" size="sm" disabled={buildingForm.submitting}>
                      {buildingForm.submitting ? "Saving…" : "Add building"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {mode === "floor" && (
              <form onSubmit={floorForm.submit} className="space-y-3" noValidate>
                <FormError error={floorForm.serverError} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <Field label="Building" htmlFor="flr-building" required error={errF("buildingId")}>
                      <Select
                        value={floorForm.watch("buildingId") || undefined}
                        onValueChange={(value) =>
                          floorForm.setValue("buildingId", value, { shouldValidate: true })
                        }
                      >
                        <SelectTrigger id="flr-building">
                          <SelectValue placeholder="Select building" />
                        </SelectTrigger>
                        <SelectContent>
                          {siteBuildings.map((building) => (
                            <SelectItem key={building.id} value={building.id}>
                              {building.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Floor code" htmlFor="flr-code" required error={errF("code")}>
                    <Input id="flr-code" className="font-mono" {...floorForm.register("code")} />
                  </Field>
                  <Field label="Floor name" htmlFor="flr-name" required error={errF("name")}>
                    <Input id="flr-name" {...floorForm.register("name")} />
                  </Field>
                  <div className="flex items-end gap-2">
                    <Field label="Level" htmlFor="flr-level" error={errF("level")}>
                      <Input id="flr-level" type="number" className="w-20" {...floorForm.register("level")} />
                    </Field>
                    <Button type="submit" size="sm" disabled={floorForm.submitting}>
                      {floorForm.submitting ? "Saving…" : "Add"}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {mode === "room" && (
              <form onSubmit={roomForm.submit} className="space-y-3" noValidate>
                <FormError error={roomForm.serverError} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
                  <div className="sm:col-span-2">
                    <Field label="Floor" htmlFor="rm-floor" required error={errR("floorId")}>
                      <Select
                        value={roomForm.watch("floorId") || undefined}
                        onValueChange={(value) =>
                          roomForm.setValue("floorId", value, { shouldValidate: true })
                        }
                      >
                        <SelectTrigger id="rm-floor">
                          <SelectValue placeholder="Select floor" />
                        </SelectTrigger>
                        <SelectContent>
                          {floorOptions.map((floor) => (
                            <SelectItem key={floor.id} value={floor.id}>
                              {floor.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Room code" htmlFor="rm-code" required error={errR("code")}>
                    <Input id="rm-code" className="font-mono" {...roomForm.register("code")} />
                  </Field>
                  <Field label="Room name" htmlFor="rm-name" required error={errR("name")}>
                    <Input id="rm-name" {...roomForm.register("name")} />
                  </Field>
                  <div className="flex items-end gap-2">
                    <Field label="Capacity" htmlFor="rm-capacity" error={errR("capacity")}>
                      <Input
                        id="rm-capacity"
                        type="number"
                        min={0}
                        className="w-24"
                        {...roomForm.register("capacity")}
                      />
                    </Field>
                    <Button type="submit" size="sm" disabled={roomForm.submitting}>
                      {roomForm.submitting ? "Saving…" : "Add"}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {siteBuildings.length === 0 ? (
          <EmptyState
            title="No buildings on this site"
            description="Add the first building, then floors and rooms beneath it."
          />
        ) : (
          <div className="space-y-3">
            {siteBuildings.map((building) => (
              <div key={building.id} className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{building.name}</span>
                    <Badge variant="outline" className="font-mono">
                      {building.code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {building.floors.length} floor{building.floors.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        floorForm.setValue("buildingId", building.id);
                        setMode("floor");
                        setOpen(true);
                      }}
                    >
                      <Plus /> Floor
                    </Button>
                  )}
                </div>
                {building.floors.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">No floors yet.</p>
                ) : (
                  <ul className="divide-y">
                    {building.floors.map((floor) => (
                      <li key={floor.id} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{floor.name}</span>
                            <Badge variant="outline" className="font-mono">
                              {floor.code}
                            </Badge>
                            <span className="text-xs text-muted-foreground">Level {floor.level}</span>
                          </div>
                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                roomForm.setValue("floorId", floor.id);
                                setMode("room");
                                setOpen(true);
                              }}
                            >
                              <Plus /> Room
                            </Button>
                          )}
                        </div>
                        {floor.rooms.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 pl-6">
                            {floor.rooms.map((room) => (
                              <span
                                key={room.id}
                                className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[11px]"
                              >
                                <DoorOpen className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono">{room.code}</span>
                                <span className="text-muted-foreground">{room.name}</span>
                                {room.capacity !== null && (
                                  <span className="text-muted-foreground">· {room.capacity}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
