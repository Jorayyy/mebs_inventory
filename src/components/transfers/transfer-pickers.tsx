"use client";

import * as React from "react";
import { Loader2, PackagePlus, Plus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchAssetsForPicker } from "@/actions/assets";
import { searchConsumablesForPicker } from "@/actions/transfers";

export type PickedAsset = { id: string; assetTag: string; name: string; status: string };
export type PickedLine = {
  inventoryItemId: string;
  sku: string;
  name: string;
  unit: string;
  available: number;
  quantity: number;
};

/** Type-ahead asset picker backed by `searchAssetsForPicker`. */
export function AssetPicker({
  value,
  onChange,
}: {
  value: PickedAsset[];
  onChange: (next: PickedAsset[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PickedAsset[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchAssetsForPicker(q);
        if (!cancelled) setResults(rows);
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? "Asset search failed" : "Asset search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLoading(false);
    };
  }, [query]);

  const selectedIds = new Set(value.map((a) => a.id));

  const add = (asset: PickedAsset) => {
    if (selectedIds.has(asset.id)) return;
    onChange([...value, asset]);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search asset tag, serial or name…"
          className="h-9 pl-8 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="max-h-52 overflow-y-auto rounded-md border">
          {results.map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={selectedIds.has(asset.id)}
              onClick={() => add(asset)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{asset.assetTag}</span>
                <span className="block truncate text-xs text-muted-foreground">{asset.name}</span>
              </span>
              <Badge variant={selectedIds.has(asset.id) ? "success" : "outline"}>{asset.status}</Badge>
            </button>
          ))}
        </div>
      )}

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">No assets selected yet.</p>
      ) : (
        <ul className="space-y-1">
          {value.map((asset) => (
            <li
              key={asset.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{asset.assetTag}</span>
                <span className="block truncate text-xs text-muted-foreground">{asset.name}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${asset.assetTag}`}
                onClick={() => onChange(value.filter((a) => a.id !== asset.id))}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Type-ahead consumable picker — only lists stock held at the source site. */
export function ConsumablePicker({
  siteId,
  value,
  onChange,
}: {
  siteId: string;
  value: PickedLine[];
  onChange: (next: PickedLine[]) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<
    { id: string; sku: string; name: string; unit: string; currentQty: number; stockLocation: string }[]
  >([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (!siteId || q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchConsumablesForPicker(q, siteId);
        if (!cancelled) setResults(rows);
      } catch (error) {
        if (!cancelled)
          toast.error(error instanceof Error ? error.message : "Consumable search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLoading(false);
    };
  }, [query, siteId]);

  const selectedIds = new Set(value.map((l) => l.inventoryItemId));

  const add = (item: { id: string; sku: string; name: string; unit: string; currentQty: number }) => {
    if (selectedIds.has(item.id)) return;
    onChange([
      ...value,
      {
        inventoryItemId: item.id,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        available: item.currentQty,
        quantity: 1,
      },
    ]);
    setQuery("");
    setResults([]);
  };

  const setQuantity = (inventoryItemId: string, quantity: number) => {
    onChange(
      value.map((line) =>
        line.inventoryItemId === inventoryItemId
          ? { ...line, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 0 }
          : line
      )
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={siteId ? "Search SKU or item name…" : "Select the source site first"}
          disabled={!siteId}
          className="h-9 pl-8 text-sm"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={selectedIds.has(item.id)}
              onClick={() => add(item)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.sku}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.name} · {item.stockLocation}
                </span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {item.currentQty} {item.unit}
              </span>
            </button>
          ))}
        </div>
      )}

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          <PackagePlus className="mr-1 inline h-3.5 w-3.5" />
          No consumable lines yet.
        </p>
      ) : (
        <ul className="space-y-1">
          {value.map((line) => (
            <li
              key={line.inventoryItemId}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{line.sku}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {line.name} · {line.available} {line.unit} available
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={line.available}
                  value={line.quantity}
                  onChange={(e) => setQuantity(line.inventoryItemId, Number(e.target.value))}
                  className="h-7 w-20 text-right text-xs"
                  aria-label={`Quantity for ${line.sku}`}
                />
                <span className="w-8 text-xs text-muted-foreground">{line.unit}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${line.sku}`}
                  onClick={() => onChange(value.filter((l) => l.inventoryItemId !== line.inventoryItemId))}
                >
                  <X />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AddHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Plus className="h-3 w-3" /> {children}
    </p>
  );
}
