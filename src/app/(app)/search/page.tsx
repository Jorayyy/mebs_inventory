import type { Metadata } from "next";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { str } from "@/lib/query";
import { globalSearch } from "@/actions/search";
import { PageHeader } from "@/components/shared/page-header";
import { SearchView } from "@/components/search/search-view";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requirePermissionPage("/my", PERMISSIONS.SEARCH_GLOBAL);
  const q = str(searchParams, "q");
  const results = q && q.trim().length >= 2 ? await globalSearch(q) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Search & Scan"
        description="One box for assets, stock, people, transfers and suppliers — or scan a QR label to jump straight to a record."
      />
      <SearchView initialQuery={q} initialResults={results} />
    </div>
  );
}
