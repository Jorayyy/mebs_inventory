"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { buildQuery } from "@/lib/query";

/** URL-synced from/to date pair used by the transfer, maintenance and assignment lists. */
export function DateRangeFilter({
  fromParam,
  toParam,
  label,
  fromValue = "",
  toValue = "",
}: {
  fromParam: string;
  toParam: string;
  label: string;
  fromValue?: string;
  toValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = (key: string, value: string) => {
    router.replace(
      `${pathname}${buildQuery(Object.fromEntries(searchParams), { [key]: value || undefined, page: undefined })}`,
      { scroll: false }
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="date"
        value={fromValue}
        onChange={(e) => update(fromParam, e.target.value)}
        className="h-8 w-[150px] text-xs"
        aria-label={`${label} from`}
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        type="date"
        value={toValue}
        onChange={(e) => update(toParam, e.target.value)}
        className="h-8 w-[150px] text-xs"
        aria-label={`${label} to`}
      />
    </div>
  );
}
