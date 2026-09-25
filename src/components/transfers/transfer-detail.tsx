import Link from "next/link";
import { ArrowRight, Check, CircleDashed, MapPin, Truck } from "lucide-react";
import { TransferStatusBadge, StatusBadge } from "@/components/shared/status-badge";
import { DetailGrid, DetailItem, SectionCard, EmptyState } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { TRANSFER_STATUS, type Tone } from "@/lib/constants";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import type { TransferStatus, TransferItemStatus, AssetCondition } from "@/generated/prisma";

const LINE_STATUS: Record<TransferItemStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "muted" },
  SENT: { label: "Sent", tone: "purple" },
  RECEIVED: { label: "Received", tone: "success" },
  DAMAGED: { label: "Damaged", tone: "danger" },
  MISSING: { label: "Missing", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "muted" },
};

export type TransferDetailData = {
  id: string;
  transferNumber: string;
  status: TransferStatus;
  notes: string | null;
  fromSite: { id: string; name: string; code: string };
  toSite: { id: string; name: string; code: string };
  fromLocation: { name: string } | null;
  toLocation: { name: string } | null;
  requestedBy: { name: string; email: string | null };
  requestedAt: Date;
  approvedBy: { name: string } | null;
  approvedAt: Date | null;
  shippedAt: Date | null;
  expectedArrival: Date | null;
  actualArrival: Date | null;
  courier: string | null;
  referenceNumber: string | null;
  assets: {
    id: string;
    assetTag: string;
    name: string;
    serialNumber: string | null;
    status: TransferItemStatus;
    conditionAtSend: AssetCondition | null;
    conditionAtReceive: AssetCondition | null;
    currentCondition: AssetCondition;
    currentStatus: string;
  }[];
  items: {
    id: string;
    sku: string;
    name: string;
    unit: string;
    quantity: number;
    receivedQuantity: number | null;
    status: TransferItemStatus;
    availableAtSource: number;
  }[];
  activity: { id: string; description: string | null; action: string; createdAt: Date; userName: string | null }[];
};

const STEPS = [
  { key: "requested", label: "Requested", icon: CircleDashed },
  { key: "approved", label: "Approved", icon: Check },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "received", label: "Received", icon: MapPin },
  { key: "completed", label: "Completed", icon: Check },
] as const;

const STEP_FOR_STATUS: Record<TransferStatus, number> = {
  DRAFT: 0,
  PENDING_APPROVAL: 0,
  REJECTED: 0,
  APPROVED: 1,
  IN_TRANSIT: 2,
  RECEIVED: 3,
  COMPLETED: 4,
  CANCELLED: 0,
};

const STEP_DATES = (data: TransferDetailData) => [
  data.requestedAt,
  data.approvedAt,
  data.shippedAt,
  data.actualArrival,
  data.status === "COMPLETED" ? data.actualArrival : null,
];

export function TransferTimeline({ status, dates }: { status: TransferStatus; dates: (Date | null)[] }) {
  const currentIndex = STEP_FOR_STATUS[status];
  const terminal = status === "REJECTED" || status === "CANCELLED";

  return (
    <ol className="grid gap-3 sm:grid-cols-5">
      {STEPS.map((step, index) => {
        const done = !terminal && index < currentIndex;
        const current = !terminal && index === currentIndex;
        const Icon = step.icon;
        return (
          <li
            key={step.key}
            className={cn(
              "rounded-md border px-3 py-2",
              done && "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40",
              current && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border",
                  done && "border-emerald-500 text-emerald-600",
                  current && "border-primary text-primary",
                  !done && !current && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <span className={cn("text-xs font-medium", !done && !current && "text-muted-foreground")}>
                {step.label}
              </span>
            </div>
            <p className="mt-1 pl-6 text-[11px] text-muted-foreground">
              {dates[index] ? formatRelative(dates[index]!) : done ? "done" : current ? "in progress" : "—"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export function TransferDetail({ data }: { data: TransferDetailData }) {
  const terminal =
    data.status === "REJECTED" || data.status === "CANCELLED"
      ? TRANSFER_STATUS[data.status].label
      : null;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Timeline"
        description={`${data.fromSite.name} → ${data.toSite.name}`}
        actions={<TransferStatusBadge status={data.status} />}
      >
        <TransferTimeline status={data.status} dates={STEP_DATES(data)} />
        {terminal && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            This transfer was {terminal.toLowerCase()} and can no longer progress.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Details">
        <DetailGrid>
          <DetailItem label="Transfer number" mono>
            {data.transferNumber}
          </DetailItem>
          <DetailItem label="Route">
            <span className="inline-flex items-center gap-1.5">
              {data.fromSite.name}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              {data.toSite.name}
            </span>
          </DetailItem>
          <DetailItem label="Storage">
            {data.fromLocation?.name ?? "Default"} → {data.toLocation?.name ?? "Default"}
          </DetailItem>
          <DetailItem label="Requested by">
            {data.requestedBy.name}
            <span className="block text-xs text-muted-foreground">{data.requestedBy.email}</span>
          </DetailItem>
          <DetailItem label="Requested">{formatDate(data.requestedAt, true)}</DetailItem>
          <DetailItem label="Approved by">
            {data.approvedBy ? (
              <>
                {data.approvedBy.name}
                <span className="block text-xs text-muted-foreground">{formatDate(data.approvedAt, true)}</span>
              </>
            ) : (
              "—"
            )}
          </DetailItem>
          <DetailItem label="Shipped">{formatDate(data.shippedAt, true)}</DetailItem>
          <DetailItem label="Expected arrival">{formatDate(data.expectedArrival)}</DetailItem>
          <DetailItem label="Actual arrival">{formatDate(data.actualArrival, true)}</DetailItem>
          <DetailItem label="Courier">{data.courier ?? "—"}</DetailItem>
          <DetailItem label="Reference">{data.referenceNumber ?? "—"}</DetailItem>
          <DetailItem label="Lines">
            {data.assets.length} asset(s) · {data.items.length} consumable line(s)
          </DetailItem>
        </DetailGrid>
        {data.notes && (
          <div className="mt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
            <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {data.notes}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Assets" description="Serialized equipment moving with this transfer.">
        {data.assets.length === 0 ? (
          <EmptyState icon={<Truck className="h-8 w-8" />} title="No assets on this transfer" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Tag</th>
                  <th className="py-2 pr-3">Asset</th>
                  <th className="py-2 pr-3">Serial</th>
                  <th className="py-2 pr-3">Condition out</th>
                  <th className="py-2 pr-3">Condition in</th>
                  <th className="py-2 pr-3">Line status</th>
                  <th className="py-2">Current</th>
                </tr>
              </thead>
              <tbody>
                {data.assets.map((asset) => (
                  <tr key={asset.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <Link href={`/assets/${asset.id}`} className="font-medium text-primary hover:underline">
                        {asset.assetTag}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{asset.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{asset.serialNumber ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {asset.conditionAtSend ? (
                        <Badge variant="outline">{asset.conditionAtSend}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {asset.conditionAtReceive ? (
                        <Badge variant="outline">{asset.conditionAtReceive}</Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={asset.status} map={LINE_STATUS} />
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {asset.currentStatus} · {asset.currentCondition}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Consumables" description="Quantity stock moving with this transfer.">
        {data.items.length === 0 ? (
          <EmptyState
            title="No consumable lines"
            description="This transfer carries only serialized assets."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Sent</th>
                  <th className="py-2 pr-3 text-right">Received</th>
                  <th className="py-2 pr-3">Unit</th>
                  <th className="py-2 pr-3">Source stock</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{line.sku}</td>
                    <td className="py-2 pr-3">{line.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{line.quantity}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {line.receivedQuantity ?? "—"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{line.unit}</td>
                    <td className="py-2 pr-3 text-xs tabular-nums">{line.availableAtSource}</td>
                    <td className="py-2">
                      <StatusBadge status={line.status} map={LINE_STATUS} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Activity" description="Audit entries recorded against this transfer.">
        {data.activity.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ul className="space-y-3">
            {data.activity.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-sm">{entry.description ?? entry.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.userName ?? "System"} · {entry.action.replace(/_/g, " ").toLowerCase()}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground" title={formatRelative(entry.createdAt)}>
                  {formatDate(entry.createdAt, true)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
