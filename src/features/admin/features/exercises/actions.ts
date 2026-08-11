"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAGS } from "@/lib/data/catalog";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { slugify } from "./constants";
import { toCsv, EXPORT_COLUMNS } from "./io";
import {
  createExerciseSchema,
  updateExerciseSchema,
  idSchema,
  bulkIdsSchema,
  bulkCategorySchema,
  bulkMuscleGroupSchema,
  bulkStatusSchema,
  muscleLinkSchema,
  relationSchema,
  relationIdSchema,
  mediaAddSchema,
  mergeSchema,
  versionRestoreSchema,
  importSchema,
  type ExerciseParsed,
} from "./schema";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
  skipped?: number;
}
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

function revalidate(id?: string) {
  revalidatePath("/admin/exercises");
  if (id) revalidatePath(`/admin/exercises/${id}`);
  // Kullanıcı tarafındaki egzersiz kütüphanesi `unstable_cache` ile
  // önbellekte (bkz. `lib/data/catalog.ts`); içerik değişti, tag'i temizle.
  revalidateTag(CATALOG_TAGS.exercises);
}

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);

/** Form değerlerini DB satırına çevirir (boş string → null). */
function toRow(v: ExerciseParsed) {
  return {
    name: v.name.trim(),
    slug: (v.slug && v.slug.trim() ? slugify(v.slug) : slugify(v.name)) || slugify(v.name),
    category: v.category,
    subcategory: empty(v.subcategory),
    muscle_group: v.muscle_group.trim(),
    primary_muscles: [v.muscle_group.trim()],
    secondary_muscles: v.secondary_muscles ?? [],
    difficulty: v.difficulty,
    equipment: empty(v.equipment),
    status: v.status ?? "published",
    media_type: v.media_type ?? "gif",
    gif_url: empty(v.gif_url),
    description: empty(v.description),
    instructions: v.instructions ?? [],
    breathing: empty(v.breathing),
    tempo: empty(v.tempo),
    range_of_motion: empty(v.range_of_motion),
    start_position: empty(v.start_position),
    end_position: empty(v.end_position),
    common_mistakes: v.common_mistakes ?? [],
    tips: v.tips ?? [],
    tags: v.tags ?? [],
    calories: v.calories ?? null,
    movement_type: empty(v.movement_type),
    seo_title: empty(v.seo_title),
    seo_description: empty(v.seo_description),
    og_image_url: empty(v.og_image_url),
  };
}

/** Slug çakışmasını benzersiz kılar. */
async function ensureUniqueSlug(
  supabase: ReturnType<typeof createAdminClient>,
  slug: string,
  ignoreId?: string
): Promise<string> {
  let candidate = slug || "egzersiz";
  for (let i = 0; i < 50; i++) {
    let q = supabase.from("exercises").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data } = await q;
    if (!data || data.length === 0) return candidate;
    candidate = `${slug}-${i + 2}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------
export async function createExercise(
  input: z.input<typeof createExerciseSchema>
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = createExerciseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = createAdminClient();
  const row = toRow(parsed.data);
  row.slug = await ensureUniqueSlug(supabase, row.slug);

  const { data, error } = await supabase.from("exercises").insert(row).select("id").single();
  if (error) return fail(error.message);
  revalidate();
  return { ok: true, data: { id: data.id as string } };
}

// ---------------------------------------------------------------------------
// UPDATE (+ versiyon snapshot)
// ---------------------------------------------------------------------------
export async function updateExercise(
  input: z.input<typeof updateExerciseSchema>
): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = updateExerciseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = createAdminClient();
  const { id, change_note } = parsed.data;

  // Mevcut satırı sürüm olarak sakla.
  const { data: current } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!current) return fail("Egzersiz bulunamadı.");
  const { data: last } = await supabase
    .from("exercise_versions")
    .select("version")
    .eq("exercise_id", id)
    .order("version", { ascending: false })
    .limit(1);
  const nextVersion = ((last?.[0]?.version as number) ?? 0) + 1;
  await supabase.from("exercise_versions").insert({
    exercise_id: id,
    version: nextVersion,
    snapshot: current,
    changed_by: ctx.id,
    changed_by_name: ctx.fullName ?? ctx.email,
    change_note: change_note ?? null,
  });

  const row = toRow(parsed.data);
  row.slug = await ensureUniqueSlug(supabase, row.slug, id);
  const { error } = await supabase
    .from("exercises")
    .update({ ...row, updated_by: ctx.id })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidate(id);
  return { ok: true };
}

export async function setStatus(input: { id: string; status: "published" | "draft" }): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = idSchema.safeParse({ id: input.id });
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("exercises")
    .update({ status: input.status, updated_by: ctx.id })
    .eq("id", input.id);
  if (error) return fail(error.message);
  revalidate(input.id);
  return { ok: true };
}

export async function deleteExercise(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("exercises").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// TOPLU İŞLEMLER
// ---------------------------------------------------------------------------
export async function bulkDelete(input: z.infer<typeof bulkIdsSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkIdsSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("exercises").delete().in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function bulkSetCategory(input: z.infer<typeof bulkCategorySchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkCategorySchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("exercises").update({ category: parsed.data.category }).in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function bulkSetMuscleGroup(input: z.infer<typeof bulkMuscleGroupSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkMuscleGroupSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("exercises")
    .update({ muscle_group: parsed.data.muscle_group, primary_muscles: [parsed.data.muscle_group] })
    .in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

export async function bulkSetStatus(input: z.infer<typeof bulkStatusSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("exercises").update({ status: parsed.data.status }).in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// KAS EŞLEMESİ
// ---------------------------------------------------------------------------
export async function setExerciseMuscles(input: z.infer<typeof muscleLinkSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = muscleLinkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  await supabase.from("exercise_muscles").delete().eq("exercise_id", parsed.data.exerciseId);
  if (parsed.data.muscles.length > 0) {
    const rows = parsed.data.muscles.map((m, i) => ({
      exercise_id: parsed.data.exerciseId,
      muscle_id: m.muscle_id,
      muscle_name: m.muscle_name,
      role: m.role,
      sort_order: i,
    }));
    const { error } = await supabase.from("exercise_muscles").insert(rows);
    if (error) return fail(error.message);
  }
  revalidate(parsed.data.exerciseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// İLİŞKİLER
// ---------------------------------------------------------------------------
export async function addRelation(input: z.infer<typeof relationSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = relationSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  if (parsed.data.exerciseId === parsed.data.relatedId) return fail("Egzersiz kendisiyle ilişkilendirilemez.");
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("exercise_relations")
    .upsert(
      {
        exercise_id: parsed.data.exerciseId,
        related_id: parsed.data.relatedId,
        relation: parsed.data.relation,
      },
      { onConflict: "exercise_id,related_id,relation" }
    );
  if (error) return fail(error.message);
  revalidate(parsed.data.exerciseId);
  return { ok: true };
}

export async function removeRelation(input: z.infer<typeof relationIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = relationIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("exercise_relations").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate(parsed.data.exerciseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// MEDYA (GIF)
// ---------------------------------------------------------------------------
/** Dosya yükler (FormData: file, exerciseId, slug). Bucket'a yazar, gif_url atar. */
export async function uploadGif(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const ctx = await requireAdmin();
  const file = formData.get("file") as File | null;
  const exerciseId = String(formData.get("exerciseId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!file || !exerciseId || !slug) return fail("Eksik parametre.");
  if (file.size > 15 * 1024 * 1024) return fail("Dosya 15MB'tan büyük olamaz.");

  const supabase = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "gif").toLowerCase();
  const path = `${slug}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from("exercise-media")
    .upload(path, buffer, { contentType: file.type || "image/gif", upsert: true });
  if (upErr) return fail(upErr.message);

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const url = `${base}/storage/v1/object/public/exercise-media/${path}`;
  await supabase.from("exercises").update({ gif_url: url, media_type: "gif", updated_by: ctx.id }).eq("id", exerciseId);
  await supabase.from("exercise_media").insert({
    exercise_id: exerciseId,
    media_type: "gif",
    url,
    storage_path: path,
    is_primary: true,
  });
  revalidate(exerciseId);
  return { ok: true, data: { url } };
}

export async function addMediaByUrl(input: z.infer<typeof mediaAddSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mediaAddSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("exercise_media").insert({
    exercise_id: parsed.data.exerciseId,
    media_type: parsed.data.media_type,
    url: parsed.data.url,
    storage_path: parsed.data.storage_path ?? null,
    is_primary: parsed.data.is_primary,
  });
  if (error) return fail(error.message);
  if (parsed.data.is_primary && parsed.data.media_type === "gif") {
    await supabase.from("exercises").update({ gif_url: parsed.data.url }).eq("id", parsed.data.exerciseId);
  }
  revalidate(parsed.data.exerciseId);
  return { ok: true };
}

export async function deleteMedia(input: { id: string; exerciseId: string; storage_path?: string | null }): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  if (input.storage_path) {
    await supabase.storage.from("exercise-media").remove([input.storage_path]);
  }
  const { error } = await supabase.from("exercise_media").delete().eq("id", input.id);
  if (error) return fail(error.message);
  revalidate(input.exerciseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// OTOMATİK GIF EŞLEŞTİRME
// ---------------------------------------------------------------------------
/** Bucket'taki slug adlı dosyaları, gif_url'i boş egzersizlere atar. */
export async function autoMatchGifs(): Promise<ActionResult<{ assigned: number }>> {
  await requireAdmin();
  const supabase = createAdminClient();
  const [{ data: exData }, storage] = await Promise.all([
    supabase.from("exercises").select("id, slug, gif_url").limit(5000),
    supabase.storage.from("exercise-media").list("", { limit: 5000 }),
  ]);
  const files = new Map<string, string>();
  (storage.data ?? []).forEach((f: { name: string }) => {
    if (/\.(gif|webp|png|jpg|jpeg)$/i.test(f.name)) files.set(f.name.replace(/\.[^.]+$/, ""), f.name);
  });
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let assigned = 0;
  for (const ex of (exData ?? []) as { id: string; slug: string | null; gif_url: string | null }[]) {
    if (ex.gif_url || !ex.slug) continue;
    const file = files.get(ex.slug);
    if (!file) continue;
    const url = `${base}/storage/v1/object/public/exercise-media/${file}`;
    await supabase.from("exercises").update({ gif_url: url, media_type: "gif" }).eq("id", ex.id);
    assigned++;
  }
  revalidate();
  return { ok: true, data: { assigned } };
}

// ---------------------------------------------------------------------------
// DUPLICATE BİRLEŞTİRME
// ---------------------------------------------------------------------------
export async function mergeDuplicates(input: z.infer<typeof mergeSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  // İlişki/favori referanslarını koru: fazlalıkları sil (FK cascade favorites vb.).
  const { error } = await supabase.from("exercises").delete().in("id", parsed.data.removeIds);
  if (error) return fail(error.message);
  revalidate(parsed.data.keepId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// SÜRÜM GERİ YÜKLEME (ROLLBACK)
// ---------------------------------------------------------------------------
export async function restoreVersion(input: z.infer<typeof versionRestoreSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = versionRestoreSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { data: ver } = await supabase
    .from("exercise_versions")
    .select("snapshot")
    .eq("id", parsed.data.versionId)
    .maybeSingle();
  if (!ver) return fail("Sürüm bulunamadı.");
  const snap = ver.snapshot as Record<string, unknown>;

  // Mevcut durumu yeni sürüm olarak sakla, sonra snapshot'ı geri yükle.
  const { data: current } = await supabase.from("exercises").select("*").eq("id", parsed.data.exerciseId).maybeSingle();
  const { data: last } = await supabase
    .from("exercise_versions")
    .select("version")
    .eq("exercise_id", parsed.data.exerciseId)
    .order("version", { ascending: false })
    .limit(1);
  await supabase.from("exercise_versions").insert({
    exercise_id: parsed.data.exerciseId,
    version: ((last?.[0]?.version as number) ?? 0) + 1,
    snapshot: current,
    changed_by: ctx.id,
    changed_by_name: ctx.fullName ?? ctx.email,
    change_note: "Geri yükleme öncesi otomatik yedek",
  });

  // Geri yüklenecek alanlar (id/created_at hariç).
  const { id: _id, created_at: _c, ...rest } = snap as { id?: string; created_at?: string } & Record<string, unknown>;
  void _id; void _c;
  const { error } = await supabase.from("exercises").update({ ...rest, updated_by: ctx.id }).eq("id", parsed.data.exerciseId);
  if (error) return fail(error.message);
  revalidate(parsed.data.exerciseId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// DIŞA AKTAR (CSV / JSON)
// ---------------------------------------------------------------------------
export async function exportExercises(
  format: "csv" | "json"
): Promise<ActionResult<{ content: string; filename: string; mime: string }>> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("exercises")
    .select(EXPORT_COLUMNS.join(","))
    .order("name")
    .limit(5000);
  if (error) return fail(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return {
      ok: true,
      data: { content: JSON.stringify(rows, null, 2), filename: `egzersizler-${stamp}.json`, mime: "application/json" },
    };
  }
  return {
    ok: true,
    data: { content: toCsv(rows), filename: `egzersizler-${stamp}.csv`, mime: "text/csv;charset=utf-8" },
  };
}

// ---------------------------------------------------------------------------
// İÇE AKTAR (CSV/JSON → satır dizisi)
// ---------------------------------------------------------------------------
export async function importExercises(input: z.infer<typeof importSchema>): Promise<ActionResult<{ inserted: number; failed: number }>> {
  await requireAdmin();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz içe aktarma verisi.");
  const supabase = createAdminClient();

  let inserted = 0;
  let failed = 0;
  for (const raw of parsed.data.rows) {
    const name = String(raw.name ?? "").trim();
    if (!name) { failed++; continue; }
    const candidate = createExerciseSchema.safeParse({
      name,
      slug: raw.slug ? String(raw.slug) : "",
      category: raw.category ?? "compound",
      subcategory: raw.subcategory ?? "",
      muscle_group: String(raw.muscle_group ?? raw.muscleGroup ?? "Genel"),
      secondary_muscles: Array.isArray(raw.secondary_muscles) ? raw.secondary_muscles : [],
      difficulty: raw.difficulty ?? "beginner",
      equipment: raw.equipment ?? "",
      status: raw.status ?? "draft",
      media_type: "gif",
      gif_url: raw.gif_url ?? "",
      description: raw.description ?? "",
      instructions: Array.isArray(raw.instructions) ? raw.instructions : [],
      tags: Array.isArray(raw.tags) ? raw.tags : typeof raw.tags === "string" ? String(raw.tags).split(",").map((s) => s.trim()).filter(Boolean) : [],
      calories: raw.calories != null ? Number(raw.calories) : null,
      movement_type: raw.movement_type ?? "",
    });
    if (!candidate.success) { failed++; continue; }
    const row = toRow(candidate.data);
    row.slug = await ensureUniqueSlug(supabase, row.slug);
    const { error } = await supabase.from("exercises").insert(row);
    if (error) failed++;
    else inserted++;
  }
  revalidate();
  return { ok: true, data: { inserted, failed } };
}
