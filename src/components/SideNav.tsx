"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, Settings, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { SIDE_NAV, isActive } from "@/lib/nav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";

const LINK = "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors";
const ON = "bg-brand/10 text-brand";
const OFF = "text-fg-muted hover:bg-fg/5 hover:text-fg";

export function SideNav({ isAdmin, userId }: { isAdmin: boolean; userId: string }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-border p-4 md:flex">
      <div className="mb-8 flex items-center justify-between px-2">
        <Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-bold">
          <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl rounded-br-[3px] bg-brand font-black text-black">
            <span className="rotate-6">V</span>
          </span>
          <span>Viva</span>
        </Link>
        <NotificationBell userId={userId} />
      </div>

      <nav className="no-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto">
        {SIDE_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(LINK, isActive(item, pathname) ? ON : OFF)}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        ))}

        {isAdmin && (
          <Link href="/admin" className={cn(LINK, "mt-2", pathname.startsWith("/admin") ? ON : OFF)}>
            <Shield size={18} />
            Admin Panel
          </Link>
        )}
        <Link href="/profile" className={cn(LINK, "mt-2", pathname.startsWith("/profile") ? ON : OFF)}>
          <User size={18} />
          Profil
        </Link>
        <Link href="/settings" className={cn(LINK, pathname.startsWith("/settings") ? ON : OFF)}>
          <Settings size={18} />
          Ayarlar
        </Link>
      </nav>

      <div className="flex items-center gap-2 pt-2">
        <form action="/auth/signout" method="post" className="flex-1">
          <button type="submit" className={cn(LINK, "w-full", OFF)}>
            <LogOut size={18} />
            Çıkış Yap
          </button>
        </form>
        <ThemeToggle />
      </div>
    </aside>
  );
}
