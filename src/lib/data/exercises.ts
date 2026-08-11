import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Exercise, WorkoutSet } from "@/lib/database.types";

/** Tüm egzersizleri getirir (kütüphane listesi için). */
export async function getExercises(): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .order("muscle_group")
    .order("name");
  return (data ?? []) as Exercise[];
}

/** Tek egzersizi id ile getirir. */
export async function getExerciseById(id: string): Promise<Exercise | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Exercise) ?? null;
}

export interface AlternativeExercise extends Exercise {
  relation: string;
}

/** Bir egzersizin alternatif/benzer/ev/salon ilişkilerini getirir. */
export async function getAlternatives(
  exerciseId: string
): Promise<AlternativeExercise[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercise_alternatives")
    .select("relation, alt:alt_exercise_id (*)")
    .eq("exercise_id", exerciseId);

  return (data ?? [])
    .map((row) => {
      const alt = row.alt as unknown as Exercise | null;
      if (!alt) return null;
      return { ...alt, relation: row.relation as string };
    })
    .filter((x): x is AlternativeExercise => x !== null);
}

/**
 * Kullanıcının bu egzersizde geçmiş ağırlık kayıtlarını getirir
 * (tamamlanan setler, tarihe göre).
 */
export async function getExerciseWeightHistory(
  userId: string,
  exerciseId: string,
  limit = 20
): Promise<(WorkoutSet & { workout_date: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_sets")
    .select("*, workouts!inner(user_id, workout_date)")
    .eq("exercise_id", exerciseId)
    .eq("workouts.user_id", userId)
    .eq("completed", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const w = row.workouts as unknown as { workout_date: string };
    return { ...(row as unknown as WorkoutSet), workout_date: w.workout_date };
  });
}
