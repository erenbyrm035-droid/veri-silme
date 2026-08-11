"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Upload, FolderUp, Search, Pencil, Film, ImageIcon, Video, X, Check, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Badge } from "@/features/admin/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/features/admin/components/ui/dialog";
import { setMediaField, exerciseNameIndex, autofillThumbnails, deleteAllExerciseVideos, type BulkReport, type AutofillReport, type VideoPurgeReport } from "./actions";
import { ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { normalizeMediaKey, slotForFilename, bestExerciseMatch, bustThumb } from "@/lib/media/exercise-media-set";

const BUCKET = "exercise-media";
/** Dosyayı tarayıcıdan doğrudan Supabase Storage'a yükler (Vercel 4.5MB limitini atlar). */
async function uploadToStorage(exerciseId: string, slot: string, file: File): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `set/${exerciseId}/${slot}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) return { error: `Storage: ${error.message}` };
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
}
import type { ExerciseMediaListRow, ExerciseMediaStatus } from "@/lib/database.types";
import type { MediaStats, MediaFilter } from "./queries";

const FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "Tümü" }, { id: "complete", label: "Tamamlananlar" }, { id: "partial", label: "Eksik Medya" },
  { id: "none", label: "Medya Yok" }, { id: "no_gif", label: "GIF Yok" }, { id: "no_video", label: "Video Yok" }, { id: "no_thumb", label: "Thumbnail Yok" },
];

const STATUS: Record<ExerciseMediaStatus, { label: string; variant: "success" | "warning" | "danger" }> = {
  complete: { label: "✅ Tamamlandı", variant: "success" },
  partial: { label: "🟡 Eksik", variant: "warning" },
  none: { label: "🔴 Medya Yok", variant: "danger" },
};

const SLOTS: { key: string; label: string; kind: "image" | "gif" | "video" }[] = [
  { key: "thumbnail_url", label: "Thumbnail", kind: "image" },
  { key: "gif_url", label: "GIF", kind: "gif" },
  { key: "video_url", label: "Video", kind: "video" },
  { key: "male_gif", label: "Erkek GIF", kind: "gif" },
  { key: "female_gif", label: "Kadın GIF", kind: "gif" },
  { key: "male_video", label: "Erkek Video", kind: "video" },
  { key: "female_video", label: "Kadın Video", kind: "video" },
];

function Preview({ url, kind, onOpen }: { url: string | null; kind: "image" | "gif" | "video"; onOpen: (u: string, k: string) => void }) {
  if (!url) return <span className="grid h-10 w-14 place-items-center rounded-md bg-ink-soft text-fg-muted"><X size={14} /></span>;
  return (
    <button onClick={() => onOpen(url, kind)} className="relative h-10 w-14 overflow-hidden rounded-md border border-ink-border">
      {kind === "video" ? (
        <span className="grid h-full w-full place-items-center bg-black text-white"><Video size={16} /></span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bustThumb(url)} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </button>
  );
}

export function ExerciseMediaAdmin({
  rows, total, page, pageCount, stats, q, filter,
}: {
  rows: ExerciseMediaListRow[]; total: number; page: number; pageCount: number; stats: MediaStats; q: string; filter: MediaFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = React.useState(q);
  const [preview, setPreview] = React.useState<{ url: string; kind: string } | null>(null);
  const [editRow, setEditRow] = React.useState<ExerciseMediaListRow | null>(null);
  const [bulkReport, setBulkReport] = React.useState<BulkReport | null>(null);
  const [bulkPending, setBulkPending] = React.useState(false);
  const [autofill, setAutofill] = React.useState<AutofillReport | null>(null);
  const [autofillPending, setAutofillPending] = React.useState(false);
  const [purgeConfirm, setPurgeConfirm] = React.useState("");
  const [purgePending, setPurgePending] = React.useState(false);
  const [purge, setPurge] = React.useState<VideoPurgeReport | null>(null);
  const [purgeError, setPurgeError] = React.useState<string | null>(null);

  async function onPurgeVideos() {
    setPurgePending(true); setPurge(null); setPurgeError(null);
    const res = await deleteAllExerciseVideos();
    setPurgePending(false);
    setPurgeConfirm("");
    if (res.ok && res.data) { setPurge(res.data); router.refresh(); }
    else setPurgeError(res.error ?? "Silinemedi.");
  }

  async function onAutofill() {
    if (!confirm("Thumbnail'i olmayan tüm egzersizlere otomatik görsel atansın mı? (Gerçek foto bulunamayana üretilen görsel konur.)")) return;
    setAutofillPending(true); setAutofill(null);
    const res = await autofillThumbnails();
    setAutofillPending(false);
    if (res.ok && res.data) { setAutofill(res.data); router.refresh(); }
  }

  function nav(next: Record<string, string>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) { if (v) sp.set(k, v); else sp.delete(k); }
    router.push(`${pathname}?${sp.toString()}`);
  }

  function onSearch(e: React.FormEvent) { e.preventDefault(); nav({ q: search, page: "" }); }

  async function onBulk(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBulkPending(true); setBulkReport(null);
    const report: BulkReport = { matched: [], unmatched: [] };
    try {
      const idx = await exerciseNameIndex();
      if (!idx.ok || !idx.data) throw new Error(idx.error ?? "Egzersiz listesi alınamadı.");
      const entries = idx.data.map((e) => ({ ...e, key: normalizeMediaKey(e.name) }));

      for (const file of Array.from(files)) {
        const { slot, baseKey } = slotForFilename(file.name);
        if (!slot) { report.unmatched.push({ file: file.name, reason: "Desteklenmeyen dosya türü" }); continue; }
        const match = bestExerciseMatch(baseKey, entries);
        if (!match) { report.unmatched.push({ file: file.name, reason: "Eşleşen egzersiz yok" }); continue; }

        const up = await uploadToStorage(match.id, slot, file);
        if (up.error) { report.unmatched.push({ file: file.name, reason: up.error }); continue; }
        const res = await setMediaField(match.id, slot, up.url!);
        if (!res.ok) { report.unmatched.push({ file: file.name, reason: res.error ?? "Kaydedilemedi" }); continue; }
        report.matched.push({ file: file.name, exercise: match.name, slot });
      }
      setBulkReport(report);
      router.refresh();
    } catch (e) {
      setBulkReport({ matched: report.matched, unmatched: [...report.unmatched, { file: "—", reason: e instanceof Error ? e.message : "Bilinmeyen hata" }] });
    } finally {
      setBulkPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Egzersiz Medya Yönetimi</h1>
        <p className="mt-1 text-sm text-fg-muted">Thumbnail, GIF ve video yükle; otomatik eşleştir; eksikleri takip et.</p>
      </div>

      {/* Eksik medya raporu */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-fg-muted">Toplam Egzersiz</p><p className="text-2xl font-bold">{stats.total}</p></Card>
        <MediaStat label="GIF" pct={stats.pctGif} missing={stats.missingGif} />
        <MediaStat label="Video" pct={stats.pctVideo} missing={stats.missingVideo} />
        <MediaStat label="Thumbnail" pct={stats.pctThumb} missing={stats.missingThumb} />
      </div>
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <span className="text-sm font-semibold">Tamamlanma: {stats.pctComplete}%</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-soft"><div className="h-full rounded-full bg-brand" style={{ width: `${stats.pctComplete}%` }} /></div>
        <span className="text-xs text-fg-muted">✅ {stats.complete} · 🟡 {stats.partial} · 🔴 {stats.none}</span>
      </Card>

      {/* Otomatik görsel doldurma */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><ImagePlus size={16} className="text-brand" /> Eksik Görselleri Otomatik Doldur</h3>
          <p className="mt-1 text-xs text-fg-muted">Thumbnail'i olmayan egzersizlere görsel atar: önce kamuya açık egzersiz veritabanından gerçek foto, bulunamazsa otomatik üretilen görsel.</p>
          {autofill && <p className="mt-1 text-xs text-emerald-400">{autofill.photos} gerçek foto · {autofill.generated} üretilen görsel · {autofill.skipped} zaten mevcut ({autofill.total} egzersiz)</p>}
        </div>
        <Button size="sm" onClick={onAutofill} disabled={autofillPending}>
          {autofillPending ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} Otomatik Doldur
        </Button>
      </Card>

      {/* Toplu video silme — geri alınamaz */}
      <Card className="space-y-3 border-coral/30 p-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-coral"><Trash2 size={16} /> Tüm Videoları Sil</h3>
          <p className="mt-1 text-xs text-fg-muted">
            Her egzersizin <strong>Video</strong>, <strong>Erkek Video</strong> ve <strong>Kadın Video</strong> alanını temizler ve
            dosyaları Storage&apos;dan siler. <strong>GIF, thumbnail ve 3D animasyonlara dokunulmaz.</strong> Geri alınamaz —
            yeni videoları sonrasında yükleyebilirsin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={purgeConfirm}
            onChange={(e) => setPurgeConfirm(e.target.value)}
            placeholder="Onaylamak için VIDEOLARI SIL yaz"
            className="w-64"
            aria-label="Silme onayı"
          />
          <Button
            variant="destructive"
            size="sm"
            disabled={purgeConfirm.trim().toLocaleUpperCase("tr-TR") !== "VIDEOLARI SIL" || purgePending}
            onClick={onPurgeVideos}
          >
            {purgePending ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Videoları Sil
          </Button>
        </div>
        {purgeError && <p className="text-xs text-coral">{purgeError}</p>}
        {purge && (
          <p className="text-xs text-emerald-400">
            Silindi — {purge.files} dosya · {purge.setRows} medya seti · {purge.legacyRows} eski <code>video_url</code> ·{" "}
            {purge.galleryRows} galeri kaydı
            {purge.externalUrls > 0 && ` · ${purge.externalUrls} harici bağlantı (dosya bize ait değil, yalnızca kayıt silindi)`}
          </p>
        )}
      </Card>

      {/* Toplu yükleme */}
      <Card className="space-y-3 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Upload size={16} className="text-brand" /> Toplu Yükleme & Otomatik Eşleştirme</h3>
        <p className="text-xs text-fg-muted">Dosya adı egzersize göre otomatik bağlanır (örn. <code>bench-press.gif</code> → Bench Press). <code>male-</code>/<code>female-</code> öneki cinsiyet varyantına gider. Uzantı slotu belirler (.gif/.mp4/.jpg).</p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-black">
            <Upload size={15} /> Dosya Seç
            <input type="file" multiple accept=".gif,.mp4,.webm,.mov,.jpg,.jpeg,.png,.webp,.avif" className="hidden" onChange={(e) => onBulk(e.target.files)} />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-ink-soft px-3.5 py-2 text-sm font-semibold">
            <FolderUp size={15} /> Klasör Seç
            {/* @ts-expect-error webkitdirectory non-standard */}
            <input type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={(e) => onBulk(e.target.files)} />
          </label>
          {bulkPending && <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted"><Loader2 size={15} className="animate-spin" /> Yükleniyor…</span>}
        </div>
        {bulkReport && (
          <div className="rounded-xl border border-ink-border bg-ink-soft p-3 text-sm">
            <p className="font-semibold text-emerald-400">{bulkReport.matched.length} dosya eşleşti ve yüklendi.</p>
            {bulkReport.matched.slice(0, 8).map((m, i) => <p key={i} className="text-xs text-fg-muted">{m.file} → {m.exercise} ({m.slot})</p>)}
            {bulkReport.unmatched.length > 0 && (
              <>
                <p className="mt-2 font-semibold text-coral">{bulkReport.unmatched.length} eşleşmedi:</p>
                {bulkReport.unmatched.slice(0, 8).map((u, i) => <p key={i} className="text-xs text-fg-muted">{u.file} — {u.reason}</p>)}
              </>
            )}
          </div>
        )}
      </Card>

      {/* Arama + filtre */}
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={onSearch} className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Egzersiz ara…" className="pl-9" />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => nav({ filter: f.id === "all" ? "" : f.id, page: "" })}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f.id ? "bg-brand text-black" : "bg-ink-soft text-fg-muted"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tablo */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-border text-left text-xs text-fg-muted">
                <th className="px-4 py-2.5 font-medium">Egzersiz</th>
                <th className="px-3 py-2.5 font-medium">Kas</th>
                <th className="px-3 py-2.5 font-medium">Thumb</th>
                <th className="px-3 py-2.5 font-medium">GIF</th>
                <th className="px-3 py-2.5 font-medium">Video</th>
                <th className="px-3 py-2.5 font-medium">Durum</th>
                <th className="px-3 py-2.5 text-right font-medium">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-fg-muted">Sonuç yok.</td></tr>}
              {rows.map((r) => (
                <tr key={r.exercise_id} className="border-b border-ink-border/60 last:border-0">
                  <td className="px-4 py-2"><p className="font-medium">{r.name}</p><p className="text-xs text-fg-muted">{r.category}</p></td>
                  <td className="px-3 py-2 text-fg-muted">{r.muscle_group}</td>
                  <td className="px-3 py-2"><Preview url={r.thumbnail_url} kind="image" onOpen={(u, k) => setPreview({ url: u, kind: k })} /></td>
                  <td className="px-3 py-2"><Preview url={r.gif_url ?? r.male_gif ?? r.female_gif} kind="gif" onOpen={(u, k) => setPreview({ url: u, kind: k })} /></td>
                  <td className="px-3 py-2"><Preview url={r.video_url ?? r.male_video ?? r.female_video} kind="video" onOpen={(u, k) => setPreview({ url: u, kind: k })} /></td>
                  <td className="px-3 py-2"><Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge></td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setEditRow(r)} className="rounded-lg p-1.5 text-fg-muted hover:bg-fg/5 hover:text-fg"><Pencil size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => nav({ page: String(page - 1) })}>Önceki</Button>
          <span className="text-sm text-fg-muted">{page} / {pageCount} ({total})</span>
          <Button size="sm" variant="secondary" disabled={page >= pageCount} onClick={() => nav({ page: String(page + 1) })}>Sonraki</Button>
        </div>
      )}

      {/* Önizleme */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Medya Önizleme</DialogTitle></DialogHeader>
          {preview && (preview.kind === "video"
            ? <video src={preview.url} controls className="w-full rounded-xl" />
            // eslint-disable-next-line @next/next/no-img-element
            : <img src={bustThumb(preview.url)} alt="" className="w-full rounded-xl" />)}
        </DialogContent>
      </Dialog>

      {/* Düzenleme */}
      {editRow && <EditDialog row={editRow} onClose={() => setEditRow(null)} onSaved={() => router.refresh()} onPreview={(u, k) => setPreview({ url: u, kind: k })} />}
    </div>
  );
}

function MediaStat({ label, pct, missing }: { label: string; pct: number; missing: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="text-2xl font-bold">{pct}%</p>
      <p className="text-[11px] text-coral">{missing} eksik</p>
    </Card>
  );
}

function EditDialog({ row, onClose, onSaved, onPreview }: {
  row: ExerciseMediaListRow; onClose: () => void; onSaved: () => void; onPreview: (u: string, k: string) => void;
}) {
  const [pendingSlot, setPendingSlot] = React.useState<string | null>(null);
  const current = row as unknown as Record<string, string | null>;

  async function upload(slot: string, file: File) {
    setPendingSlot(slot);
    try {
      const up = await uploadToStorage(row.exercise_id, slot, file);
      if (up.error) { alert(up.error); return; }
      const res = await setMediaField(row.exercise_id, slot, up.url!);
      if (res.ok) onSaved(); else alert(res.error ?? "Kaydedilemedi.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Yüklenemedi.");
    } finally {
      setPendingSlot(null);
    }
  }
  async function saveUrl(slot: string, url: string) {
    setPendingSlot(slot);
    const res = await setMediaField(row.exercise_id, slot, url);
    setPendingSlot(null);
    if (res.ok) onSaved(); else alert(res.error ?? "Kaydedilemedi.");
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{row.name} — Medya</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {SLOTS.map((s) => {
            const val = current[s.key];
            return (
              <div key={s.key} className="rounded-xl border border-ink-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {s.kind === "video" ? <Video size={14} /> : s.kind === "gif" ? <Film size={14} /> : <ImageIcon size={14} />} {s.label}
                  </span>
                  {val
                    ? <span className="flex items-center gap-2 text-xs text-emerald-400"><Check size={13} /> <button onClick={() => onPreview(val, s.kind)} className="underline">İzle</button>
                        <button onClick={() => saveUrl(s.key, "")} className="text-coral"><Trash2 size={13} /></button></span>
                    : <span className="text-xs text-fg-muted">Yok</span>}
                </div>
                <div className="flex gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-ink-soft px-2.5 py-1.5 text-xs font-semibold">
                    {pendingSlot === s.key ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Yükle
                    <input type="file" className="hidden" accept={s.kind === "video" ? ".mp4,.webm,.mov" : s.kind === "gif" ? ".gif" : ".jpg,.jpeg,.png,.webp,.avif"}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(s.key, f); }} />
                  </label>
                  <input defaultValue={val ?? ""} placeholder="veya URL yapıştır" onBlur={(e) => { if (e.target.value !== (val ?? "")) saveUrl(s.key, e.target.value); }}
                    className="flex-1 rounded-lg border border-ink-border bg-ink-soft px-2.5 py-1.5 text-xs outline-none focus:border-brand" />
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
