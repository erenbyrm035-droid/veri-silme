"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcMacroTargets } from "@/lib/nutrition";
import { GOAL_MULTI_OPTIONS } from "@/lib/constants";
import type {
  Gender, Experience, TrainingEnvironment, ActivityLevel, NutritionGoal, Goal,
} from "@/lib/database.types";
import { guardAction, LIMITS } from "@/lib/security/action-guard";

export interface ProfileActionResult { ok: boolean; error?: string }

/** Düzenleme formundan gelen alanlar (hepsi opsiyonel; yalnızca gönderilenler güncellenir). */
export interface ProfileUpdateInput {
  full_name?: string;
  bio?: string | null;
  birth_date?: string | null;
  gender?: Gender | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  target_weight_kg?: number | null;
  body_fat_pct?: number | null;
  activity_level?: ActivityLevel | null;
  occupation?: string | null;
  goals?: string[];
  experience?: Experience | null;
  training_environment?: TrainingEnvironment | null;
  available_equipment?: string[];
  preferred_workout_duration?: number | null;
  weekly_training_days?: number | null;
  nutrition_goal?: NutritionGoal | null;
  daily_calorie_goal?: number;
  daily_protein_goal?: number;
  daily_carb_goal?: number | null;
  daily_fat_goal?: number | null;
  daily_water_goal_ml?: number;
  injuries?: string[];
  health_conditions?: string[];
  allergies?: string[];
  health_notes?: string | null;
  daily_sitting_hours?: number | null;
  sleep_hours?: number | null;
  water_intake_ml?: number | null;
  smoking_status?: string | null;
  recalcMacros?: boolean; // beslenme alanları değiştiyse makroları yeniden hesapla
}

function ageFromBirth(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const b = new Date(iso);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

/**
 * Profili GÜNCELLER (yalnızca UPDATE — asla INSERT).
 * Onboarding'den bağımsız; kayıt/oluşturma hissi yoktur.
 */
export async function updateProfile(input: ProfileUpdateInput): Promise<ProfileActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  const rl = await guardAction("profile:update", user.id, LIMITS.post);
  if (!rl.ok) return { ok: false, error: rl.error };

  // Yalnızca tanımlı alanları güncelleme setine al.
  const patch: Record<string, unknown> = {};
  const set = <K extends keyof ProfileUpdateInput>(k: K) => {
    if (input[k] !== undefined) patch[k as string] = input[k];
  };
  ([
    "full_name", "bio", "birth_date", "gender", "height_cm", "weight_kg", "target_weight_kg",
    "body_fat_pct", "activity_level", "occupation", "goals", "experience", "training_environment",
    "available_equipment", "preferred_workout_duration", "weekly_training_days", "nutrition_goal",
    "daily_calorie_goal", "daily_protein_goal", "daily_carb_goal", "daily_fat_goal",
    "daily_water_goal_ml", "injuries", "health_conditions", "allergies", "health_notes",
    "daily_sitting_hours", "sleep_hours", "water_intake_ml", "smoking_status",
  ] as (keyof ProfileUpdateInput)[]).forEach(set);

  // Doğum tarihi güncellendiyse yaşı da eşle. Birincil hedefi de yansıt.
  if (input.birth_date !== undefined) patch.age = ageFromBirth(input.birth_date);
  if (input.goals && input.goals.length) {
    const primary: Goal = GOAL_MULTI_OPTIONS.find((o) => o.value === input.goals![0])?.primary ?? "get_fit";
    patch.goal = primary;
  }

  // Beslenme yeniden hesabı istendiyse ve gerekli veriler mevcutsa makroları güncelle.
  if (input.recalcMacros) {
    const { data: p } = await supabase
      .from("profiles")
      .select("gender, height_cm, weight_kg, activity_level, nutrition_goal, weekly_training_days, birth_date, age")
      .eq("id", user.id).maybeSingle();
    if (p) {
      const gender = (input.gender ?? p.gender) as Gender | null;
      const height = input.height_cm ?? p.height_cm;
      const weight = input.weight_kg ?? p.weight_kg;
      const activity = (input.activity_level ?? p.activity_level) as ActivityLevel | null;
      const nGoal = (input.nutrition_goal ?? p.nutrition_goal) as NutritionGoal | null;
      const days = input.weekly_training_days ?? p.weekly_training_days;
      const age = ageFromBirth(input.birth_date ?? p.birth_date) ?? p.age ?? 30;
      if (height && weight) {
        const macros = calcMacroTargets({
          gender, age, height_cm: height, weight_kg: weight,
          activity_level: activity, nutrition_goal: nGoal, weekly_training_days: days,
        });
        if (macros.calories) {
          patch.daily_calorie_goal = macros.calories;
          patch.daily_protein_goal = macros.protein_g;
          patch.daily_carb_goal = macros.carbs_g;
          patch.daily_fat_goal = macros.fat_g;
          patch.daily_fiber_goal = macros.fiber_g;
          patch.daily_water_goal_ml = macros.water_ml;
        }
      }
    }
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Avatar URL'ini günceller (yükleme client'ta Storage'a yapılır). */
export async function setAvatar(url: string | null): Promise<ProfileActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  const rl = await guardAction("profile:avatar", user.id, LIMITS.post);
  if (!rl.ok) return { ok: false, error: rl.error };
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/profile");
  return { ok: true };
}
