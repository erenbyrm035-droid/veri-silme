import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ReadyProgram {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category: string | null;
  level: string;
  goal: string | null;
  gender: string;
  environment: string;
  weeks: number;
  days_per_week: number;
  est_minutes: number | null;
  calories: number | null;
  tags: string[];
  rating_avg: number;
  rating_count: number;
  use_count: number;
}

export interface ReadyExercise {
  exercise_id: string | null;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  rest_sec: number | null;
  note: string | null;
}

export interface ReadyDay {
  id: string;
  week: number;
  day: number;
  title: string | null;
  focus: string | null;
  is_rest: boolean;
  exercises: ReadyExercise[];
}

export interface ProgramCategory { slug: string; name: string }

/** Yayınlanmış hazır programlar (katalog). */
export async function listReadyPrograms(): Promise<ReadyProgram[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_programs")
    .select("id, slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, rating_avg, rating_count, use_count")
    .eq("status", "published")
    .order("sort_order", { ascending: true });
  return (data as ReadyProgram[]) ?? [];
}

/** Programlarda geçen kategori sluglarına karşılık gelen kategori adları. */
export async function listProgramCategories(): Promise<ProgramCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_categories")
    .select("slug, name")
    .order("sort_order", { ascending: true });
  return (data as ProgramCategory[]) ?? [];
}

/** Tek program + günleri + egzersizleri (slug ile). */
export async function getReadyProgram(slug: string): Promise<{ program: ReadyProgram; days: ReadyDay[] } | null> {
  const supabase = await createClient();
  const { data: program } = await supabase
    .from("workout_programs")
    .select("id, slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, rating_avg, rating_count, use_count")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!program) return null;

  const { data: dayRows } = await supabase
    .from("workout_program_days")
    .select("id, week, day, title, focus, is_rest")
    .eq("program_id", program.id)
    .order("week", { ascending: true })
    .order("day", { ascending: true });
  const days = (dayRows ?? []) as Omit<ReadyDay, "exercises">[];

  const dayIds = days.map((d) => d.id);
  let exByDay: Record<string, ReadyExercise[]> = {};
  if (dayIds.length) {
    const { data: exRows } = await supabase
      .from("workout_program_exercises")
      .select("day_id, exercise_id, exercise_name, sets, reps, rest_sec, note, sort_order")
      .in("day_id", dayIds)
      .order("sort_order", { ascending: true });
    exByDay = (exRows ?? []).reduce((acc: Record<string, ReadyExercise[]>, r: ReadyExercise & { day_id: string }) => {
      (acc[r.day_id] ??= []).push({ exercise_id: r.exercise_id, exercise_name: r.exercise_name, sets: r.sets, reps: r.reps, rest_sec: r.rest_sec, note: r.note });
      return acc;
    }, {});
  }

  return {
    program: program as ReadyProgram,
    days: days.map((d) => ({ ...d, exercises: exByDay[d.id] ?? [] })),
  };
}

/** Kullanıcının başlattığı programların durumu (program_id → status/pct). */
export async function getMyProgramProgress(userId: string): Promise<Record<string, { status: string; progress_pct: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_progress")
    .select("program_id, status, progress_pct")
    .eq("user_id", userId);
  const map: Record<string, { status: string; progress_pct: number }> = {};
  for (const r of (data ?? []) as { program_id: string; status: string; progress_pct: number }[]) {
    map[r.program_id] = { status: r.status, progress_pct: r.progress_pct };
  }
  return map;
}
