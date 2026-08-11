"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/features/admin/components/ui/avatar";
import { Checkbox } from "@/features/admin/components/ui/checkbox";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { RoleBadge, PremiumBadge, AccountStatusBadge } from "./badges";
import { UserRowActions } from "./user-row-actions";
import { BulkActionsBar } from "./bulk-actions-bar";
import { formatDate, timeAgo, initials } from "./format";
import type { AdminRole, AdminUserRow } from "@/lib/database.types";

export function UsersTable({
  rows,
  actorRole,
  actorId,
}: {
  rows: AdminUserRow[];
  actorRole: AdminRole | null;
  actorId: string;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Sayfa değişince (rows referansı) seçimi geçerli id'lerle sınırla.
  const rowIds = React.useMemo(() => rows.map((r) => r.id), [rows]);
  React.useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => rowIds.includes(id) && next.add(id));
      return next.size === prev.size ? prev : next;
    });
  }, [rowIds]);

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const someChecked = selected.size > 0 && !allChecked;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rowIds));
  }
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Kullanıcı bulunamadı"
        description="Arama veya filtre kriterlerinize uyan kullanıcı yok."
      />
    );
  }

  return (
    <div className="space-y-3">
      <BulkActionsBar
        selectedIds={[...selected]}
        actorRole={actorRole}
        onClear={() => setSelected(new Set())}
      />

      <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allChecked}
                  indeterminate={someChecked}
                  onCheckedChange={toggleAll}
                  aria-label="Tümünü seç"
                />
              </th>
              <th className="px-2 py-3 font-medium">Kullanıcı</th>
              <th className="px-2 py-3 font-medium">Premium</th>
              <th className="px-2 py-3 font-medium">Rol</th>
              <th className="px-2 py-3 font-medium">Kayıt</th>
              <th className="px-2 py-3 font-medium">Son Giriş</th>
              <th className="px-2 py-3 font-medium">Durum</th>
              <th className="w-12 px-4 py-3 text-right font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const checked = selected.has(u.id);
              return (
                <tr
                  key={u.id}
                  className={`border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02] ${
                    checked ? "bg-brand/[0.04]" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(u.id)} aria-label="Seç" />
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 group">
                      <Avatar className="h-9 w-9">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} alt="" />}
                        <AvatarFallback>{initials(u.full_name, u.email)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium group-hover:text-brand">
                          {u.full_name ?? "İsimsiz kullanıcı"}
                        </p>
                        <p className="truncate text-xs text-fg-muted">{u.email ?? "—"}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-2 py-3"><PremiumBadge isPremium={u.is_premium} /></td>
                  <td className="px-2 py-3"><RoleBadge role={u.admin_role} /></td>
                  <td className="px-2 py-3 text-fg-muted">{formatDate(u.registered_at ?? u.created_at)}</td>
                  <td className="px-2 py-3 text-fg-muted">{timeAgo(u.last_sign_in_at)}</td>
                  <td className="px-2 py-3">
                    <AccountStatusBadge isBanned={u.is_banned} isActive={u.is_active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <UserRowActions user={u} actorRole={actorRole} actorId={actorId} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
