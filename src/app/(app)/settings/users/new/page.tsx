import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requirePermissionPage } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { UserForm } from "@/components/users/user-form";

export const metadata: Metadata = { title: "New user" };

export default async function NewUserPage() {
  await requirePermissionPage("/my", PERMISSIONS.USERS_MANAGE);

  const sites = await prisma.site.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="New user"
        breadcrumb={
          <Link href="/settings/users" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Users &amp; roles
          </Link>
        }
        description="Create an account, assign a role and limit it to the sites they need."
      />
      <UserForm sites={sites} />
    </div>
  );
}
