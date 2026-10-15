"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type Option = { id: string; label: string };

/**
 * Searchable employee combobox shared by every assign surface.
 * Server-side search (debounced) so large employee lists stay reachable.
 */
export function EmployeePicker({
  value,
  onChange,
  placeholder = "Search employee…",
  id,
  disabled,
  error,
}: {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  error?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [rows, setRows] = React.useState<Option[]>([]);
  const [chosen, setChosen] = React.useState<Option | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!value) setChosen(null);
  }, [value]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { searchEmployees } = await import("@/actions/employees");
        const found = await searchEmployees(query, 100);
        if (cancelled) return;
        setRows(found.map((employee) => ({ id: employee.id, label: employee.label })));
      } catch {
        if (!cancelled) setLoadError("Could not load employees.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  const selected = chosen ?? rows.find((row) => row.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", error && "border-destructive")}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Type a name, employee no…"
          />
          <CommandList>
            {loading && rows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : loadError ? (
              <CommandEmpty>{loadError}</CommandEmpty>
            ) : (
              <>
                <CommandEmpty>
                  {query ? `No employees match “${query}”.` : "No active employees yet."}
                </CommandEmpty>
                {rows.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={row.id}
                    onSelect={() => {
                      setChosen(row);
                      onChange(row.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("h-4 w-4", row.id === value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{row.label}</span>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
