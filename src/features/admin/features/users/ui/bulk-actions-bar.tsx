"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Crown, CircleSlash, Ban, ShieldCheck, Trash2, X } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { can } from "../permissions";
import type { AdminRole } from "@/lib/database.types";
import { bulkAction } from "../actions";

type BulkKind = "premium_on" | "premium_off" | "ban" | "unban" | "delete";

export function BulkActionsBar({
  selectedIds,
  actorRole,
  onClear,
}: {
  selectedIds: string[];
  actorRole: AdminRole | null;
  onClear: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<null | BulkKind>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const count = selectedIds.length;
  const mayPremium = can(actorRole, "premium");
  const mayBan = can(actorRole, "ban");
  const mayDelete = can(actorRole, "delete");

  function run(kind: BulkKind, confirm = false) {
    setError(null);
    startTransition(async () => {
      const res = await bulkAction({ userIds: selectedIds, kind });
      if (!res.ok) {
        setError(res.error ?? "İşlem başarısız.");
        return;
      }
      if (confirm) setDialog(null);
      if (res.skipped && res.skipped > 0) {
        setNotice(`${res.skipped} kullanıcı yetki/koşul nedeniyle atlandı.`);
      } else {
        setNotice(null);
      }
      onClear();
      router.refresh();
    });
  }

  if (count === 0) return null;

  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-border bg-ink-card/95 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 pr-1">
        <Button variant="ghost" size="icon" onClick={onClear} aria-label="Seçimi temizle">
          <X size={16} />
        </Button>
        <span className="text-sm font-semibold">{count} seçili</span>
      </div>
      <div className="mx-1 h-5 w-px bg-ink-border" />

      {mayPremium && (
        <>
          <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run("premium_on")}>
            <Crown size={15} /> Premium Yap
          </Button>
          <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run("premium_off")}>
            <CircleSlash size={15} /> Premium Kaldır
          </Button>
        </>
      )}
      {mayBan && (
        <>
          <Button variant="secondary" size="sm" disabled={isPending} onClick={() => setDialog("ban")}>
            <Ban size={15} /> Banla
          </Button>
          <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run("unban")}>
            <ShieldCheck size={15} /> Ban Kaldır
          </Button>
        </>
      )}
      {mayDelete && (
        <Button variant="destructive" size="sm" disabled={isPending} onClick={() => setDialog("delete")}>
          <Trash2 size={15} /> Sil
        </Button>
      )}

      {notice && <span className="ml-auto text-xs text-amber-400">{notice}</span>}
      {error && <span className="ml-auto text-xs text-coral">{error}</span>}

      <ConfirmDialog
        open={dialog === "ban"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${count} kullanıcıyı banla`}
        description="Seçili kullanıcılar giriş yapamayacak."
        confirmLabel="Banla"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run("ban", true)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${count} kullanıcıyı sil`}
        description="Bu işlem geri alınamaz. Seçili hesaplar ve tüm verileri kalıcı olarak silinir."
        confirmLabel="Kalıcı olarak sil"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run("delete", true)}
      />
    </div>
  );
}
