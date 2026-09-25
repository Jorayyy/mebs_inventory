import { Badge, toneToVariant } from "@/components/ui/badge";
import {
  ASSET_CONDITION,
  ASSET_STATUS,
  ASSIGNMENT_STATUS,
  MAINTENANCE_STATUS,
  TRANSFER_STATUS,
  type Tone,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  AssetCondition,
  AssetStatus,
  AssignmentStatus,
  MaintenanceStatus,
  TransferStatus,
} from "@/generated/prisma";

const TONE_CLASS: Record<Tone, string> = {
  success: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  muted: "border-transparent bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  purple: "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  cyan: "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  default: "border-transparent bg-primary text-primary-foreground",
};

export function StatusBadge({
  status,
  map,
  className,
}: {
  status: string;
  map: Record<string, { label: string; tone: Tone }>;
  className?: string;
}) {
  const entry = map[status] ?? { label: status, tone: "muted" as Tone };
  return (
    <Badge className={cn(TONE_CLASS[entry.tone], className)}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          entry.tone === "muted" ? "bg-current opacity-50" : "bg-current"
        )}
      />
      {entry.label}
    </Badge>
  );
}

export const AssetStatusBadge = ({ status, className }: { status: AssetStatus; className?: string }) => (
  <StatusBadge status={status} map={ASSET_STATUS} className={className} />
);

export const ConditionBadge = ({ condition, className }: { condition: AssetCondition; className?: string }) => (
  <StatusBadge status={condition} map={ASSET_CONDITION} className={className} />
);

export const AssignmentStatusBadge = ({
  status,
  className,
}: {
  status: AssignmentStatus;
  className?: string;
}) => <StatusBadge status={status} map={ASSIGNMENT_STATUS} className={className} />;

export const TransferStatusBadge = ({ status, className }: { status: TransferStatus; className?: string }) => (
  <StatusBadge status={status} map={TRANSFER_STATUS} className={className} />
);

export const MaintenanceStatusBadge = ({
  status,
  className,
}: {
  status: MaintenanceStatus;
  className?: string;
}) => <StatusBadge status={status} map={MAINTENANCE_STATUS} className={className} />;

export { toneToVariant };
