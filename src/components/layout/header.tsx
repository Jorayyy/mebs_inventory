"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun, UserRound, Bell, Search, Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/utils";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <Button variant="ghost" size="icon" aria-label="Toggle theme" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export function UserMenu({
  user,
}: {
  user: { name?: string | null; email?: string | null; role: string };
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 gap-2 px-2">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-[10px]">{initials(user.name ?? "")}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm md:inline">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{user.role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/my")}>
          <UserRound /> My profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/notifications")}>
          <Bell /> Notifications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut({ callbackUrl: "/login" });
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header({
  user,
  onOpenSearch,
  onOpenMenu,
  unread,
}: {
  user: { name?: string | null; email?: string | null; role: string };
  onOpenSearch: () => void;
  onOpenMenu: () => void;
  unread: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-13 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Open menu">
        <Menu className="h-4 w-4" />
      </Button>

      <button
        onClick={onOpenSearch}
        className="flex h-8 flex-1 items-center gap-2 rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:max-w-sm"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="truncate">Search assets, serials, employees…</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Link href="/notifications" aria-label="Notifications">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </Link>
        <ThemeToggle />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
