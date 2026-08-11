"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldHalf } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Label } from "@/features/admin/components/ui/label";
import { Select } from "@/features/admin/components/ui/select";
import { RoleBadge } from "./badges";
import { setRole } from "../actions";
import type { AdminRole, AdminUserRow } from "@/lib/database.types";

export function UserRoleCard({
  user,
  canManage,
}: {
  user: AdminUserRow;
  canManage: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState<AdminRole | "">(user.admin_role ?? "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const dirty = value !== (user.admin_role ?? "");

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setRole({ userId: user.id, role: value });
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldHalf size={16} className="text-brand" /> Rol
        </h3>
        <RoleBadge role={user.admin_role} />
      </div>

      {canManage ? (
        <>
          <div className="mt-4">
            <Label>Rol değiştir</Label>
            <Select value={value} onChange={(e) => setValue(e.target.value as AdminRole | "")}>
              <option value="">Normal Kullanıcı</option>
              <option value="editor">Editör</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Süper Admin</option>
            </Select>
          </div>
          {error && <p className="mt-3 text-sm text-coral">{error}</p>}
          <Button size="sm" className="mt-4" disabled={!dirty || isPending} onClick={save}>
            {isPending ? "Kaydediliyor…" : "Rolü Güncelle"}
          </Button>
        </>
      ) : (
        <p className="mt-4 text-xs text-fg-muted">
          Yalnızca Süper Admin rol değiştirebilir.
        </p>
      )}
    </Card>
  );
}
