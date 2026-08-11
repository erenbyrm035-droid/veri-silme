"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "../ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { Breadcrumb } from "./breadcrumb";
import { UserMenu } from "./user-menu";
import { NotificationButton } from "./notification-button";
import type { AdminRole } from "@/lib/database.types";

export function AdminTopbar({
  name,
  email,
  avatarUrl,
  role,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  role: AdminRole | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-ink-border bg-ink/80 px-4 backdrop-blur sm:px-6">
      {/* Mobil menü */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger className="grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:bg-fg/5 hover:text-fg lg:hidden">
          <Menu size={20} />
        </SheetTrigger>
        <SheetContent side="left">
          <SheetTitle className="sr-only">Menü</SheetTitle>
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className="flex h-16 items-center gap-2.5 border-b border-ink-border px-5 font-bold"
          >
            <span className="grid h-8 w-8 -rotate-6 place-items-center rounded-lg bg-brand font-black text-black">
              <span className="rotate-6">V</span>
            </span>
            Viva <span className="text-fg-muted">Admin</span>
          </Link>
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <Breadcrumb />

      <div className="ml-auto flex items-center gap-1.5">
        <NotificationButton />
        <ThemeToggle />
        <div className="mx-1 h-6 w-px bg-ink-border" />
        <UserMenu name={name} email={email} avatarUrl={avatarUrl} role={role} />
      </div>
    </header>
  );
}
