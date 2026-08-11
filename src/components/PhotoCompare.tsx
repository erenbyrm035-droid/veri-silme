"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadToStorage } from "@/lib/storage/upload";
import type { BodyPhoto } from "@/lib/database.types";
import { formatShortDate, todayISO } from "@/lib/utils";
import { Upload, Loader2, Trash2, Camera } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { SmartImage } from "@/components/ui/SmartImage";

interface PhotoWithUrl extends BodyPhoto {
  url: string;
}

/**
 * Vücut fotoğrafı yükleme + önce/sonra karşılaştırma.
 * Dosyalar private `body-photos` bucket'ına `userId/...` yoluna yüklenir;
 * görüntüleme imzalı URL ile yapılır.
 */
export function PhotoCompare({ userId }: { userId: string }) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("body_photos")
      .select("*")
      .eq("user_id", userId)
      .order("taken_on", { ascending: false });

    const rows = (data ?? []) as BodyPhoto[];
    const withUrls: PhotoWithUrl[] = [];
    for (const p of rows) {
      const { data: signed } = await supabase.storage
        .from("body-photos")
        .createSignedUrl(p.storage_path, 3600);
      withUrls.push({ ...p, url: signed?.signedUrl ?? "" });
    }
    setPhotos(withUrls);
    if (withUrls.length && !rightId) setRightId(withUrls[0].id);
    if (withUrls.length > 1 && !leftId) setLeftId(withUrls[withUrls.length - 1].id);
    setLoading(false);
  }, [supabase, userId, leftId, rightId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const up = await uploadToStorage(supabase, {
      bucket: "body-photos", path, file, upsert: false,
      contentType: file.type || undefined, ownerFolder: true,
    });
    if (up.ok) {
      await supabase.from("body_photos").insert({
        user_id: userId,
        storage_path: path,
        taken_on: todayISO(),
        angle: "front",
      });
      await load();
    }
    setUploading(false);
    e.target.value = "";
  }

  async function remove(p: PhotoWithUrl) {
    await supabase.storage.from("body-photos").remove([p.storage_path]);
    await supabase.from("body_photos").delete().eq("id", p.id);
    setPhotos((ps) => ps.filter((x) => x.id !== p.id));
  }

  const left = photos.find((p) => p.id === leftId);
  const right = photos.find((p) => p.id === rightId);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg-muted">
          <Camera size={16} /> Fotoğraf Karşılaştırma
        </h2>
        <label className="btn-ghost cursor-pointer text-xs">
          {uploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          Yükle
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-fg-muted">Yükleniyor...</p>
      ) : photos.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">
          Henüz fotoğraf yok. İlerlemeni görmek için bir fotoğraf yükle.
        </p>
      ) : (
        <>
          {/* Önce / Sonra */}
          <div className="grid grid-cols-2 gap-3">
            <Slot label="Önce" photo={left} />
            <Slot label="Sonra" photo={right} />
          </div>

          {photos.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              <Picker
                label="Sol"
                photos={photos}
                value={leftId}
                onChange={setLeftId}
              />
              <Picker
                label="Sağ"
                photos={photos}
                value={rightId}
                onChange={setRightId}
              />
            </div>
          )}

          {/* Küçük galeri */}
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <div key={p.id} className="group relative">
                <SmartImage
                  src={p.url}
                  alt={formatShortDate(p.taken_on)}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-lg border border-ink-border object-cover"
                />
                <button
                  onClick={() => remove(p)}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-coral text-white shadow"
                  aria-label="Sil"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Slot({ label, photo }: { label: string; photo?: PhotoWithUrl }) {
  return (
    <div>
      <p className="mb-1.5 text-center text-xs font-medium uppercase tracking-wide text-fg-muted">
        {label}
      </p>
      <div className="aspect-[3/4] overflow-hidden rounded-xl border border-ink-border bg-ink-soft">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <SmartImage
            src={photo.url}
            alt={label}
            fill
            sizes="(max-width: 640px) 50vw, 300px"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-fg-muted">—</div>
        )}
      </div>
      {photo && (
        <p className="mt-1 text-center text-xs text-fg-muted">
          {formatShortDate(photo.taken_on)}
        </p>
      )}
    </div>
  );
}

function Picker({
  label,
  photos,
  value,
  onChange,
}: {
  label: string;
  photos: PhotoWithUrl[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        {photos.map((p) => (
          <option key={p.id} value={p.id}>
            {formatShortDate(p.taken_on)}
          </option>
        ))}
      </select>
    </div>
  );
}
