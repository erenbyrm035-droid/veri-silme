"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { CATALOG_TAGS } from "@/lib/data/catalog";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { slugify } from "./constants";
import { TEMPLATE_BY_SLUG } from "./templates";
import {
  createProgramSchema,
  updateProgramSchema,
  idSchema,
  bulkIdsSchema,
  bulkStatusSchema,
  bulkCategorySchema,
  daySchema,
  dayUpdateSchema,
  dayIdSchema,
  exerciseSchema,
  exerciseUpdateSchema,
  exerciseIdSchema,
  reorderSchema,
  relationSchema,
  relationIdSchema,
  versionRestoreSchema,
  applyTemplateSchema,
  importSchema,
  type ProgramFormValues,
} from "./schema";

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}
const fail = (error: string): ActionResult<never> => ({ ok: false, error });

function revalidate(id?: string) {
  revalidatePath("/admin/programs");
  if (id) revalidatePath(`/admin/programs/${id}`);
  revalidateTag(CATALOG_TAGS.programs);
}

const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);

function toRow(v: z.output<typeof createProgramSchema>) {
  return {
    name: v.name.trim(),
    slug: v.slug && v.slug.trim() ? slugify(v.slug) : slugify(v.name),
    cover_url: empty(v.cover_url),
    short_description: empty(v.short_description),
    description: empty(v.description),
    category: empty(v.category),
    level: v.level,
    goal: empty(v.goal),
    gender: v.gender,
    environment: v.environment,
    weeks: v.weeks,
    days_per_week: v.days_per_week,
    est_minutes: v.est_minutes ?? null,
    calories: v.calories ?? null,
    tags: v.tags ?? [],
    status: v.status ?? "draft",
  };
}

async function ensureUniqueSlug(supabase: ReturnType<typeof createAdminClient>, slug: string, ignoreId?: string): Promise<string> {
  let candidate = slug || "program";
  for (let i = 0; i < 50; i++) {
    let q = supabase.from("workout_programs").select("id").eq("slug", candidate).limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data } = await q;
    if (!data || data.length === 0) return candidate;
    candidate = `${slug}-${i + 2}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

// --------------------------------------------------------------------------- PROGRAM
export async function createProgram(input: ProgramFormValues): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdmin();
  const parsed = createProgramSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const row = toRow(parsed.data);
  row.slug = await ensureUniqueSlug(supabase, row.slug);
  const { data, error } = await supabase.from("workout_programs").insert({ ...row, created_by: ctx.id, updated_by: ctx.id }).select("id").single();
  if (error) return fail(error.message);
  revalidate();
  return { ok: true, data: { id: data.id as string } };
}

async function snapshotProgram(supabase: ReturnType<typeof createAdminClient>, programId: string) {
  const [{ data: program }, { data: days }] = await Promise.all([
    supabase.from("workout_programs").select("*").eq("id", programId).maybeSingle(),
    supabase.from("workout_program_days").select("*").eq("program_id", programId),
  ]);
  const dayIds = (days ?? []).map((d: { id: string }) => d.id);
  let exs: unknown[] = [];
  if (dayIds.length > 0) {
    const { data: e } = await supabase.from("workout_program_exercises").select("*").in("day_id", dayIds);
    exs = e ?? [];
  }
  return { program, days: days ?? [], exercises: exs };
}

export async function updateProgram(input: z.input<typeof updateProgramSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = updateProgramSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { id, change_note } = parsed.data;

  const snapshot = await snapshotProgram(supabase, id);
  if (!snapshot.program) return fail("Program bulunamadı.");
  const { data: last } = await supabase.from("program_versions").select("version").eq("program_id", id).order("version", { ascending: false }).limit(1);
  await supabase.from("program_versions").insert({
    program_id: id,
    version: ((last?.[0]?.version as number) ?? 0) + 1,
    snapshot,
    changed_by: ctx.id,
    changed_by_name: ctx.fullName ?? ctx.email,
    change_note: change_note ?? null,
  });

  const row = toRow(parsed.data);
  row.slug = await ensureUniqueSlug(supabase, row.slug, id);
  const { error } = await supabase.from("workout_programs").update({ ...row, updated_by: ctx.id }).eq("id", id);
  if (error) return fail(error.message);
  revalidate(id);
  return { ok: true };
}

export async function setStatus(input: { id: string; status: "published" | "draft" }): Promise<ActionResult> {
  await requireAdmin();
  if (!idSchema.safeParse({ id: input.id }).success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_programs").update({ status: input.status }).eq("id", input.id);
  if (error) return fail(error.message);
  revalidate(input.id);
  return { ok: true };
}

export async function deleteProgram(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_programs").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

/** Programı gün + egzersizleriyle birlikte çoğaltır. */
export async function duplicateProgram(input: z.infer<typeof idSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { data: src } = await supabase.from("workout_programs").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!src) return fail("Program bulunamadı.");

  const { id: _id, created_at: _c, updated_at: _u, rating_avg, rating_count, favorite_count, use_count, completion_rate, ...rest } = src as Record<string, unknown>;
  void _id; void _c; void _u; void rating_avg; void rating_count; void favorite_count; void use_count; void completion_rate;
  const newSlug = await ensureUniqueSlug(supabase, `${src.slug}-kopya`);
  const { data: created, error } = await supabase
    .from("workout_programs")
    .insert({ ...rest, name: `${src.name} (Kopya)`, slug: newSlug, status: "draft", created_by: ctx.id, updated_by: ctx.id })
    .select("id")
    .single();
  if (error) return fail(error.message);
  const newId = created.id as string;

  const { data: days } = await supabase.from("workout_program_days").select("*").eq("program_id", parsed.data.id);
  for (const d of (days ?? []) as Record<string, unknown>[]) {
    const { id: oldDayId, program_id: _p, created_at: _dc, ...dayRest } = d;
    void _p; void _dc;
    const { data: newDay } = await supabase.from("workout_program_days").insert({ ...dayRest, program_id: newId }).select("id").single();
    const { data: exs } = await supabase.from("workout_program_exercises").select("*").eq("day_id", oldDayId as string);
    if (newDay && exs && exs.length > 0) {
      const rows = (exs as Record<string, unknown>[]).map((e) => {
        const { id: _ei, day_id: _d, created_at: _ec, ...exRest } = e;
        void _ei; void _d; void _ec;
        return { ...exRest, day_id: newDay.id };
      });
      await supabase.from("workout_program_exercises").insert(rows);
    }
  }
  revalidate();
  return { ok: true, data: { id: newId } };
}

// --------------------------------------------------------------------------- BULK
export async function bulkDelete(input: z.infer<typeof bulkIdsSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkIdsSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_programs").delete().in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}
export async function bulkSetStatus(input: z.infer<typeof bulkStatusSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkStatusSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_programs").update({ status: parsed.data.status }).in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}
export async function bulkSetCategory(input: z.infer<typeof bulkCategorySchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkCategorySchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_programs").update({ category: parsed.data.category }).in("id", parsed.data.ids);
  if (error) return fail(error.message);
  revalidate();
  return { ok: true };
}

// --------------------------------------------------------------------------- DAYS
export async function addDay(input: z.input<typeof daySchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = daySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_program_days").upsert(
    {
      program_id: parsed.data.programId,
      week: parsed.data.week,
      day: parsed.data.day,
      title: parsed.data.title ?? null,
      focus: parsed.data.focus ?? null,
      notes: parsed.data.notes ?? null,
      is_rest: parsed.data.is_rest,
      sort_order: parsed.data.week * 10 + parsed.data.day,
    },
    { onConflict: "program_id,week,day" }
  );
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}
export async function updateDay(input: z.infer<typeof dayUpdateSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = dayUpdateSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.focus !== undefined) patch.focus = parsed.data.focus;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.is_rest !== undefined) patch.is_rest = parsed.data.is_rest;
  const { error } = await supabase.from("workout_program_days").update(patch).eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}
export async function deleteDay(input: z.infer<typeof dayIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = dayIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_program_days").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}

// --------------------------------------------------------------------------- EXERCISES
function exToRow(v: z.output<typeof exerciseSchema>) {
  return {
    day_id: v.dayId,
    exercise_id: v.exercise_id ?? null,
    exercise_name: v.exercise_name.trim(),
    block_type: v.block_type ?? "normal",
    block_group: v.block_group ?? 0,
    sets: v.sets ?? null,
    reps: empty(v.reps),
    duration_sec: v.duration_sec ?? null,
    rest_sec: v.rest_sec ?? null,
    tempo: empty(v.tempo),
    rpe: v.rpe ?? null,
    rir: v.rir ?? null,
    note: empty(v.note),
  };
}
export async function addExercise(input: z.input<typeof exerciseSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { data: countData } = await supabase.from("workout_program_exercises").select("id").eq("day_id", parsed.data.dayId);
  const sort = (countData?.length ?? 0);
  const { error } = await supabase.from("workout_program_exercises").insert({ ...exToRow(parsed.data), sort_order: sort });
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}
export async function updateExercise(input: z.input<typeof exerciseUpdateSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = exerciseUpdateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_program_exercises").update(exToRow(parsed.data)).eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}
export async function deleteExercise(input: z.infer<typeof exerciseIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = exerciseIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("workout_program_exercises").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}
/** Sürükle-bırak sonrası yeni sıralamayı kaydeder. */
export async function reorderExercises(input: z.infer<typeof reorderSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  for (let i = 0; i < parsed.data.orderedIds.length; i++) {
    await supabase.from("workout_program_exercises").update({ sort_order: i }).eq("id", parsed.data.orderedIds[i]);
  }
  revalidate(parsed.data.programId);
  return { ok: true };
}

// --------------------------------------------------------------------------- RELATIONS
export async function addRelation(input: z.infer<typeof relationSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = relationSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  if (parsed.data.programId === parsed.data.relatedId) return fail("Program kendisiyle ilişkilendirilemez.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("program_relations").upsert(
    { program_id: parsed.data.programId, related_id: parsed.data.relatedId, relation: parsed.data.relation },
    { onConflict: "program_id,related_id,relation" }
  );
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}
export async function removeRelation(input: z.infer<typeof relationIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = relationIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("program_relations").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  revalidate(parsed.data.programId);
  return { ok: true };
}

// --------------------------------------------------------------------------- VERSION
export async function restoreVersion(input: z.infer<typeof versionRestoreSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = versionRestoreSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { data: ver } = await supabase.from("program_versions").select("snapshot").eq("id", parsed.data.versionId).maybeSingle();
  if (!ver) return fail("Sürüm bulunamadı.");
  const snap = ver.snapshot as { program?: Record<string, unknown>; days?: Record<string, unknown>[]; exercises?: Record<string, unknown>[] };

  // Mevcut durumu yedekle.
  const current = await snapshotProgram(supabase, parsed.data.programId);
  const { data: last } = await supabase.from("program_versions").select("version").eq("program_id", parsed.data.programId).order("version", { ascending: false }).limit(1);
  await supabase.from("program_versions").insert({
    program_id: parsed.data.programId,
    version: ((last?.[0]?.version as number) ?? 0) + 1,
    snapshot: current,
    changed_by: ctx.id,
    changed_by_name: ctx.fullName ?? ctx.email,
    change_note: "Geri yükleme öncesi otomatik yedek",
  });

  // Program alanlarını geri yükle.
  if (snap.program) {
    const { id: _i, created_at: _c, ...rest } = snap.program;
    void _i; void _c;
    await supabase.from("workout_programs").update({ ...rest, updated_by: ctx.id }).eq("id", parsed.data.programId);
  }
  // Gün + egzersizleri yeniden kur.
  await supabase.from("workout_program_days").delete().eq("program_id", parsed.data.programId);
  const oldToNewDay = new Map<string, string>();
  for (const d of snap.days ?? []) {
    const { id: oldId, program_id: _p, created_at: _dc, ...rest } = d;
    void _p; void _dc;
    const { data: nd } = await supabase.from("workout_program_days").insert({ ...rest, program_id: parsed.data.programId }).select("id").single();
    if (nd && oldId) oldToNewDay.set(oldId as string, nd.id as string);
  }
  const exRows = (snap.exercises ?? []).map((e) => {
    const { id: _e, day_id, created_at: _ec, ...rest } = e;
    void _e; void _ec;
    return { ...rest, day_id: oldToNewDay.get(day_id as string) };
  }).filter((e) => e.day_id);
  if (exRows.length > 0) await supabase.from("workout_program_exercises").insert(exRows);

  revalidate(parsed.data.programId);
  return { ok: true };
}

// --------------------------------------------------------------------------- TEMPLATE
export async function applyTemplate(input: z.infer<typeof applyTemplateSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdmin();
  const parsed = applyTemplateSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const tpl = TEMPLATE_BY_SLUG.get(parsed.data.templateSlug);
  if (!tpl) return fail("Şablon bulunamadı.");

  const supabase = createAdminClient();
  const name = parsed.data.name?.trim() || tpl.name;
  const slug = await ensureUniqueSlug(supabase, slugify(name));
  const daysPerWeek = tpl.days.length;
  const { data: prog, error } = await supabase.from("workout_programs").insert({
    name, slug, category: tpl.category, level: tpl.level, weeks: tpl.weeks,
    days_per_week: daysPerWeek, status: "draft", created_by: ctx.id, updated_by: ctx.id,
    short_description: `${tpl.name} şablonundan oluşturuldu.`,
  }).select("id").single();
  if (error) return fail(error.message);
  const programId = prog.id as string;

  for (let w = 1; w <= tpl.weeks; w++) {
    for (let di = 0; di < tpl.days.length; di++) {
      const td = tpl.days[di];
      const { data: day } = await supabase.from("workout_program_days").insert({
        program_id: programId, week: w, day: di + 1, title: td.title, focus: td.focus,
        is_rest: td.is_rest ?? false, sort_order: w * 10 + (di + 1),
      }).select("id").single();
      if (day && td.exercises.length > 0) {
        const rows = td.exercises.map((e, i) => ({
          day_id: day.id, exercise_name: e.name, sets: e.sets, reps: e.reps,
          rest_sec: e.rest_sec ?? null, block_type: "normal", sort_order: i,
        }));
        await supabase.from("workout_program_exercises").insert(rows);
      }
    }
  }
  revalidate();
  return { ok: true, data: { id: programId } };
}

// --------------------------------------------------------------------------- IMPORT / EXPORT
export async function exportPrograms(format: "json" | "csv"): Promise<ActionResult<{ content: string; filename: string; mime: string }>> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: programs } = await supabase.from("workout_programs").select("*").order("name").limit(1000);
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    const cols = ["name", "slug", "category", "level", "goal", "gender", "environment", "weeks", "days_per_week", "status"];
    const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = (programs ?? []) as Record<string, unknown>[];
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
    return { ok: true, data: { content: csv, filename: `programlar-${stamp}.csv`, mime: "text/csv;charset=utf-8" } };
  }
  // JSON: gün + egzersiz ağacıyla.
  const full = [];
  for (const p of (programs ?? []) as { id: string }[]) {
    const { data: days } = await supabase.from("workout_program_days").select("*").eq("program_id", p.id);
    const dayIds = (days ?? []).map((d: { id: string }) => d.id);
    let exs: unknown[] = [];
    if (dayIds.length > 0) { const { data } = await supabase.from("workout_program_exercises").select("*").in("day_id", dayIds); exs = data ?? []; }
    full.push({ ...p, days, exercises: exs });
  }
  return { ok: true, data: { content: JSON.stringify(full, null, 2), filename: `programlar-${stamp}.json`, mime: "application/json" } };
}

export async function importPrograms(input: z.infer<typeof importSchema>): Promise<ActionResult<{ inserted: number; failed: number }>> {
  const ctx = await requireAdmin();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz içe aktarma verisi.");
  const supabase = createAdminClient();
  let inserted = 0, failed = 0;
  for (const raw of parsed.data.programs) {
    const candidate = createProgramSchema.safeParse({
      name: String(raw.name ?? ""),
      slug: raw.slug ? String(raw.slug) : "",
      category: raw.category ?? "",
      level: raw.level ?? "beginner",
      goal: raw.goal ?? "",
      gender: raw.gender ?? "both",
      environment: raw.environment ?? "both",
      weeks: raw.weeks != null ? Number(raw.weeks) : 4,
      days_per_week: raw.days_per_week != null ? Number(raw.days_per_week) : 3,
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      status: raw.status ?? "draft",
    });
    if (!candidate.success) { failed++; continue; }
    const row = toRow(candidate.data);
    row.slug = await ensureUniqueSlug(supabase, row.slug);
    const { data: prog, error } = await supabase.from("workout_programs").insert({ ...row, created_by: ctx.id, updated_by: ctx.id }).select("id").single();
    if (error) { failed++; continue; }
    inserted++;
    // Ağaç varsa günleri + egzersizleri ekle.
    const days = Array.isArray(raw.days) ? (raw.days as Record<string, unknown>[]) : [];
    const exercises = Array.isArray(raw.exercises) ? (raw.exercises as Record<string, unknown>[]) : [];
    const oldToNew = new Map<string, string>();
    for (const d of days) {
      const { data: nd } = await supabase.from("workout_program_days").insert({
        program_id: prog.id, week: Number(d.week ?? 1), day: Number(d.day ?? 1),
        title: d.title ?? null, focus: d.focus ?? null, is_rest: Boolean(d.is_rest),
      }).select("id").single();
      if (nd && d.id) oldToNew.set(String(d.id), nd.id as string);
    }
    const exRows = exercises.map((e) => ({
      day_id: oldToNew.get(String(e.day_id)), exercise_name: String(e.exercise_name ?? "Egzersiz"),
      sets: e.sets != null ? Number(e.sets) : null, reps: e.reps ?? null, block_type: e.block_type ?? "normal",
    })).filter((e) => e.day_id);
    if (exRows.length > 0) await supabase.from("workout_program_exercises").insert(exRows);
  }
  revalidate();
  return { ok: true, data: { inserted, failed } };
}
