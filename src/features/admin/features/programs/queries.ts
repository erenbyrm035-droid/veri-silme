import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  WorkoutProgram,
  AdminProgramRow,
  ProgramDayWithExercises,
  WorkoutProgramDay,
  WorkoutProgramExercise,
  ProgramCategoryRow,
  ProgramTag,
  ProgramRelationRow,
  ProgramVersion,
  ProgramRating,
  ProgramFavorite,
} from "@/lib/database.types";
import { PROGRAMS_PAGE_SIZE, type ProgramSort } from "./constants";

function sanitize(q: string): string {
  return q.replace(/[,()*%]/g, " ").trim();
}

export interface ListProgramsParams {
  q?: string;
  category?: string;
  level?: string;
  gender?: string;
  environment?: string;
  status?: string;
  sort?: ProgramSort;
  page?: number;
}
export interface ListProgramsResult {
  rows: AdminProgramRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
}

export async function listPrograms(params: ListProgramsParams): Promise<ListProgramsResult> {
  const supabase = createAdminClient();
  const page = Math.max(1, params.page ?? 1);
  const from = (page - 1) * PROGRAMS_PAGE_SIZE;
  const to = from + PROGRAMS_PAGE_SIZE - 1;

  let query = supabase.from("workout_programs").select("*", { count: "exact" });
  if (params.category) query = query.eq("category", params.category);
  if (params.level) query = query.eq("level", params.level);
  if (params.gender) query = query.eq("gender", params.gender);
  if (params.environment) query = query.eq("environment", params.environment);
  if (params.status) query = query.eq("status", params.status);

  const term = params.q ? sanitize(params.q) : "";
  if (term) {
    query = query.or([`name.ilike.%${term}%`, `goal.ilike.%${term}%`, `category.ilike.%${term}%`].join(","));
  }

  switch (params.sort) {
    case "updated_asc": query = query.order("updated_at", { ascending: true }); break;
    case "name_asc": query = query.order("name", { ascending: true }); break;
    case "name_desc": query = query.order("name", { ascending: false }); break;
    case "rating_desc": query = query.order("rating_avg", { ascending: false }); break;
    case "popular": query = query.order("use_count", { ascending: false }).order("favorite_count", { ascending: false }); break;
    default: query = query.order("updated_at", { ascending: false });
  }
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const programs = (data ?? []) as WorkoutProgram[];
  const ids = programs.map((p) => p.id);

  // Gün + egzersiz sayıları (türetilmiş kolonlar).
  const daysByProgram = new Map<string, number>();
  const dayIdToProgram = new Map<string, string>();
  if (ids.length > 0) {
    const { data: days } = await supabase.from("workout_program_days").select("id, program_id").in("program_id", ids);
    (days ?? []).forEach((d: { id: string; program_id: string }) => {
      daysByProgram.set(d.program_id, (daysByProgram.get(d.program_id) ?? 0) + 1);
      dayIdToProgram.set(d.id, d.program_id);
    });
  }
  const exByProgram = new Map<string, number>();
  const dayIds = [...dayIdToProgram.keys()];
  if (dayIds.length > 0) {
    const { data: exs } = await supabase.from("workout_program_exercises").select("day_id").in("day_id", dayIds);
    (exs ?? []).forEach((e: { day_id: string }) => {
      const pid = dayIdToProgram.get(e.day_id);
      if (pid) exByProgram.set(pid, (exByProgram.get(pid) ?? 0) + 1);
    });
  }

  const rows: AdminProgramRow[] = programs.map((p) => ({
    ...p,
    total_days: daysByProgram.get(p.id) ?? 0,
    total_exercises: exByProgram.get(p.id) ?? 0,
  }));

  const total = count ?? 0;
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PROGRAMS_PAGE_SIZE)), pageSize: PROGRAMS_PAGE_SIZE };
}

export async function getProgram(id: string): Promise<WorkoutProgram | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("workout_programs").select("*").eq("id", id).maybeSingle();
  return (data as WorkoutProgram) ?? null;
}

/** Program takvim ağacı: gün + egzersizler. */
export async function getProgramTree(id: string): Promise<ProgramDayWithExercises[]> {
  const supabase = createAdminClient();
  const { data: days } = await supabase
    .from("workout_program_days")
    .select("*")
    .eq("program_id", id)
    .order("week")
    .order("day");
  const dayRows = (days ?? []) as WorkoutProgramDay[];
  if (dayRows.length === 0) return [];
  const { data: exs } = await supabase
    .from("workout_program_exercises")
    .select("*")
    .in("day_id", dayRows.map((d) => d.id))
    .order("sort_order");
  const byDay = new Map<string, WorkoutProgramExercise[]>();
  (exs ?? []).forEach((e: WorkoutProgramExercise) => {
    const list = byDay.get(e.day_id) ?? [];
    list.push(e);
    byDay.set(e.day_id, list);
  });
  return dayRows.map((d) => ({ ...d, exercises: byDay.get(d.id) ?? [] }));
}

export async function listCategories(): Promise<ProgramCategoryRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("program_categories").select("*").order("sort_order");
  return (data ?? []) as ProgramCategoryRow[];
}
export async function listTags(): Promise<ProgramTag[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("program_tags").select("*").order("name");
  return (data ?? []) as ProgramTag[];
}

export interface RelationWithTarget extends ProgramRelationRow {
  related_name: string;
}
export async function getRelations(id: string): Promise<RelationWithTarget[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("program_relations")
    .select("*, related:related_id (name)")
    .eq("program_id", id)
    .order("relation");
  return (data ?? []).map((r: ProgramRelationRow & { related: { name: string } | null }) => ({
    ...r,
    related_name: r.related?.name ?? "—",
  }));
}

export async function getVersions(id: string): Promise<ProgramVersion[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("program_versions").select("*").eq("program_id", id).order("version", { ascending: false }).limit(50);
  return (data ?? []) as ProgramVersion[];
}

export interface RatingWithUser extends ProgramRating {
  user_name: string | null;
}
export async function getRatings(id: string): Promise<RatingWithUser[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("program_ratings")
    .select("*, profiles:user_id (full_name)")
    .eq("program_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r: ProgramRating & { profiles: { full_name: string | null } | null }) => ({
    ...r,
    user_name: r.profiles?.full_name ?? null,
  }));
}

export interface FavoriteWithUser extends ProgramFavorite {
  user_name: string | null;
  email: string | null;
}
export async function getFavorites(id: string): Promise<FavoriteWithUser[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("program_favorites")
    .select("*, profiles:user_id (full_name)")
    .eq("program_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((r: ProgramFavorite & { profiles: { full_name: string | null } | null }) => ({
    ...r,
    user_name: r.profiles?.full_name ?? null,
    email: null,
  }));
}

export async function getProgressStats(id: string): Promise<{
  total: number;
  active: number;
  completed: number;
  abandoned: number;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("program_progress").select("status").eq("program_id", id).limit(5000);
  const rows = (data ?? []) as { status: string }[];
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    completed: rows.filter((r) => r.status === "completed").length,
    abandoned: rows.filter((r) => r.status === "abandoned").length,
  };
}

export async function searchProgramsLite(q: string, excludeId?: string): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient();
  let query = supabase.from("workout_programs").select("id, name").order("name").limit(20);
  const term = sanitize(q);
  if (term) query = query.ilike("name", `%${term}%`);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query;
  return (data ?? []) as { id: string; name: string }[];
}

/** Builder egzersiz seçici için hafif egzersiz araması. */
export async function searchExerciseLibrary(q: string): Promise<{ id: string; name: string }[]> {
  const supabase = createAdminClient();
  let query = supabase.from("exercises").select("id, name").order("name").limit(20);
  const term = sanitize(q);
  if (term) query = query.ilike("name", `%${term}%`);
  const { data } = await query;
  return (data ?? []) as { id: string; name: string }[];
}

export async function getFilterCategories(): Promise<{ slug: string; name: string }[]> {
  const cats = await listCategories();
  return cats.map((c) => ({ slug: c.slug, name: c.name }));
}
