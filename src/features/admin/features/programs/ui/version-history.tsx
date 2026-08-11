"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { History, RotateCcw } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { restoreVersion } from "../actions";
import type { ProgramVersion } from "@/lib/database.types";

function fmt(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function VersionHistory({ programId, versions }: { programId: string; versions: ProgramVersion[] }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [restoreId, setRestoreId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function restore(versionId: string) {
    setError(null);
    startTransition(async () => {
      const res = await restoreVersion({ programId, versionId });
      if (!res.ok) return setError(res.error ?? "Geri yüklenemedi.");
      setRestoreId(null); router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><History size={16} className="text-brand" /> Sürüm Geçmişi</h3>
      {error && <p className="text-sm text-coral">{error}</p>}
      {versions.length === 0 ? (
        <p className="text-sm text-fg-muted">Henüz sürüm yok. Kaydettikçe otomatik oluşur.</p>
      ) : (
        <ol className="space-y-2">
          {versions.map((v) => {
            const snap = v.snapshot as { program?: { name?: string } };
            return (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-border bg-ink-soft/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">v{v.version} · {snap?.program?.name ?? "—"}</p>
                  <p className="text-xs text-fg-muted">{v.changed_by_name ?? "Bilinmiyor"} · {fmt(v.created_at)}{v.change_note ? ` · ${v.change_note}` : ""}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRestoreId(v.id)} disabled={isPending}><RotateCcw size={14} /> Geri Yükle</Button>
              </li>
            );
          })}
        </ol>
      )}
      <ConfirmDialog open={!!restoreId} onOpenChange={(o) => !o && setRestoreId(null)}
        title="Bu sürüme geri dön" description="Mevcut program (gün + egzersizler) yeni yedek olarak saklanır, seçili sürüm geri yüklenir."
        confirmLabel="Geri Yükle" loading={isPending} error={error}
        onConfirm={() => restoreId && restore(restoreId)} />
    </Card>
  );
}
