"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CommandPalette } from "@/components/layout/command-palette";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ROLE_DEFINITIONS, type RoleKey } from "@/lib/permissions";

export function Shell({
  user,
  unread,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: string; permissions: string[] };
  unread: number;
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const roleLabel = ROLE_DEFINITIONS[user.role as RoleKey]?.name ?? user.role;

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden lg:block">
        <div className="fixed inset-y-0 left-0">
          <Sidebar permissions={user.permissions} roleLabel={roleLabel} />
        </div>
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[260px] p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar
            permissions={user.permissions}
            roleLabel={roleLabel}
            onNavigate={() => setMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-[236px]">
        <Header
          user={user}
          unread={unread}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMenu={() => setMenuOpen(true)}
        />
        <main className="flex-1 px-3 py-4 lg:px-5">{children}</main>
      </div>

      <CommandPalette open={searchOpen} setOpen={setSearchOpen} />
    </div>
  );
}
