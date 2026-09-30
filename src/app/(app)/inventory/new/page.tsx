import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Laptop, Boxes, Inbox, PackageOpen, ArrowLeftRight } from "lucide-react";
import { requireUser, can, canAny } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewInventoryItemButton } from "@/components/inventory/inventory-form";
import { NewReceiptButton } from "@/components/inventory/receipt-form";

export const metadata: Metadata = { title: "Add inventory" };

type Choice = {
  href?: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: boolean;
  action?: React.ReactNode;
  footnotes: string[];
};

export default async function AddInventoryPage() {
  const user = await requireUser();

  const canAsset = can(user, PERMISSIONS.ASSETS_CREATE);
  const canReceive = can(user, PERMISSIONS.INVENTORY_RECEIVE);
  const canAdjust = can(user, PERMISSIONS.INVENTORY_ADJUST);

  if (!canAny(user, [PERMISSIONS.ASSETS_CREATE, PERMISSIONS.INVENTORY_RECEIVE, PERMISSIONS.INVENTORY_ADJUST])) {
    redirect("/inventory");
  }

  const choices: Choice[] = [
    {
      href: "/assets/new",
      title: "Trackable asset",
      eyebrow: "Serialised",
      description:
        "A single item you follow for its whole life: tag, serial number, custody, transfer, maintenance and disposal.",
      icon: Laptop,
      permission: canAsset,
      footnotes: ["Gets an asset tag", "Assigned to a person", "Moves through every lifecycle step"],
    },
    {
      title: "Stock item",
      eyebrow: "Consumable",
      description:
        "Bulk supplies you count and reorder — paper, toner, cables, licences. Quantities move in and out instead of being assigned.",
      icon: Boxes,
      permission: canAdjust || canReceive,
      action: canAdjust ? (
        <NewInventoryItemButton label="New stock item" />
      ) : canReceive ? (
        <NewReceiptButton label="New stock receipt" />
      ) : undefined,
      footnotes: ["Tracked by quantity", "Reorder level alerts", "Received through stock receipts"],
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        breadcrumb={
          <Link href="/inventory" className="inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="h-3 w-3" /> Stock
          </Link>
        }
        title="Add inventory"
        description="Pick what you are adding. Everything downstream — receiving, assignment, transfer, maintenance, disposal — follows from this choice."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {choices.map((choice) => {
          const Icon = choice.icon;
          const allowed = choice.permission;
          const body = (
            <div
              className={
                "group flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-colors " +
                (allowed && choice.href ? "hover:border-primary hover:bg-accent/40 " : "") +
                (allowed ? "" : "opacity-60")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/50">
                  <Icon className="h-5 w-5 text-primary" />
                </span>
                <Badge variant="outline">{choice.eyebrow}</Badge>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold">{choice.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">{choice.description}</p>
              </div>
              <ul className="mt-auto space-y-1 border-t pt-3 text-xs text-muted-foreground">
                {choice.footnotes.map((note) => (
                  <li key={note} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-muted-foreground" />
                    {note}
                  </li>
                ))}
              </ul>
              <div className="pt-1">
                {!allowed ? (
                  <span className="text-xs text-muted-foreground">You do not have permission.</span>
                ) : choice.href ? (
                  <Button size="sm" asChild className="w-full">
                    <Link href={choice.href}>Continue</Link>
                  </Button>
                ) : (
                  choice.action
                )}
              </div>
            </div>
          );

          return choice.href && allowed ? (
            <Link key={choice.title} href={choice.href} className="block h-full">
              {body}
            </Link>
          ) : (
            <div key={choice.title} className="h-full">
              {body}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/30 p-4">
          <PackageOpen className="mb-2 h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium">Already delivered?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Record it as a receipt so cost and supplier stay attached to the stock.
          </p>
          <Button variant="ghost" size="sm" className="mt-2 h-7 px-2" asChild>
            <Link href="/inventory/receive">
              <Inbox /> Open receiving
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4">
          <ArrowLeftRight className="mb-2 h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium">Moved something already?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Every receive, issue, transfer and adjustment lands in the transaction log.
          </p>
          <Button variant="ghost" size="sm" className="mt-2 h-7 px-2" asChild>
            <Link href="/inventory/transactions">
              <ArrowLeftRight /> View transactions
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4">
          <Boxes className="mb-2 h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium">Running low?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Items at or below their reorder level are collected in one list.
          </p>
          <Button variant="ghost" size="sm" className="mt-2 h-7 px-2" asChild>
            <Link href="/inventory?low=yes">
              <Boxes /> Low stock
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
