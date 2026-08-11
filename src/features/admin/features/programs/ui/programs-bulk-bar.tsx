"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Trash2, Eye, EyeOff, Tags, Download } from "lucide-react";
import { Button } from "@/features/admin/components/ui/button";
import { Select } from "@/features/admin/components/ui/select";
import { Label } from "@/features/admin/components/ui/label";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { download } from "@/features/admin/features/exercises/ui/download";
import { bulkDelete, bulkSetStatus, bulkSetCategory } from "../actions";
import type { AdminProgramRow } from "@/lib/database.types";

export function ProgramsBulkBar({
  selectedIds, selectedRows, categories, onClear,
}: {
  selectedIds: string[];
  selectedRows: AdminProgramRow[];
  categories: { slug: string; name: string }[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [dialog, setDialog] = React.useState<null | "delete" | "category">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState(categories[0]?.slug ?? "");

  const count = selectedIds.length;
  if (count === 0) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, close = false) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "İşlem başarısız.");
      if (close) setDialog(null);
      onClear();
      router.refresh();
    });
  }

  return (
    <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-border bg-ink-card/95 p-3 shadow-lg backdrop-blur">
      <Button variant="ghost" size="icon" onClick={onClear} aria-label="Temizle"><X size={16} /></Button>
      <span className="text-sm font-semibold">{count} seçili</span>
      <div className="mx-1 h-5 w-px bg-ink-border" />
      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run(() => bulkSetStatus({ ids: selectedIds, status: "published" }))}><Eye size={15} /> Yayınla</Button>
      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => run(() => bulkSetStatus({ ids: selectedIds, status: "draft" }))}><EyeOff size={15} /> Taslak</Button>
      <Button variant="secondary" size="sm" disabled={isPending} onClick={() => setDialog("category")}><Tags size={15} /> Kategori</Button>
      <Button variant="secondary" size="sm" onClick={() => download(JSON.stringify(selectedRows, null, 2), `secili-programlar-${new Date().toISOString().slice(0,10)}.json`, "application/json")}><Download size={15} /> Dışa Aktar</Button>
      <Button variant="destructive" size="sm" disabled={isPending} onClick={() => setDialog("delete")}><Trash2 size={15} /> Sil</Button>
      {error && <span className="ml-auto text-xs text-coral">{error}</span>}

      <ConfirmDialog open={dialog === "delete"} onOpenChange={(o) => !o && setDialog(null)}
        title={`${count} programı sil`} description="Program günleri ve egzersizleri de silinir. Geri alınamaz."
        confirmLabel="Sil" destructive loading={isPending} error={error}
        onConfirm={() => run(() => bulkDelete({ ids: selectedIds }), true)} />

      <ConfirmDialog open={dialog === "category"} onOpenChange={(o) => !o && setDialog(null)}
        title="Toplu kategori değiştir" confirmLabel="Uygula" loading={isPending} error={error}
        onConfirm={() => run(() => bulkSetCategory({ ids: selectedIds, category }), true)}>
        <div>
          <Label>Kategori</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </Select>
        </div>
      </ConfirmDialog>
    </div>
  );
}
