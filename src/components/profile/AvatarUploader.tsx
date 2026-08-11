"use client";

import { useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { uploadToStorage } from "@/lib/storage/upload";
import { setAvatar } from "@/lib/profile/actions";
import { Camera, Trash2, X, Check, ZoomIn } from "lucide-react";
import { SmartImage } from "@/components/ui/SmartImage";

/**
 * Profil fotoğrafı yükleme/değiştirme/kaldırma + kare crop (zoom + sürükle).
 * Dosya doğrudan tarayıcıdan Storage'a yüklenir (Vercel gövde limitini aşar).
 */
export function AvatarUploader({
  userId,
  initialUrl,
  name,
}: {
  userId: string;
  initialUrl: string | null;
  name: string;
}) {
  const supabase = useRef(createClient()).current;
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [src, setSrc] = useState<string | null>(null); // crop'a giren geçici resim
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Lütfen bir görsel seç."); return; }
    const reader = new FileReader();
    reader.onload = () => setSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const upload = useCallback(async (blob: Blob) => {
    setBusy(true);
    setErr(null);
    try {
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      // Oturum + klasör sahipliği yüklemeden ÖNCE doğrulanıyor; RLS reddi ile
      // süresi dolmuş oturum aynı hatayı ürettiği için ayırt edilemiyordu.
      const up = await uploadToStorage(supabase, {
        bucket: "avatars", path, file: blob, upsert: true,
        contentType: "image/jpeg", ownerFolder: true,
      });
      if (!up.ok) throw new Error(up.error ?? "Avatar yüklenemedi.");
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      const res = await setAvatar(publicUrl);
      if (!res.ok) throw new Error(res.error);
      setUrl(publicUrl);
      setSrc(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yükleme başarısız.");
    } finally {
      setBusy(false);
    }
  }, [supabase, userId]);

  async function remove() {
    setBusy(true);
    const res = await setAvatar(null);
    if (res.ok) setUrl(null);
    else setErr(res.error ?? "Kaldırılamadı.");
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {url ? (
          <SmartImage
            src={url}
            alt={name}
            width={96}
            height={96}
            className="h-24 w-24 rounded-3xl border border-ink-border object-cover"
          />
        ) : (
          <span className="grid h-24 w-24 place-items-center rounded-3xl border border-ink-border bg-ink-soft text-3xl font-black text-fg-muted">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="absolute -bottom-1.5 -right-1.5 grid h-9 w-9 place-items-center rounded-xl border-2 border-ink bg-brand text-black disabled:opacity-50"
          aria-label="Fotoğraf değiştir"
        >
          <Camera size={16} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="text-xs font-semibold text-brand disabled:opacity-50">
          {url ? "Değiştir" : "Fotoğraf Yükle"}
        </button>
        {url && (
          <button type="button" onClick={remove} disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-semibold text-coral disabled:opacity-50">
            <Trash2 size={13} /> Kaldır
          </button>
        )}
      </div>
      {err && <p className="text-xs text-coral">{err}</p>}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />

      {src && (
        <CropModal src={src} busy={busy} onCancel={() => setSrc(null)} onApply={upload} />
      )}
    </div>
  );
}

/** Kare crop diyaloğu: zoom + sürükle, 512×512 JPEG üretir. */
function CropModal({
  src, busy, onCancel, onApply,
}: {
  src: string;
  busy: boolean;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}) {
  const FRAME = 260;
  const imgRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [ready, setReady] = useState(false);

  function onDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOff({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
  }
  function onUp() { drag.current = null; }

  function baseScale(img: HTMLImageElement) {
    return Math.max(FRAME / img.naturalWidth, FRAME / img.naturalHeight);
  }

  function apply() {
    const img = imgRef.current;
    if (!img) return;
    const bs = baseScale(img);
    const eff = bs * scale;
    const dispW = img.naturalWidth * eff;
    const dispH = img.naturalHeight * eff;
    const left = FRAME / 2 + off.x - dispW / 2;
    const top = FRAME / 2 + off.y - dispH / 2;
    const sx = -left / eff;
    const sy = -top / eff;
    const sSize = FRAME / eff;

    const out = 512;
    const canvas = document.createElement("canvas");
    canvas.width = out; canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, out, out);
    canvas.toBlob((b) => { if (b) onApply(b); }, "image/jpeg", 0.9);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-ink-border bg-ink-card p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">Fotoğrafı Konumlandır</h3>
          <button onClick={onCancel} className="grid h-7 w-7 place-items-center rounded-lg text-fg-muted hover:text-fg" aria-label="Kapat">
            <X size={16} />
          </button>
        </div>

        <div
          className="relative mx-auto touch-none overflow-hidden rounded-full border border-ink-border bg-ink"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {/* Kırpma önizlemesi bir `blob:` URL — next/image bunu optimize
              EDEMEZ (dosya henüz sunucuda yok) ve ölçüm için ham <img>
              referansı gerekiyor. Bilerek düz etiket. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="Kırpma önizleme"
            onLoad={() => setReady(true)}
            draggable={false}
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              transform: `translate(-50%, -50%) translate(${off.x}px, ${off.y}px) scale(${scale})`,
              width: ready && imgRef.current ? imgRef.current.naturalWidth * baseScale(imgRef.current) : FRAME,
            }}
          />
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_2px_rgba(214,248,76,0.6)]" />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <ZoomIn size={16} className="shrink-0 text-fg-muted" />
          <input type="range" min={1} max={3} step={0.01} value={scale}
            onChange={(e) => setScale(Number(e.target.value))} className="w-full accent-brand" />
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={onCancel} className="btn-ghost flex-1">İptal</button>
          <button onClick={apply} disabled={busy} className="btn-primary flex-1">
            {busy ? "Yükleniyor…" : <><Check size={16} /> Uygula</>}
          </button>
        </div>
      </div>
    </div>
  );
}
