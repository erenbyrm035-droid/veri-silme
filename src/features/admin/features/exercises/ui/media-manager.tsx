"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, Star, ImageIcon, Loader2 } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import { uploadGif, addMediaByUrl, deleteMedia } from "../actions";
import type { ExerciseMediaRow } from "@/lib/database.types";

export function MediaManager({
  exerciseId,
  slug,
  media,
}: {
  exerciseId: string;
  slug: string | null;
  media: ExerciseMediaRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [url, setUrl] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("exerciseId", exerciseId);
    fd.set("slug", slug ?? exerciseId);
    startTransition(async () => {
      const res = await uploadGif(fd);
      if (!res.ok) setError(res.error ?? "Yükleme başarısız.");
      router.refresh();
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function addUrl() {
    if (!url.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addMediaByUrl({ exerciseId, url: url.trim(), media_type: "gif", is_primary: media.length === 0 });
      if (!res.ok) return setError(res.error ?? "Eklenemedi.");
      setUrl("");
      router.refresh();
    });
  }

  function del(m: ExerciseMediaRow) {
    startTransition(async () => {
      await deleteMedia({ id: m.id, exerciseId, storage_path: m.storage_path });
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ImageIcon size={16} className="text-brand" /> GIF / Medya Yönetimi
      </h3>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/gif,image/webp,image/png,image/jpeg" hidden onChange={onUpload} />
        <Button size="sm" variant="secondary" disabled={isPending} onClick={() => fileRef.current?.click()}>
          {isPending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} GIF Yükle
        </Button>
        <Badge variant="secondary">Dosya <code>{slug ?? "id"}.gif</code> olarak kaydedilir</Badge>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label>Veya URL ile ekle</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/hareket.gif" />
        </div>
        <Button size="sm" variant="outline" className="self-end" disabled={isPending} onClick={addUrl}>Ekle</Button>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {media.length === 0 && <p className="text-sm text-fg-muted">Henüz medya yok.</p>}
        {media.map((m) => (
          <div key={m.id} className="group relative overflow-hidden rounded-xl border border-ink-border bg-ink-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
            <div className="absolute right-1.5 top-1.5 flex gap-1">
              {m.is_primary && (
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand text-black"><Star size={12} /></span>
              )}
              <button onClick={() => del(m)} className="grid h-6 w-6 place-items-center rounded-lg bg-black/60 text-white hover:bg-coral">
                <Trash2 size={12} />
              </button>
            </div>
            <div className="px-2 py-1 text-[10px] uppercase text-fg-muted">{m.media_type}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-fg-muted">
        Medya tipi altyapısı <code>gif · animation · video</code> destekler; ilk sürümde yalnızca GIF aktiftir.
      </p>
    </Card>
  );
}
