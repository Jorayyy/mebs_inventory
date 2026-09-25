"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Tag,
  ArrowLeftRight,
  Download,
  Printer,
  ShieldCheck,
  MapPin,
  UserRound,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DetailGrid,
  DetailItem,
  EmptyState,
} from "@/components/shared/page-header";
import {
  AssetStatusBadge,
  ConditionBadge,
  TransferStatusBadge,
} from "@/components/shared/status-badge";
import { formatDate, formatCurrency, formatRelative, daysUntil } from "@/lib/utils";
import { INVENTORY_TX_LABELS } from "@/lib/constants";
import { AssignmentPanel } from "@/components/assets/asset-assignment-panel";
import { MaintenancePanel } from "@/components/assets/asset-maintenance-panel";
import { PrintLabelsDialog } from "@/components/assets/print-labels-dialog";

type Permissions = {
  update: boolean;
  assign: boolean;
  transfer: boolean;
  print: boolean;
  maintenance: boolean;
  dispose: boolean;
  viewAll: boolean;
};

export type AssetDetailData = {
  asset: {
    id: string;
    assetTag: string;
    name: string;
    serialNumber: string | null;
    barcode: string | null;
    qrCode: string | null;
    description: string | null;
    manufacturer: string | null;
    brand: string | null;
    model: string | null;
    purchaseDate: string | null;
    purchasePrice: number | null;
    currency: string;
    supplierId: string | null;
    supplier: { name: string } | null;
    warrantyStart: string | null;
    warrantyEnd: string | null;
    warrantyMonths: number | null;
    status: string;
    condition: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    receivedAt: string | null;
    site: { id: string; name: string; code: string };
    room: { name: string; floor: { name: string; building: { name: string } } } | null;
    stockLocation: { name: string; code: string } | null;
    department: { name: string } | null;
    costCenter: { code: string; name: string } | null;
    assignedEmployee: {
      id: string;
      firstName: string;
      lastName: string;
      employeeNo: string;
      jobTitle: string | null;
    } | null;
    custodian: { id: string; name: string } | null;
    createdBy: { id: string; name: string } | null;
    category: { id: string; name: string };
    itemType: { id: string; name: string } | null;
    disposal: { reason: string; method: string; disposedAt: string } | null;
  };
  assignments: {
    id: string;
    status: string;
    assignedAt: string;
    expectedReturnAt: string | null;
    returnedAt: string | null;
    conditionAtAssignment: string;
    returnCondition: string | null;
    acknowledgedAt: string | null;
    notes: string | null;
    employee: { id: string; firstName: string; lastName: string; employeeNo: string };
    assignedBy: { name: string };
    returnedBy: { name: string } | null;
  }[];
  transactions: {
    id: string;
    type: string;
    fromStatus: string | null;
    toStatus: string | null;
    notes: string | null;
    createdAt: string;
    performedBy: { name: string } | null;
    fromEmployee: { firstName: string; lastName: string } | null;
    toEmployee: { firstName: string; lastName: string } | null;
    fromSite: { name: string } | null;
    toSite: { name: string } | null;
  }[];
  maintenance: {
    id: string;
    referenceNo: string;
    issue: string;
    status: string;
    cost: number;
    reportedAt: string;
    completedAt: string | null;
    reportedBy: { name: string };
    technician: { name: string } | null;
    vendor: { name: string } | null;
  }[];
  transfers: {
    id: string;
    status: string;
    createdAt: string;
    transfer: {
      transferNumber: string;
      status: string;
      fromSite: { name: string };
      toSite: { name: string };
      requestedBy: { name: string };
    };
  }[];
  attachments: { id: string; filename: string; url: string; mimeType: string; size: number }[];
  permissions: Permissions;
};

function locationPath(asset: AssetDetailData["asset"]) {
  if (asset.room) {
    return `${asset.room.floor.building.name} · ${asset.room.floor.name} · ${asset.room.name}`;
  }
  if (asset.stockLocation) return `${asset.stockLocation.name} (${asset.stockLocation.code})`;
  return "Not specified";
}

export function AssetDetail({ data }: { data: AssetDetailData }) {
  const { asset, transactions, transfers, attachments, permissions } = data;
  const router = useRouter();
  const [qr, setQr] = React.useState<string | null>(null);
  const [showLabels, setShowLabels] = React.useState(false);
  const [initialTab, setInitialTab] = React.useState("overview");

  React.useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab) setInitialTab(tab);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getAssetQr } = await import("@/actions/qr");
      try {
        const result = await getAssetQr(asset.id);
        if (!cancelled) setQr(result.qrDataUrl);
      } catch {
        /* label rendering is non-critical */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset.id]);

  const warrantyDays = daysUntil(asset.warrantyEnd);
  const warrantyTone =
    warrantyDays === null
      ? "muted"
      : warrantyDays < 0
        ? "danger"
        : warrantyDays <= 60
          ? "warning"
          : "success";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AssetStatusBadge status={asset.status as never} />
        <ConditionBadge condition={asset.condition as never} />
        {asset.supplier && <Badge variant="outline">{asset.supplier.name}</Badge>}
        <div className="ml-auto flex flex-wrap gap-2">
          {permissions.print && (
            <Button variant="outline" size="sm" onClick={() => setShowLabels(true)}>
              <Tag /> Label
            </Button>
          )}
          {permissions.transfer && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/transfers/new?assetIds=${asset.id}`}>
                <ArrowLeftRight /> Transfer
              </Link>
            </Button>
          )}
          {permissions.update && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/assets/${asset.id}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs value={initialTab} onValueChange={setInitialTab}>
        <TabsList className="h-9 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignment">Assignment</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="qr">QR &amp; labels</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Asset information</CardTitle>
              <CardDescription>
                Registered {formatDate(asset.createdAt)}
                {asset.createdBy ? ` by ${asset.createdBy.name}` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailItem label="Asset tag" mono>
                  {asset.assetTag}
                </DetailItem>
                <DetailItem label="Serial number" mono>
                  {asset.serialNumber || "—"}
                </DetailItem>
                <DetailItem label="Category">
                  {asset.category.name}
                  {asset.itemType ? ` · ${asset.itemType.name}` : ""}
                </DetailItem>
                <DetailItem label="Brand / model">
                  {[asset.brand, asset.model].filter(Boolean).join(" ") || "—"}
                </DetailItem>
                <DetailItem label="Manufacturer">{asset.manufacturer || "—"}</DetailItem>
                <DetailItem label="Barcode" mono>
                  {asset.barcode || "—"}
                </DetailItem>

                <DetailItem label="Site">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {asset.site.name} ({asset.site.code})
                  </span>
                </DetailItem>
                <DetailItem label="Location">{locationPath(asset)}</DetailItem>
                <DetailItem label="Department">{asset.department?.name || "—"}</DetailItem>
                <DetailItem label="Cost centre">
                  {asset.costCenter ? `${asset.costCenter.code} — ${asset.costCenter.name}` : "—"}
                </DetailItem>

                <DetailItem label="Assigned to">
                  {asset.assignedEmployee ? (
                    <Link href={`/employees/${asset.assignedEmployee.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <UserRound className="h-3.5 w-3.5" />
                      {asset.assignedEmployee.firstName} {asset.assignedEmployee.lastName} ·{" "}
                      {asset.assignedEmployee.employeeNo}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </DetailItem>
                <DetailItem label="Custodian">{asset.custodian?.name || "—"}</DetailItem>

                <DetailItem label="Purchase date">{formatDate(asset.purchaseDate)}</DetailItem>
                <DetailItem label="Purchase price">
                  {asset.purchasePrice ? formatCurrency(asset.purchasePrice, asset.currency) : "—"}
                </DetailItem>
                <DetailItem label="Warranty">
                  {asset.warrantyEnd ? (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Until {formatDate(asset.warrantyEnd)}
                      <Badge
                        variant={
                          warrantyTone === "danger"
                            ? "danger"
                            : warrantyTone === "warning"
                              ? "warning"
                              : warrantyTone === "success"
                                ? "success"
                                : "muted"
                        }
                      >
                        {warrantyDays !== null && warrantyDays >= 0
                          ? `${warrantyDays}d left`
                          : "Expired"}
                      </Badge>
                    </span>
                  ) : (
                    "—"
                  )}
                </DetailItem>
                <DetailItem label="Received">{formatDate(asset.receivedAt, true)}</DetailItem>
                <DetailItem label="Last updated">{formatRelative(asset.updatedAt)}</DetailItem>

                <DetailItem label="Description" className="sm:col-span-2 lg:col-span-3">
                  {asset.description || "—"}
                </DetailItem>
                <DetailItem label="Notes" className="sm:col-span-2 lg:col-span-3">
                  {asset.notes || "—"}
                </DetailItem>

                {asset.disposal && (
                  <DetailItem label="Disposal" className="sm:col-span-2 lg:col-span-3">
                    {asset.disposal.method} — {asset.disposal.reason} (
                    {formatDate(asset.disposal.disposedAt)})
                  </DetailItem>
                )}
              </DetailGrid>
            </CardContent>
          </Card>

          {attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Documents &amp; photos</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Download className="h-4 w-4" />
                    <span className="truncate">{file.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignment">
          <AssignmentPanel data={data} onChange={() => router.refresh()} />
        </TabsContent>

        <TabsContent value="maintenance">
          <MaintenancePanel data={data} onChange={() => router.refresh()} />
        </TabsContent>

        <TabsContent value="transfers" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Transfer history</CardTitle>
              <CardDescription>Every inter-site movement recorded for this asset.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {transfers.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No transfers yet"
                    description="This asset has not moved between sites."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transfer</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested by</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/transfers/${row.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {row.transfer.transferNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.transfer.fromSite.name} → {row.transfer.toSite.name}
                        </TableCell>
                        <TableCell>
                          <TransferStatusBadge status={row.transfer.status as never} />
                        </TableCell>
                        <TableCell className="text-sm">{row.transfer.requestedBy.name}</TableCell>
                        <TableCell className="text-xs">{formatDate(row.createdAt)}</TableCell>
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
              <CardTitle>Transaction history</CardTitle>
              <CardDescription>
                Immutable ledger — {transactions.length} recorded event{transactions.length === 1 ? "" : "s"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="p-4">
                  <EmptyState title="No transactions recorded" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Status change</TableHead>
                      <TableHead>Parties</TableHead>
                      <TableHead>Handled by</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {formatDate(tx.createdAt, true)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{INVENTORY_TX_LABELS[tx.type as never] ?? tx.type}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {tx.fromStatus ? `${tx.fromStatus} → ` : ""}
                          {tx.toStatus ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {[
                            tx.fromSite?.name ? `From ${tx.fromSite.name}` : null,
                            tx.toSite?.name ? `To ${tx.toSite.name}` : null,
                            tx.fromEmployee
                              ? `Returned by ${tx.fromEmployee.firstName} ${tx.fromEmployee.lastName}`
                              : null,
                            tx.toEmployee
                              ? `To ${tx.toEmployee.firstName} ${tx.toEmployee.lastName}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {tx.performedBy?.name ?? "System"}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                          {tx.notes || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qr" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>QR code</CardTitle>
              <CardDescription>
                Scanning opens {`/scan`} with this asset&apos;s profile. Deep link:{" "}
                <span className="font-mono text-[11px]">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/scan?code=${asset.assetTag}`
                    : `/scan?code=${asset.assetTag}`}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-start gap-6">
              <div className="flex h-48 w-48 items-center justify-center rounded-lg border bg-white p-3">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr} alt={`QR code for ${asset.assetTag}`} className="h-full w-full" />
                ) : (
                  <span className="text-xs text-muted-foreground">Generating…</span>
                )}
              </div>
              <div className="space-y-3">
                <div className="text-sm">
                  <p className="font-medium">{asset.name}</p>
                  <p className="font-mono text-muted-foreground">{asset.assetTag}</p>
                  {asset.serialNumber && (
                    <p className="font-mono text-xs text-muted-foreground">S/N {asset.serialNumber}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setShowLabels(true)}>
                    <Printer /> Print label
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/scan?code=${asset.assetTag}`} target="_blank" rel="noreferrer">
                      <Clock /> Open scan view
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PrintLabelsDialog
        open={showLabels}
        onOpenChange={setShowLabels}
        assetIds={[asset.id]}
        defaults={{ copies: 1 }}
      />
    </>
  );
}

