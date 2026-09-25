"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { globalSearch, type SearchHit } from "@/actions/search";
import { Boxes, Laptop, ArrowLeftRight, Truck, UserRound, FileText } from "lucide-react";

const TYPE_ICON = {
  asset: Laptop,
  employee: UserRound,
  stock: Boxes,
  transfer: ArrowLeftRight,
  supplier: Truck,
  page: FileText,
} as const;

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await globalSearch(query);
        if (!controller.signal.aborted) setHits(results);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const grouped = {
    Assets: hits.filter((h) => h.type === "asset"),
    People: hits.filter((h) => h.type === "employee"),
    Stock: hits.filter((h) => h.type === "stock"),
    Transfers: hits.filter((h) => h.type === "transfer"),
    Suppliers: hits.filter((h) => h.type === "supplier"),
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search asset tag, serial number, employee, SKU, transfer…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Searching…" : query.length < 2 ? "Type at least 2 characters." : "No results found."}
        </CommandEmpty>
        {Object.entries(grouped)
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => (
            <CommandGroup key={label} heading={label}>
              {items.map((hit) => {
                const Icon = TYPE_ICON[hit.type];
                return (
                  <CommandItem key={`${hit.type}-${hit.id}`} value={`${hit.title} ${hit.subtitle ?? ""}`} onSelect={() => go(hit.href)}>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{hit.title}</span>
                    {hit.subtitle && (
                      <span className="truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go("/assets/new")}>
            <Laptop className="h-4 w-4 text-muted-foreground" />
            Register new asset
          </CommandItem>
          <CommandItem onSelect={() => go("/inventory/receive")}>
            <Boxes className="h-4 w-4 text-muted-foreground" />
            Receive stock
          </CommandItem>
          <CommandItem onSelect={() => go("/transfers/new")}>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            Create site transfer
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
