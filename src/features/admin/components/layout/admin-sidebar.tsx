import Link from "next/link";
import { SidebarNav } from "./sidebar-nav";
import type { AdminRole } from "@/lib/database.types";

/** Masaüstü sabit sidebar. */
export function AdminSidebar({ role }: { role: AdminRole | null }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-border bg-ink/60 backdrop-blur lg:flex">
      <Link
        href="/admin"
        className="flex h-16 items-center gap-2.5 border-b border-ink-border px-5 text-lg font-bold"
      >
        <span className="grid h-9 w-9 -rotate-6 place-items-center rounded-xl rounded-br-[3px] bg-brand font-black text-black">
          <span className="rotate-6">V</span>
        </span>
        <span>
          Viva <span className="text-fg-muted">Admin</span>
        </span>
      </Link>
      <SidebarNav role={role} />
      <div className="border-t border-ink-border p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-fg-muted hover:bg-fg/5 hover:text-fg"
        >
          ← Uygulamaya dön
        </Link>
      </div>
    </aside>
  );
}
