"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV, isActive } from "@/lib/nav";

// 5 birincil sekme + Menü. Liste `lib/nav.ts`'teki `primary` bayrağından gelir;
// Akış/Keşfet/Egzersiz/Postür/Başarı/Profil/Ayarlar → /menu.
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="pb-nav-safe px-safe fixed inset-x-0 bottom-0 z-40 border-t border-ink-border bg-ink/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-1 pt-1.5">
        {BOTTOM_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 text-[11px] font-medium transition-colors",
              isActive(item, pathname) ? "text-brand" : "text-fg-muted"
            )}
          >
            <item.icon size={22} className="shrink-0" />
            <span className="w-full truncate text-center leading-none">
              {item.short ?? item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
