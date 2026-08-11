"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { labelForPath } from "../../config/nav";

/** Basit breadcrumb: Admin › <bölüm>. */
export function Breadcrumb() {
  const pathname = usePathname();
  const isRoot = pathname === "/admin";
  const current = labelForPath(pathname);

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="breadcrumb">
      <Link
        href="/admin"
        className={isRoot ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"}
      >
        Admin
      </Link>
      {!isRoot && (
        <>
          <ChevronRight size={14} className="text-fg-muted/60" />
          <span className="font-semibold text-fg">{current}</span>
        </>
      )}
    </nav>
  );
}
