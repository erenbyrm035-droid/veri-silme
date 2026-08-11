"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Ban, ShieldCheck, Power, KeyRound, Trash2 } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Label } from "@/features/admin/components/ui/label";
import { AccountStatusBadge } from "./badges";
import { ConfirmDialog } from "./confirm-dialog";
import {
  banUser,
  unbanUser,
  setActive,
  sendPasswordReset,
  deleteUser,
  type ActionResult,
} from "../actions";
import type { AdminUserRow } from "@/lib/database.types";

export function UserAccountCard({
  user,
  canBan,
  canDelete,
}: {
  user: AdminUserRow;
  canBan: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [banReason, setBanReason] = React.useState("");
  const [dialog, setDialog] = React.useState<null | "ban" | "delete">(null);

  function run(fn: () => Promise<ActionResult>, opts?: { close?: boolean; success?: string }) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      if (opts?.close) setDialog(null);
      if (opts?.success) setNotice(opts.success);
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert size={16} className="text-brand" /> Hesap
        </h3>
        <AccountStatusBadge isBanned={user.is_banned} isActive={user.is_active} />
      </div>

      {user.is_banned && user.ban_reason && (
        <p className="mt-3 rounded-lg bg-coral/10 px-3 py-2 text-xs text-coral">
          Ban nedeni: {user.ban_reason}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-400">{notice}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {canBan &&
          (user.is_banned ? (
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run(() => unbanUser({ userId: user.id }))}>
              <ShieldCheck size={15} /> Ban Kaldır
            </Button>
          ) : (
            <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setDialog("ban")}>
              <Ban size={15} /> Banla
            </Button>
          ))}

        {canBan && (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => run(() => setActive({ userId: user.id, active: !user.is_active }))}
          >
            <Power size={15} /> {user.is_active ? "Pasife Al" : "Aktifleştir"}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            run(() => sendPasswordReset({ userId: user.id }), { success: "Şifre sıfırlama maili gönderildi." })
          }
        >
          <KeyRound size={15} /> Şifre Sıfırlama Maili
        </Button>

        {canDelete && (
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setDialog("delete")}>
            <Trash2 size={15} /> Kullanıcıyı Sil
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "ban"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Kullanıcıyı banla"
        confirmLabel="Banla"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run(() => banUser({ userId: user.id, reason: banReason || undefined }), { close: true })}
      >
        <div>
          <Label>Ban nedeni (opsiyonel)</Label>
          <Textarea
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Örn. Topluluk kurallarını ihlal"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Kullanıcıyı sil"
        description="Bu işlem geri alınamaz. Hesap ve tüm verileri kalıcı olarak silinir."
        confirmLabel="Kalıcı olarak sil"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run(() => deleteUser({ userId: user.id }), { close: true })}
      />
    </Card>
  );
}
