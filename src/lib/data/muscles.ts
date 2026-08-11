import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Muscle, Exercise } from "@/lib/database.types";

/** Tüm kasları getirir (harita + liste için). */
export async function getMuscles(): Promise<Muscle[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("muscles")
    .select("*")
    .order("sort_order");
  return (data ?? []) as Muscle[];
}

/** Tek kası slug ile getirir. */
export async function getMuscleBySlug(slug: string): Promise<Muscle | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("muscles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  return (data as Muscle) ?? null;
}

/**
 * Bir kası çalıştıran egzersizleri getirir.
 * Birincil eşleşme: exercises.muscle_group = muscle.muscle_group
 * İkincil eşleşme: secondary_muscles içinde kasın adı/grubu geçenler.
 */
export async function getExercisesForMuscle(muscle: Muscle): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .or(
      `muscle_group.eq.${muscle.muscle_group},secondary_muscles.cs.{${muscle.name_tr}}`
    )
    .order("difficulty");
  return (data ?? []) as Exercise[];
}
