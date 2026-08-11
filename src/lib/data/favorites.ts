import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/database.types";

/** Kullanıcının favori egzersiz id kümesi. */
export async function getFavoriteIds(userId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select("exercise_id")
    .eq("user_id", userId);
  return new Set((data ?? []).map((f) => f.exercise_id as string));
}

/** Kullanıcının favori egzersizleri (tam kayıt). */
export async function getFavoriteExercises(userId: string): Promise<Exercise[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favorites")
    .select("exercise:exercise_id (*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? [])
    .map((r) => r.exercise as unknown as Exercise | null)
    .filter((e): e is Exercise => e !== null);
}
