import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
        danger: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
        info: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
        muted: "border-transparent bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        purple: "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
        cyan: "border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function toneToVariant(tone?: Tone | null) {
  switch (tone) {
    case "success": return "success";
    case "warning": return "warning";
    case "danger": return "danger";
    case "info": return "info";
    case "muted": return "muted";
    case "purple": return "purple";
    case "cyan": return "cyan";
    default: return "secondary";
  }
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants, toneToVariant };
