import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveAnimationKey } from "@/lib/animation/mapping";
import type { Animation, GenderSupport } from "@/lib/database.types";

/**
 * Bir egzersiz için oynatılacak animasyonu çözer.
 * 1) DB'de animation_mapping varsa (cinsiyet + öncelik) onu kullanır.
 * 2) Yoksa statik ad→anahtar eşlemesiyle animations tablosundan bulur.
 * 3) O da yoksa null (player placeholder karakter oynatır).
 */
export async function getAnimationForExercise(
  exercise: { id: string; name: string; english_name?: string | null },
  gender: GenderSupport = "both"
): Promise<Animation | null> {
  const supabase = await createClient();

  // 1) Doğrudan eşleme (cinsiyet + öncelik)
  const { data: mapped } = await supabase
    .from("animation_mapping")
    .select("priority, gender, animation:animation_id (*)")
    .eq("exercise_id", exercise.id)
    .in("gender", [gender, "both"])
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (mapped?.animation) {
    return mapped.animation as unknown as Animation;
  }

  // 2) Statik ad→anahtar eşlemesi
  const key = resolveAnimationKey(exercise.name, exercise.english_name);
  const { data: byKey } = await supabase
    .from("animations")
    .select("*")
    .eq("animation_key", key)
    .maybeSingle();
  if (byKey) return byKey as Animation;

  // 3) Genel fallback
  const { data: generic } = await supabase
    .from("animations")
    .select("*")
    .eq("animation_key", "generic_idle")
    .maybeSingle();
  return (generic as Animation) ?? null;
}

/** Tüm animasyon tanımları (admin). */
export async function getAnimations(): Promise<Animation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("animations")
    .select("*")
    .order("animation_key");
  return (data ?? []) as Animation[];
}
