import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  Exercise,
  AdminExerciseRow,
  ExerciseCategory,
  ExerciseCategoryRow,
  ExerciseTag,
  ExerciseMuscleLink,
  ExerciseMediaRow,
  ExerciseRelationRow,
  ExerciseVersion,
  ExerciseStatus,
  Difficulty,
  DuplicateGroup,
  Muscle,
} from "@/lib/database.types";
import { EXERCISES_PAGE_SIZE, type ExerciseSort } from "./constants";

const LIST_COLUMNS =
  "id,name,slug,category,subcategory,muscle_group,secondary_muscles,difficulty,equipment,status,gif_url,media_type,tags,movement_type,updated_at";

function sanitize(q: string): string {
  return q.replace(/[,()*%]/g, " ").trim();
}

export interface ListExercisesParams {
  q?: string;
  category?: string;
  subcategory?: string;
  difficulty?: string;
  equipment?: string;
  muscleGroup?: string;
  status?: string;
  sort?: ExerciseSort;
  page?: number;
}

export interface ListExercisesResult {
  rows: AdminExerciseRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export async function listExercises(params: ListExercisesParams): Promise<ListExercisesResult> {
  const supabase = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * EXERCISES_PAGE_SIZE;
  const to = from + EXERCISES_PAGE_SIZE - 1;

  let query = supabase.from("exercises").select(LIST_COLUMNS, { count: "exact" });

  if (params.category) query = query.eq("category", params.category);
  if (params.subcategory) query = query.eq("subcategory", params.subcategory);
  if (params.difficulty) query = query.eq("difficulty", params.difficulty);
  if (params.equipment) query = query.eq("equipment", params.equipment);
  if (params.muscleGroup) query = query.eq("muscle_group", params.muscleGroup);
  if (params.status) query = query.eq("status", params.status);

  const term = params.q ? sanitize(params.q) : "";
  if (term) {
    query = query.or(
      [
        `name.ilike.%${term}%`,
        `muscle_group.ilike.%${term}%`,
        `equipment.ilike.%${term}%`,
        `subcategory.ilike.%${term}%`,
        `category.ilike.%${term}%`,
        `movement_type.ilike.%${term}%`,
      ].join(",")
    );
  }

  switch (params.sort) {
    case "updated_asc":
      query = query.order("updated_at", { ascending: true });
      break;
    case "name_asc":
      query = query.order("name", { ascending: true });
      break;
    case "name_desc":
      query = query.order("name", { ascending: false });
      break;
    case "created_desc":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return {
    rows: (data ?? []) as AdminExerciseRow[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / EXERCISES_PAGE_SIZE)),
    pageSize: EXERCISES_PAGE_SIZE,
  };
}

export async function getExerciseFull(id: string): Promise<Exercise | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("exercises").select("*").eq("id", id).maybeSingle();
  return (data as Exercise) ?? null;
}

export async function getExerciseMuscles(id: string): Promise<ExerciseMuscleLink[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("exercise_muscles")
    .select("*")
    .eq("exercise_id", id)
    .order("role")
    .order("sort_order");
  return (data ?? []) as ExerciseMuscleLink[];
}

export async function getExerciseMedia(id: string): Promise<ExerciseMediaRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("exercise_media")
    .select("*")
    .eq("exercise_id", id)
    .order("is_primary", { ascending: false })
    .order("sort_order");
  return (data ?? []) as ExerciseMediaRow[];
}

export interface RelationWithTarget extends ExerciseRelationRow {
  related_name: string;
  related_slug: string | null;
}

export async function getRelations(id: string): Promise<RelationWithTarget[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("exercise_relations")
    .select("*, related:related_id (name, slug)")
    .eq("exercise_id", id)
    .order("relation");
  return (data ?? []).map((r: ExerciseRelationRow & { related: { name: string; slug: string | null } | null }) => ({
    ...r,
    related_name: r.related?.name ?? "—",
    related_slug: r.related?.slug ?? null,
  }));
}

export async function getVersions(id: string): Promise<ExerciseVersion[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("exercise_versions")
    .select("*")
    .eq("exercise_id", id)
    .order("version", { ascending: false })
    .limit(50);
  return (data ?? []) as ExerciseVersion[];
}

export async function listCategories(): Promise<ExerciseCategoryRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("exercise_categories").select("*").order("sort_order");
  return (data ?? []) as ExerciseCategoryRow[];
}

export async function listTags(): Promise<ExerciseTag[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("exercise_tags").select("*").order("name");
  return (data ?? []) as ExerciseTag[];
}

export async function listMuscles(): Promise<Pick<Muscle, "id" | "slug" | "name_tr" | "region" | "muscle_group">[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("muscles")
    .select("id, slug, name_tr, region, muscle_group")
    .order("sort_order");
  return (data ?? []) as Pick<Muscle, "id" | "slug" | "name_tr" | "region" | "muscle_group">[];
}

/** İlişki seçici için hafif egzersiz araması. */
export async function searchExercisesLite(
  q: string,
  excludeId?: string
): Promise<{ id: string; name: string; slug: string | null }[]> {
  const supabase = createAdminClient();
  let query = supabase.from("exercises").select("id, name, slug").order("name").limit(20);
  const term = sanitize(q);
  if (term) query = query.ilike("name", `%${term}%`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return (data ?? []) as { id: string; name: string; slug: string | null }[];
}

/** Filtre açılırları için ayrık değerler. */
export async function getFilterOptions(): Promise<{
  muscleGroups: string[];
  equipments: string[];
  subcategories: string[];
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("exercises")
    .select("muscle_group, equipment, subcategory")
    .limit(5000);
  const rows = (data ?? []) as { muscle_group: string; equipment: string | null; subcategory: string | null }[];
  const uniq = (arr: (string | null)[]) =>
    [...new Set(arr.filter((x): x is string => !!x && x.trim() !== ""))].sort((a, b) => a.localeCompare(b, "tr"));
  return {
    muscleGroups: uniq(rows.map((r) => r.muscle_group)),
    equipments: uniq(rows.map((r) => r.equipment)),
    subcategories: uniq(rows.map((r) => r.subcategory)),
  };
}

/** İsim benzerliğine göre olası tekrarları grupla. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(barbell|dumbbell|machine|cable|smith|kettlebell|band|bodyweight|halter|dambıl|makine|barfiks)\b/g, " ")
    .replace(/[^a-z0-9ğüşiöç\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findDuplicates(): Promise<DuplicateGroup[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("exercises")
    .select("id, name, slug, status")
    .order("name")
    .limit(5000);
  const rows = (data ?? []) as { id: string; name: string; slug: string | null; status: ExerciseStatus }[];
  const map = new Map<string, DuplicateGroup["exercises"]>();
  for (const r of rows) {
    const key = normalizeName(r.name);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push({ id: r.id, name: r.name, slug: r.slug, status: r.status });
    map.set(key, list);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, exercises]) => ({ key, exercises }))
    .sort((a, b) => b.exercises.length - a.exercises.length);
}

/** GIF eşleştirme raporu: eşleşen / eksik GIF / kullanılmayan GIF. */
export interface GifMatchReport {
  totalExercises: number;
  totalGifs: number;
  matched: { slug: string; name: string }[];
  missingGif: { id: string; name: string; slug: string | null }[];
  unusedGifs: string[];
}

export async function getGifMatchReport(): Promise<GifMatchReport> {
  const supabase = createAdminClient();
  const [{ data: exData }, storage] = await Promise.all([
    supabase.from("exercises").select("id, name, slug, gif_url").limit(5000),
    supabase.storage.from("exercise-media").list("", { limit: 5000 }),
  ]);
  const exercises = (exData ?? []) as { id: string; name: string; slug: string | null; gif_url: string | null }[];
  const files = (storage.data ?? []).map((f: { name: string }) => f.name).filter((n: string) => /\.(gif|webp|png|jpg|jpeg)$/i.test(n));
  const fileSet = new Set(files.map((f: string) => f.replace(/\.[^.]+$/, "")));
  const usedSlugs = new Set<string>();

  const matched: { slug: string; name: string }[] = [];
  const missingGif: { id: string; name: string; slug: string | null }[] = [];
  for (const ex of exercises) {
    const hasBySlug = ex.slug ? fileSet.has(ex.slug) : false;
    if (ex.gif_url || hasBySlug) {
      matched.push({ slug: ex.slug ?? "", name: ex.name });
      if (ex.slug) usedSlugs.add(ex.slug);
    } else {
      missingGif.push({ id: ex.id, name: ex.name, slug: ex.slug });
    }
  }
  const unusedGifs = files.filter((f: string) => !usedSlugs.has(f.replace(/\.[^.]+$/, "")));

  return {
    totalExercises: exercises.length,
    totalGifs: files.length,
    matched,
    missingGif,
    unusedGifs,
  };
}
