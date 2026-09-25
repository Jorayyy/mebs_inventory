import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { SupplierForm } from "@/components/suppliers/supplier-form";

export const metadata: Metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  await requirePermissionPage("/my", PERMISSIONS.SUPPLIERS_MANAGE);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        breadcrumb={
          <Link href="/suppliers" className="inline-flex items-center gap-1 hover:text-foreground">
            <ChevronLeft className="h-3 w-3" /> Suppliers
          </Link>
        }
        title="New supplier"
        description="Contact and commercial details used across purchase orders, receipts and stock items."
      />
      <SupplierForm />
    </div>
  );
}
