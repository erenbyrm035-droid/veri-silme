"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadToStorage } from "@/lib/storage/upload";
import { Upload, Loader2, Check, X } from "lucide-react";
import type { PostureView } from "@/lib/database.types";

export interface UploadedPhotos {
  front?: string;
  side?: string;
  back?: string;
}

const SLOTS: { view: PostureView; label: string; hint: string }[] = [
  { view: "front", label: "Ön", hint: "Karşıdan, kollar yanda" },
  { view: "side", label: "Yan", hint: "Profilden, doğal duruş" },
  { view: "back", label: "Arka", hint: "Sırt kameraya dönük" },
];

/**
 * Ön / Yan / Arka postür fotoğrafı yükleme.
 * Dosyalar private `posture-photos` bucket'ına `userId/...` yoluna yüklenir.
 * Yüklenen depolama yolları üst bileşene bildirilir.
 */
export function PostureUploader({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: UploadedPhotos;
  onChange: (photos: UploadedPhotos) => void;
}) {
  const supabase = createClient();
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<PostureView | null>(null);
  // Yükleme hatası ESKİDEN YUTULUYORDU (`if (!error)` vardı ama `else` yoktu).
  // Kullanıcı fotoğrafın yüklenmediğini hiç görmüyor, sadece "hiçbir şey
  // olmadı" sanıyordu. Sessiz başarısızlık, hatalı davranıştan daha kötüdür.
  const [err, setErr] = useState<string | null>(null);

  async function upload(view: PostureView, file: File) {
    setBusy(view);
    setErr(null);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}-${view}.${ext}`;

    const res = await uploadToStorage(supabase, {
      bucket: "posture-photos",
      path,
      file,
      upsert: true,
      contentType: file.type || undefined,
      ownerFolder: true,
    });

    if (res.ok) {
      const { data: signed } = await supabase.storage
        .from("posture-photos")
        .createSignedUrl(path, 3600);
      setPreviews((p) => ({ ...p, [view]: signed?.signedUrl ?? "" }));
      onChange({ ...value, [view]: path });
    } else {
      setErr(res.error ?? "Fotoğraf yüklenemedi.");
    }
    setBusy(null);
  }

  function clear(view: PostureView) {
    const next = { ...value };
    delete next[view];
    onChange(next);
    setPreviews((p) => {
      const n = { ...p };
      delete n[view];
      return n;
    });
  }

  return (
    <div className="space-y-2">
      {err && (
        <p className="rounded-xl bg-coral/10 px-3 py-2 text-xs font-medium text-coral">
          {err}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
      {SLOTS.map((slot) => {
        const done = !!value[slot.view];
        const preview = previews[slot.view];
        return (
          <div key={slot.view}>
            <label
              className={`relative flex aspect-[3/4] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed text-center transition-colors ${
                done
                  ? "border-brand/60 bg-brand/5"
                  : "border-ink-border bg-ink-soft hover:border-brand/40"
              }`}
            >
              {preview ? (
                // Seçilen dosyanın `blob:` önizlemesi — yükleme öncesi olduğu
                // için next/image optimize edemez; düz etiket bilinçli.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={slot.label} className="h-full w-full object-cover" />
              ) : busy === slot.view ? (
                <Loader2 size={22} className="animate-spin text-brand" />
              ) : done ? (
                <Check size={22} className="text-brand" />
              ) : (
                <>
                  <Upload size={20} className="text-fg-muted" />
                  <span className="mt-1.5 text-xs font-semibold">{slot.label}</span>
                  <span className="mt-0.5 px-1 text-[11px] leading-tight text-fg-muted">
                    {slot.hint}
                  </span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busy !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(slot.view, f);
                  e.target.value = "";
                }}
              />
            </label>
            {done && (
              <button
                onClick={() => clear(slot.view)}
                className="mt-1 flex w-full items-center justify-center gap-1 text-[11px] text-fg-muted hover:text-coral"
              >
                <X size={11} /> Kaldır
              </button>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
