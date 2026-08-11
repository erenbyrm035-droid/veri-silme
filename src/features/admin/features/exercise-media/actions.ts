"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { normalizeMediaKey, slotForFilename, bestExerciseMatch } from "@/lib/media/exercise-media-set";
import type { ExerciseMediaSet } from "@/lib/database.types";

export interface MediaActionResult<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (e: string): MediaActionResult<never> => ({ ok: false, error: e });

const BUCKET = "exercise-media";
const SLOTS: (keyof ExerciseMediaSet)[] = ["thumbnail_url", "gif_url", "video_url", "male_gif", "female_gif", "male_video", "female_video"];

function publicUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function upsertField(exerciseId: string, field: keyof ExerciseMediaSet, url: string | null): Promise<string | null> {
  const supabase = createAdminClient();
  const { data: existing, error: selErr } = await supabase.from("exercise_media_set").select("id").eq("exercise_id", exerciseId).maybeSingle();
  if (selErr) return selErr.message;
  const { error } = existing
    ? await supabase.from("exercise_media_set").update({ [field]: url }).eq("exercise_id", exerciseId)
    : await supabase.from("exercise_media_set").insert({ exercise_id: exerciseId, [field]: url });
  return error?.message ?? null;
}

/** Bir medya alanını URL ile ayarlar/temizler. */
export async function setMediaField(exerciseId: string, field: string, url: string | null): Promise<MediaActionResult> {
  await requireAdmin();
  if (!SLOTS.includes(field as keyof ExerciseMediaSet)) return fail("Geçersiz alan.");
  const clean = url && url.trim() ? url.trim() : null;
  const err = await upsertField(exerciseId, field as keyof ExerciseMediaSet, clean);
  if (err) return fail(dbHint(err));
  revalidatePath("/admin/exercise-media");
  return { ok: true };
}

// "exercise_media_set" tablosu yoksa net yönlendirme.
function dbHint(msg: string): string {
  if (/exercise_media_set/.test(msg) && /(does not exist|schema cache|relation)/i.test(msg))
    return "Veritabanı tablosu bulunamadı. Lütfen migration 0025'i Supabase SQL Editor'de çalıştırın.";
  return msg;
}

/** Tek dosya yükler (formData: exerciseId, slot, file) → CDN URL kaydeder. */
export async function uploadMediaFile(formData: FormData): Promise<MediaActionResult<{ url: string; slot: string }>> {
  await requireAdmin();
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const slot = String(formData.get("slot") ?? "");
  const file = formData.get("file") as File | null;
  if (!exerciseId || !file) return fail("Egzersiz ve dosya gerekli.");
  if (!SLOTS.includes(slot as keyof ExerciseMediaSet)) return fail("Geçersiz slot.");
  if (file.size > 25 * 1024 * 1024) return fail("Dosya 25MB'den büyük olamaz.");

  const supabase = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `set/${exerciseId}/${slot}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) return fail(`Storage: ${error.message}`);
  const url = publicUrl(path);
  const dbErr = await upsertField(exerciseId, slot as keyof ExerciseMediaSet, url);
  if (dbErr) return fail(dbHint(dbErr));
  revalidatePath("/admin/exercise-media");
  return { ok: true, data: { url, slot } };
}

// --- Toplu video silme ------------------------------------------------------
// Videolar DÖRT yerde tutuluyor; hepsi temizlenmezse video "silinmiş" görünmez:
//   1) exercise_media_set.video_url / male_video / female_video  (güncel sistem)
//   2) exercises.video_url                                        (eski sütun, queries.ts hâlâ yedek olarak okuyor)
//   3) exercise_media satırları, media_type = 'video'             (galeri tablosu)
//   4) exercise-media bucket'ındaki dosyalar                      (SQL bunlara ULAŞAMAZ)
// GIF, thumbnail ve 3D animasyonlara (animations bucket) DOKUNULMAZ.

const VIDEO_SLOTS = ["video_url", "male_video", "female_video"] as const;

export interface VideoPurgeReport {
  /** video alanı temizlenen exercise_media_set satırı */
  setRows: number;
  /** video_url'i temizlenen exercises satırı (eski sütun) */
  legacyRows: number;
  /** silinen exercise_media galeri satırı */
  galleryRows: number;
  /** storage'dan silinen dosya */
  files: number;
  /** bucket'a ait olmayan (harici) ve bu yüzden dosyası silinemeyen URL */
  externalUrls: number;
}

/** Public CDN URL'sinden bucket içi yolu çıkarır; URL bu bucket'a ait değilse null. */
function storagePathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/**
 * TÜM egzersiz videolarını siler (DB alanları + storage dosyaları).
 * GIF/thumbnail/3D animasyon korunur. Geri alınamaz.
 */
export async function deleteAllExerciseVideos(): Promise<MediaActionResult<VideoPurgeReport>> {
  await requireAdmin();
  const supabase = createAdminClient();
  const report: VideoPurgeReport = { setRows: 0, legacyRows: 0, galleryRows: 0, files: 0, externalUrls: 0 };

  // 1) Silinecek dosya yollarını, alanları temizlemeden ÖNCE topla.
  //    Sıra önemli: önce DB temizlenirse URL'ler kaybolur ve dosyalar öksüz kalır.
  const paths = new Set<string>();
  const collect = (url: string | null | undefined) => {
    if (!url) return;
    const p = storagePathFromUrl(url);
    if (p) paths.add(p);
    else report.externalUrls++;
  };

  const { data: sets, error: setErr } = await supabase
    .from("exercise_media_set")
    .select("id, video_url, male_video, female_video");
  if (setErr) return fail(dbHint(setErr.message));

  for (const row of (sets as Pick<ExerciseMediaSet, "id" | "video_url" | "male_video" | "female_video">[]) ?? []) {
    if (row.video_url || row.male_video || row.female_video) report.setRows++;
    for (const slot of VIDEO_SLOTS) collect(row[slot]);
  }

  const { data: legacy } = await supabase.from("exercises").select("id, video_url").not("video_url", "is", null);
  for (const row of ((legacy as { id: string; video_url: string | null }[]) ?? [])) {
    report.legacyRows++;
    collect(row.video_url);
  }

  const { data: gallery } = await supabase.from("exercise_media").select("id, url").eq("media_type", "video");
  for (const row of ((gallery as { id: string; url: string | null }[]) ?? [])) {
    report.galleryRows++;
    collect(row.url);
  }

  // 2) Storage dosyalarını sil. remove() tek çağrıda sınırlı sayıda yol alır → parçala.
  const list = [...paths];
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) return fail(`Storage: ${error.message} (${report.files} dosya silindikten sonra durdu, DB'ye dokunulmadı)`);
    report.files += chunk.length;
  }

  // 3) DB alanlarını temizle. Storage başarılı olduktan SONRA — tersi olsaydı
  //    storage hatası durumunda URL'ler silinip dosyalar erişilemez şekilde kalırdı.
  const { error: updErr } = await supabase
    .from("exercise_media_set")
    .update({ video_url: null, male_video: null, female_video: null })
    .not("id", "is", null); // tüm satırlar (Supabase filtresiz update'i reddediyor)
  if (updErr) return fail(dbHint(updErr.message));

  if (report.legacyRows > 0) {
    const { error } = await supabase.from("exercises").update({ video_url: null }).not("video_url", "is", null);
    if (error) return fail(error.message);
  }

  if (report.galleryRows > 0) {
    const { error } = await supabase.from("exercise_media").delete().eq("media_type", "video");
    if (error) return fail(error.message);
  }

  revalidatePath("/admin/exercise-media");
  revalidatePath("/exercises");
  return { ok: true, data: report };
}

export interface BulkReport {
  matched: { file: string; exercise: string; slot: string }[];
  unmatched: { file: string; reason: string }[];
}

/** Toplu yükleme + otomatik eşleştirme (formData: files[]). */
export async function bulkUploadMedia(formData: FormData): Promise<MediaActionResult<BulkReport>> {
  await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail("Dosya seçilmedi.");

  const supabase = createAdminClient();
  const { data: exs } = await supabase.from("exercises").select("id, name");
  const byKey = new Map<string, { id: string; name: string }>();
  for (const e of ((exs as { id: string; name: string }[]) ?? [])) byKey.set(normalizeMediaKey(e.name), { id: e.id, name: e.name });

  const report: BulkReport = { matched: [], unmatched: [] };
  for (const file of files) {
    const { slot, baseKey } = slotForFilename(file.name);
    if (!slot) { report.unmatched.push({ file: file.name, reason: "Desteklenmeyen dosya türü" }); continue; }
    let match = byKey.get(baseKey);
    if (!match) { // gevşek eşleşme: baseKey içerir / içerilir
      for (const [k, v] of byKey) { if (k.includes(baseKey) || baseKey.includes(k)) { match = v; break; } }
    }
    if (!match) { report.unmatched.push({ file: file.name, reason: "Eşleşen egzersiz yok" }); continue; }
    if (file.size > 25 * 1024 * 1024) { report.unmatched.push({ file: file.name, reason: "25MB üstü" }); continue; }

    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
    const path = `set/${match.id}/${slot}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (error) { report.unmatched.push({ file: file.name, reason: `Storage: ${error.message}` }); continue; }
    const dbErr = await upsertField(match.id, slot as keyof ExerciseMediaSet, publicUrl(path));
    if (dbErr) { report.unmatched.push({ file: file.name, reason: dbHint(dbErr) }); continue; }
    report.matched.push({ file: file.name, exercise: match.name, slot });
  }
  revalidatePath("/admin/exercise-media");
  return { ok: true, data: report };
}

/** Otomatik eşleştirme için egzersiz adı indeksi (istemci tarafı yükleme kullanır). */
export async function exerciseNameIndex(): Promise<MediaActionResult<{ id: string; name: string }[]>> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("exercises").select("id, name").order("name");
  if (error) return fail(error.message);
  return { ok: true, data: (data as { id: string; name: string }[]) ?? [] };
}

// --- Otomatik görsel doldurma -----------------------------------------------
// Thumbnail'i olmayan egzersizlere görsel atar:
//  1) Kamuya açık (public-domain, Unlicense) free-exercise-db ile isim eşleştir → gerçek foto.
//  2) Eşleşmeyene otomatik üretilen SVG görsel (/api/exercise-thumb/<id>).
// Böylece "video/GIF olmayan" egzersizler bile en azından bir görsele sahip olur.
const DB_JSON = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const DB_IMG = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export interface AutofillReport { photos: number; generated: number; skipped: number; total: number }

export async function autofillThumbnails(): Promise<MediaActionResult<AutofillReport>> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Mevcut egzersizler + medya setleri
  const { data: exs } = await supabase
    .from("exercises")
    .select("id, name, gif_url, image_url, exercise_media_set(thumbnail_url)");
  const rows = (exs as { id: string; name: string; gif_url: string | null; image_url: string | null; exercise_media_set: { thumbnail_url: string | null }[] | { thumbnail_url: string | null } | null }[]) ?? [];

  // Public-domain veri setini çek + normalize edilmiş isim indeksi kur.
  let dataset: { key: string; url: string }[] = [];
  try {
    const res = await fetch(DB_JSON, { cache: "no-store" });
    if (res.ok) {
      const json = (await res.json()) as { name: string; images: string[] }[];
      dataset = json
        .filter((e) => e.images?.length)
        .map((e) => ({ key: normalizeMediaKey(e.name), url: DB_IMG + e.images[0] }));
    }
  } catch { /* ağ hatası → yalnızca üretilen görsel kullanılır */ }
  // Token-örtüşme tabanlı akıllı eşleştirme (Türkçe-İngilizce karışık adlar için).
  function matchPhoto(name: string): string | null {
    const m = bestExerciseMatch(normalizeMediaKey(name), dataset);
    return m?.url ?? null;
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  const updates: { exercise_id: string; thumbnail_url: string }[] = [];
  let photos = 0, generated = 0, skipped = 0;

  for (const r of rows) {
    const setThumb = Array.isArray(r.exercise_media_set) ? r.exercise_media_set[0]?.thumbnail_url : r.exercise_media_set?.thumbnail_url;
    const existing = setThumb || r.image_url || "";
    const isGenerated = existing.includes("/api/exercise-thumb/");
    // Gerçek foto zaten varsa dokunma; üretilen görsel varsa gerçek fotoyla yükseltmeyi dene.
    if (existing && !isGenerated) { skipped++; continue; }

    const photo = matchPhoto(r.name);
    if (photo) { updates.push({ exercise_id: r.id, thumbnail_url: photo }); photos++; }
    else if (!existing) { updates.push({ exercise_id: r.id, thumbnail_url: `${site}/api/exercise-thumb/${r.id}` }); generated++; }
    else { skipped++; } // zaten üretilen görsel var, gerçek foto da bulunamadı
  }

  // Parçalar halinde upsert (yalnızca thumbnail_url güncellenir; trigger status'u ayarlar).
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    await supabase.from("exercise_media_set").upsert(chunk, { onConflict: "exercise_id" });
  }

  revalidatePath("/admin/exercise-media");
  return { ok: true, data: { photos, generated, skipped, total: rows.length } };
}
