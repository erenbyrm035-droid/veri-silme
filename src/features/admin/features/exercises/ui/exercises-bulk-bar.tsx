"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, Tags, Dumbbell, Eye, EyeOff, Images, Download } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import { Select } from "@/features/admin/components/ui/select";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { CATEGORY_LABELS, CATEGORY_VALUES } from "../constants";
import {
  bulkDelete,
  bulkSetCategory,
  bulkSetMuscleGroup,
  bulkSetStatus,
  autoMatchGifs,
} from "../actions";
import { download } from "./download";
import type { AdminExerciseRow, ExerciseCategory } from "@/lib/database.types";

export function ExercisesBulkBar({
  selectedIds,
  selectedRows,
  onClear,
}: {
  selectedIds: string[];
  selectedRows: AdminExerciseRow[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<null | "delete" | "category" | "muscle" | "gif">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<ExerciseCategory>("compound");
  const [muscleGroup, setMuscleGroup] = React.useState("");

  const count = selectedIds.length;
  if (count === 0) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, opts?: { close?: boolean; notice?: string }) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      if (opts?.close) setDialog(null);
      if (opts?.notice) setNotice(opts.notice);
      onClear();
      router.refresh();
    });
  }

  function exportSelected() {
    download(
      JSON.stringify(selectedRows, null, 2),
      `secili-egzersizler-${new Date().toISOString().slice(0, 10)}.json`,
      "application/json"
    );
  }

  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-border bg-ink-card/95 p-3 shadow-lg backdrop-blur">
      <Button variant="ghost" size="icon" onClick={onClear} aria-label="Seçimi temizle">
        <X size={16} />
      </Button>
      <span className="text-sm font-semibold">{count} seçili</span>
      <div className="mx-1 h-5 w-px bg-ink-border" />

      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run(() => bulkSetStatus({ ids: selectedIds, status: "published" }))}>
        <Eye size={15} /> Yayınla
      </Button>
      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run(() => bulkSetStatus({ ids: selectedIds, status: "draft" }))}>
        <EyeOff size={15} /> Taslak
      </Button>
      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => setDialog("category")}>
        <Tags size={15} /> Kategori
      </Button>
      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => setDialog("muscle")}>
        <Dumbbell size={15} /> Kas Grubu
      </Button>
      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => setDialog("gif")}>
        <Images size={15} /> GIF Ata
      </Button>
      <Button variant="secondary" size="sm" onClick={exportSelected}>
        <Download size={15} /> Dışa Aktar
      </Button>
      <Button variant="destructive" size="sm" disabled={isPending} onClick={() => setDialog("delete")}>
        <Trash2 size={15} /> Sil
      </Button>

      {notice && <span className="ml-auto text-xs text-emerald-400">{notice}</span>}
      {error && <span className="ml-auto text-xs text-coral">{error}</span>}

      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={`${count} egzersizi sil`}
        description="Bu işlem geri alınamaz."
        confirmLabel="Sil"
        destructive
        loading={isPending}
        error={error}
        onConfirm={() => run(() => bulkDelete({ ids: selectedIds }), { close: true })}
      />

      <ConfirmDialog
        open={dialog === "category"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Toplu kategori değiştir"
        confirmLabel="Uygula"
        loading={isPending}
        error={error}
        onConfirm={() => run(() => bulkSetCategory({ ids: selectedIds, category }), { close: true })}
      >
        <div>
          <Label>Kategori</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExerciseCategory)}>
            {CATEGORY_VALUES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </Select>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "muscle"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Toplu kas grubu değiştir"
        confirmLabel="Uygula"
        loading={isPending}
        error={error}
        onConfirm={() => run(() => bulkSetMuscleGroup({ ids: selectedIds, muscle_group: muscleGroup.trim() }), { close: true })}
      >
        <div>
          <Label>Ana kas grubu</Label>
          <Input value={muscleGroup} onChange={(e) => setMuscleGroup(e.target.value)} placeholder="Örn. Göğüs" />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "gif"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Otomatik GIF ata"
        description="Bucket'taki slug adlı GIF'ler, görseli olmayan egzersizlere otomatik atanır (tüm kütüphane)."
        confirmLabel="Eşleştir"
        loading={isPending}
        error={error}
        onConfirm={() =>
          run(
            async () => {
              const res = await autoMatchGifs();
              return res;
            },
            { close: true, notice: "GIF eşleştirme tamamlandı." }
          )
        }
      />
    </div>
  );
}
