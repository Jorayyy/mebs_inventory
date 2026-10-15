"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormError } from "@/components/ui/form";
import { saveSite, saveDepartment, saveStockLocation } from "@/actions/org";
import { createCategory } from "@/actions/catalog";
import { CATEGORY_GROUP } from "@/lib/constants";
import type { ActionResult } from "@/lib/errors";

type Entity = "site" | "category" | "department" | "stockLocation";

const TITLES: Record<Entity, string> = {
  site: "New site",
  category: "New category",
  department: "New department",
  stockLocation: "New storage location",
};

const DESCRIPTIONS: Record<Entity, string> = {
  site: "An operating location. Sites scope who sees which assets and drive tag prefixes.",
  category: "Decides how items are tracked and named — you can add item types later.",
  department: "Groups employees for reporting. Teams and cost centres are optional.",
  stockLocation: "Where consumables physically sit inside the selected site.",
};

const NEEDS_SITE: Entity[] = ["department", "stockLocation"];

function deriveCode(name: string): string {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 8);
}

/**
 * A normal required select with a `+` button that creates the missing record
 * in place, so a fresh install never dead-ends on an empty dropdown.
 */
export function CreatableSelect({
  entity,
  value,
  onChange,
  options,
  placeholder,
  siteId,
  id,
  disabled,
  onCreated,
}: {
  entity: Entity;
  value: string;
  onChange: (id: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  siteId?: string;
  id?: string;
  disabled?: boolean;
  onCreated?: (id: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [codeTouched, setCodeTouched] = React.useState(false);
  const [timezone, setTimezone] = React.useState("");
  const [group, setGroup] = React.useState<string>("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const needsSite = NEEDS_SITE.includes(entity);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setCode("");
    setCodeTouched(false);
    setGroup("");
    setError(null);
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [open]);

  const nameRequired = name.trim().length >= 2;
  const codeRequired = entity === "category" || code.trim().length > 0;
  const groupRequired = entity !== "category" || group.length > 0;
  const blockedBySite = needsSite && !siteId;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload =
        entity === "site"
          ? { name: name.trim(), code: code.trim(), timezone }
          : entity === "category"
            ? { name: name.trim(), group }
            : { siteId: siteId!, name: name.trim(), code: code.trim() };

      const result: ActionResult<{ id: string }> =
        entity === "site"
          ? await saveSite(payload)
          : entity === "category"
            ? await createCategory(payload)
            : entity === "department"
              ? await saveDepartment(payload)
              : await saveStockLocation(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`${TITLES[entity].replace("New ", "")} created`);
      onChange(result.data.id);
      onCreated?.(result.data.id);
      router.refresh();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-stretch gap-1.5">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="min-w-0 flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        disabled={disabled}
        title={blockedBySite ? "Select a site first" : `Create ${entity === "stockLocation" ? "storage location" : entity}`}
        aria-label={blockedBySite ? "Select a site first" : `Create ${entity}`}
        onClick={() => (blockedBySite ? toast.error("Select a site first") : setOpen(true))}
      >
        <Plus className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{TITLES[entity]}</DialogTitle>
            <DialogDescription>{DESCRIPTIONS[entity]}</DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-3">
            <FormError error={error} />

            <Field label="Name" htmlFor={`${id}-name`} required>
              <Input
                id={`${id}-name`}
                value={name}
                autoFocus
                onChange={(event) => {
                  const next = event.target.value;
                  setName(next);
                  if (!codeTouched) setCode(deriveCode(next));
                }}
              />
            </Field>

            {entity === "category" ? (
              <Field label="Group" htmlFor={`${id}-group`} required>
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger id={`${id}-group`}>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_GROUP).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field
                label="Code"
                htmlFor={`${id}-code`}
                required
                hint="Short unique code used in tags — edit if you like"
              >
                <Input
                  id={`${id}-code`}
                  className="font-mono uppercase"
                  value={code}
                  onChange={(event) => {
                    setCodeTouched(true);
                    setCode(event.target.value);
                  }}
                />
              </Field>
            )}

            {entity === "site" && (
              <Field label="Timezone" htmlFor={`${id}-tz`} required hint="Defaults to your browser timezone">
                <Input id={`${id}-tz`} value={timezone} onChange={(event) => setTimezone(event.target.value)} />
              </Field>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !nameRequired || !codeRequired || !groupRequired}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
