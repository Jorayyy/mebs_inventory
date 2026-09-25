import Link from "next/link";
import { AlertTriangle, Boxes, PackageOpen, TrendingDown } from "lucide-react";
import { StatCard } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";

export type StatSummary = {
  itemCount: number;
  totalValue: number;
  lowCount: number;
};

export function InventoryStats({ summary }: { summary: StatSummary }) {
  const { itemCount, totalValue, lowCount } = summary;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Items"
        value={itemCount.toLocaleString()}
        hint="Matching the current filters"
        icon={<Boxes className="h-4 w-4" />}
      />
      <StatCard
        label="Stock value"
        value={formatCurrency(totalValue)}
        hint="On hand × unit cost"
        icon={<PackageOpen className="h-4 w-4" />}
      />
      <StatCard
        label="Low stock"
        value={lowCount.toLocaleString()}
        hint="At or below reorder level"
        tone={lowCount > 0 ? "warning" : "success"}
        href={lowCount > 0 ? "/inventory?low=yes" : undefined}
        icon={<TrendingDown className="h-4 w-4" />}
      />
    </div>
  );
}

export type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  currentQty: number;
  reorderLevel: number;
  siteName: string;
  locationName: string;
};

export function LowStockPanel({ items, total }: { items: LowStockItem[]; total: number }) {
  if (total === 0) return null;
  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold">
              {total} item{total === 1 ? "" : "s"} at or below reorder level
            </h2>
            <p className="text-xs text-muted-foreground">
              Restock these before they hit zero on the floor.
            </p>
          </div>
        </div>
        <Link href="/inventory?low=yes" className="text-xs font-medium text-primary hover:underline">
          View all low stock
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/20 bg-background/60 px-3 py-2"
          >
            <div className="min-w-0">
              <Link
                href={`/inventory/${item.id}`}
                className="block truncate text-sm font-medium text-primary hover:underline"
              >
                {item.sku}
              </Link>
              <p className="truncate text-xs text-muted-foreground">
                {item.name} · {item.siteName} · {item.locationName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="warning">
                {formatNumber(item.currentQty, 3)} / {formatNumber(item.reorderLevel, 3)}{" "}
                {item.unit}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
