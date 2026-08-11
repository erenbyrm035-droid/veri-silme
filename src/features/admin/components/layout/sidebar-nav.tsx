"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "../../config/nav";
import { canAccess } from "../../config/roles";
import { Badge } from "../ui/badge";
import type { AdminRole } from "@/lib/database.types";

/** Sidebar navigasyon listesi (masaüstü + mobil ortak). */
export function SidebarNav({
  role,
  onNavigate,
}: {
  role: AdminRole | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((i) => canAccess(role, i.roles));
        if (items.length === 0) return null;
        return (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-fg-muted/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "text-fg-muted hover:bg-fg/5 hover:text-fg"
                    )}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.soon && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[9px]">
                        yakında
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
