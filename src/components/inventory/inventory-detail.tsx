"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  PackageMinus,
  PackagePlus,
  ClipboardList,
  MapPin,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard, DetailGrid, DetailItem, EmptyState } from "@/components/shared/page-header";
import { StockIssueDialog } from "@/components/inventory/stock-issue-dialog";
import { StockAdjustDialog } from "@/components/inventory/stock-adjust-dialog";
import { InventoryItemDialog } from "@/components/inventory/inventory-form";
import { formatCurrency, formatDate, formatNumber, formatRelative } from "@/lib/utils";
import { STOCK_TX_LABELS } from "@/lib/constants";
import type { Tone } from "@/lib/constants";

export type InventoryDetailPermissions = {
  issue: boolean;
  adjust: boolean;
  receive: boolean;
};

export type InventoryDetailData = {
  item: {
    id: string;
    sku: string;
    name: string;
    description: string | null;
    binLocation: string | null;
    unit: string;
    minQty: number;
    maxQty: number | null;
    reorderLevel: number;
    unitCost: number;
    currentQty: number;
    reservedQty: number;
    available: number;
    value: number;
    lowStock: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastMovementAt: Date | null;
    category: { id: string; name: string };
    itemType: { id: string; name: string } | null;
    site: { id: string; name: string; code: string };
    stockLocation: { id: string; name: string; code: string };
    supplier: { id: string; name: string } | null;
  };
  locations: {
    locationId: string;
    name: string;
    code: string | null;
    balance: number;
    movements: number;
    lastAt: Date | null;
    isHome: boolean;
  }[];
  transactions: {
    id: string;
    type: string;
    quantity: number;
    balanceAfter: number;
    unitCost: number | null;
    notes: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: Date;
    performedBy: { name: string } | null;
    fromLocation: { name: string } | null;
    toLocation: { name: string } | null;
  }[];
  permissions: InventoryDetailPermissions;
};

const TONE: Record<string, Tone> = {
  RECEIVE: "success",
  REPLENISHMENT: "success",
  ISSUE: "info",
  CONSUME: "warning",
  ADJUSTMENT: "purple",
  WRITE_OFF: "danger",
  TRANSFER_OUT: "info",
  TRANSFER_IN: "info",
  RESERVE: "muted",
  RELEASE: "muted",
};

function MovementTone({ type }: { type: string }) {
  return (
    <Badge variant={TONE[type] ? "secondary" : "outline"} className="font-normal">
      {STOCK_TX_LABELS[type as never] ?? type}
    </Badge>
  );
}

export function InventoryDetail({ data }: { data: InventoryDetailData }) {
  const { item, locations, transactions, permissions } = data;
  const router = useRouter();
  const [tab, setTab] = React.useState("overview");
  const [dialog, setDialog] = React.useState<null | "issue" | "consume" | "replenish" | "adjust" | "edit">(
    null
  );

  const lite = {
    id: item.id,
    sku: item.sku,
    name: item.name,
    unit: item.unit,
    currentQty: item.currentQty,
    reservedQty: item.reservedQty,
    unitCost: item.unitCost,
    reorderLevel: item.reorderLevel,
    siteId: item.site.id,
    stockLocationId: item.stockLocation.id,
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={item.lowStock ? "warning" : "success"}>
          {item.lowStock ? "Low stock" : "In stock"}
        </Badge>
        {!item.isActive && <Badge variant="muted">Inactive</Badge>}
        <Badge variant="outline">{item.unit}</Badge>
        <span className="text-xs text-muted-foreground">
          Last movement {formatRelative(item.lastMovementAt)}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {permissions.issue && (
            <Button variant="outline" size="sm" onClick={() => setDialog("issue")}>
              <PackageMinus /> Issue
            </Button>
          )}
          {permissions.issue && (
            <Button variant="outline" size="sm" onClick={() => setDialog("consume")}>
              <ClipboardList /> Consume
            </Button>
          )}
          {permissions.receive && (
            <Button variant="outline" size="sm" onClick={() => setDialog("replenish")}>
              <PackagePlus /> Replenish
            </Button>
          )}
          {permissions.adjust && (
            <Button variant="outline" size="sm" onClick={() => setDialog("adjust")}>
              <ClipboardList /> Adjust
            </Button>
          )}
          {permissions.adjust && (
            <Button size="sm" onClick={() => setDialog("edit")}>
              <Pencil /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="On hand" value={formatNumber(item.currentQty, 3)} hint={item.unit} />
        <StatCard
          label="Reserved"
          value={formatNumber(item.reservedQty, 3)}
          hint="Allocated to transfers"
        />
        <StatCard
          label="Available"
          value={formatNumber(item.available, 3)}
          hint="On hand − reserved"
          tone={item.available <= 0 ? "danger" : "default"}
        />
        <StatCard label="Value" value={formatCurrency(item.value)} hint="On hand × unit cost" />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList className="h-9 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Details</TabsTrigger>
          <TabsTrigger value="locations">Stock by location</TabsTrigger>
          <TabsTrigger value="history">Transaction history</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Item details</CardTitle>
              <CardDescription>
                Registered {formatDate(item.createdAt)} · Updated {formatDate(item.updatedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailItem label="SKU" mono>
                  {item.sku}
                </DetailItem>
                <DetailItem label="Name">{item.name}</DetailItem>
                <DetailItem label="Category">
                  {item.category.name}
                  {item.itemType ? ` · ${item.itemType.name}` : ""}
                </DetailItem>
                <DetailItem label="Site">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {item.site.name} ({item.site.code})
                  </span>
                </DetailItem>
                <DetailItem label="Stock location">
                  {item.stockLocation.name} ({item.stockLocation.code})
                </DetailItem>
                <DetailItem label="Bin / shelf" mono>
                  {item.binLocation || "—"}
                </DetailItem>
                <DetailItem label="Unit">{item.unit}</DetailItem>
                <DetailItem label="Unit cost">{formatCurrency(item.unitCost)}</DetailItem>
                <DetailItem label="Stock value">{formatCurrency(item.value)}</DetailItem>
                <DetailItem label="Min / Max">
                  {formatNumber(item.minQty, 3)} /{" "}
                  {item.maxQty === null ? "—" : formatNumber(item.maxQty, 3)}
                </DetailItem>
                <DetailItem label="Reorder level">{formatNumber(item.reorderLevel, 3)}</DetailItem>
                <DetailItem label="Preferred supplier">
                  {item.supplier ? (
                    <Link href={`/suppliers/${item.supplier.id}`} className="text-primary hover:underline">
                      {item.supplier.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </DetailItem>
                <DetailItem label="Description" className="sm:col-span-2 lg:col-span-3">
                  {item.description || "—"}
                </DetailItem>
              </DetailGrid>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locations" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Stock by location</CardTitle>
              <CardDescription>
                Balances derived from the transaction ledger, grouped per stock location.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {locations.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No movement recorded yet" description="Receive or adjust stock to populate this view." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Location</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Movements</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Last activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map((row) => (
                      <TableRow key={row.locationId}>
                        <TableCell>
                          <p className="text-sm font-medium">{row.name}</p>
                          {row.code && <p className="text-xs text-muted-foreground">{row.code}</p>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.isHome ? "Home location" : "Historical"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {row.movements}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm font-medium">
                          {formatNumber(row.balance, 3)} {item.unit}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(row.lastAt, true)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <History className="h-4 w-4" /> Transaction history
              </CardTitle>
              <CardDescription>
                Immutable ledger — showing the {transactions.length} most recent event
                {transactions.length === 1 ? "" : "s"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No transactions yet" description="Stock movements will appear here." />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Handled by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(tx.createdAt, true)}
                        </TableCell>
                        <TableCell>
                          <MovementTone type={tx.type} />
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums text-sm font-medium ${
                            tx.quantity < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {tx.quantity > 0 ? "+" : ""}
                          {formatNumber(tx.quantity, 3)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {formatNumber(tx.balanceAfter, 3)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {tx.toLocation?.name ?? tx.fromLocation?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {tx.referenceType === "RECEIVING" && tx.referenceId ? (
                            <Link
                              href={`/inventory/receive/${tx.referenceId}`}
                              className="text-primary hover:underline"
                            >
                              View receipt
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">{tx.notes || "—"}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {tx.performedBy?.name ?? "System"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {(dialog === "issue" || dialog === "consume" || dialog === "replenish") && (
        <StockIssueDialog
          mode={dialog}
          item={lite}
          open
          onOpenChange={(open) => !open && setDialog(null)}
        />
      )}
      {dialog === "adjust" && (
        <StockAdjustDialog item={lite} open onOpenChange={(open) => !open && setDialog(null)} />
      )}
      {dialog === "edit" && (
        <InventoryItemDialog
          item={{ id: item.id }}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
