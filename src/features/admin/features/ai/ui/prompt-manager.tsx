"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, Plus, Star } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { createPromptVersion, activatePrompt, deletePromptVersion } from "../actions";
import type { AiPromptVersion } from "@/lib/database.types";

function fmt(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function PromptManager({ versions }: { versions: AiPromptVersion[] }) {
  const router = useRouter();
  const active = versions.find((v) => v.is_active);
  const [content, setContent] = React.useState(active?.content ?? "");
  const [notes, setNotes] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [del, setDel] = React.useState<string | null>(null);

  function save(activate: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await createPromptVersion({ content, notes, activate });
      if (!res.ok) return setError(res.error ?? "Kaydedilemedi.");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Sistem Promptu Düzenle</h3>
        <div>
          <Label>İçerik</Label>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[240px] font-mono text-xs" />
        </div>
        <div>
          <Label>Sürüm notu</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Örn. Güvenlik uyarıları güçlendirildi" />
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" disabled={isPending} onClick={() => save(true)}><Check size={15} /> Kaydet & Aktifleştir</Button>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => save(false)}><Plus size={15} /> Taslak Sürüm</Button>
        </div>
        <p className="text-xs text-fg-muted">Yeni kayıt her zaman yeni bir sürüm oluşturur; eski sürümlere geri dönebilirsin.</p>
      </Card>

      <Card className="space-y-3 p-5">
        <h3 className="text-sm font-semibold">Sürümler ({versions.length})</h3>
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.id} className={`rounded-xl border p-3 ${v.is_active ? "border-brand bg-brand/5" : "border-ink-border"}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium">
                  v{v.version} {v.is_active && <Badge variant="default"><Star size={11} className="mr-1" /> Aktif</Badge>}
                </span>
                <div className="flex gap-1">
                  {!v.is_active && <button onClick={() => startTransition(async () => { await activatePrompt(v.id); router.refresh(); })} className="rounded p-1 text-fg-muted hover:text-brand" aria-label="Aktifleştir"><Check size={14} /></button>}
                  {!v.is_active && <button onClick={() => setDel(v.id)} className="rounded p-1 text-fg-muted hover:text-coral" aria-label="Sil"><Trash2 size={14} /></button>}
                </div>
              </div>
              {v.notes && <p className="mt-1 text-xs text-fg-muted">{v.notes}</p>}
              <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{v.content}</p>
              <p className="mt-1 text-[10px] text-fg-muted">{fmt(v.created_at)}</p>
            </div>
          ))}
          {versions.length === 0 && <p className="text-sm text-fg-muted">Henüz sürüm yok.</p>}
        </div>
      </Card>

      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Sürümü sil" description="Bu prompt sürümü kalıcı olarak silinecek." confirmLabel="Sil" destructive loading={isPending}
        onConfirm={() => del && startTransition(async () => { await deletePromptVersion(del); setDel(null); router.refresh(); })} />
    </div>
  );
}
