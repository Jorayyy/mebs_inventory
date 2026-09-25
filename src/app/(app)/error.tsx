"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const message = error?.message ?? "";
  const denied =
    /permission|not allowed|forbidden|sign in|session/i.test(message) && !/fetch|network/i.test(message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-lg font-semibold">{denied ? "You don't have access" : "Something went wrong"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {denied
            ? "Your role does not include the permission required for this page. Ask an administrator if you need it."
            : message || "An unexpected error occurred while loading this page."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft /> Dashboard
            </Link>
          </Button>
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
        </div>
        {error.digest ? (
          <p className="mt-4 text-xs text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
