import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { contentQuotaGuard } from "@/lib/premium/limits";
import { calcMacroTargets } from "@/lib/nutrition";
import { buildTemplateMealPlan, buildShoppingList } from "@/lib/nutrition/plan";
import { NUTRITION_GOAL_LABELS } from "@/lib/constants";
import type { NutritionGoal, Goal } from "@/lib/database.types";

export const runtime = "nodejs";
export const maxDuration = 60; // AI üretimi uzun sürer; Vercel varsayılanı (10-15 sn) yetmiyor

// Eski hedef (Goal) → beslenme hedefi eşlemesi (fallback).
const GOAL_MAP: Record<Goal, NutritionGoal> = {
  lose_weight: "lose_fat",
  gain_muscle: "gain_muscle",
  get_fit: "healthy",
  improve_endurance: "endurance",
  gain_strength: "strength",
};

/**
 * Profil + hedeflere göre kişisel öğün planı + kategori bazlı alışveriş listesi
 * üretir; meal_plans ve shopping_lists tablolarına kaydeder.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const _q = await contentQuotaGuard(supabase, user.id, "meal_plans", "diet");
  if (_q) return _q;

  const body = await request.json().catch(() => ({}));
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const nutritionGoal: NutritionGoal =
    (body?.goal as NutritionGoal) ||
    (profile?.nutrition_goal as NutritionGoal) ||
    (profile?.goal ? GOAL_MAP[profile.goal as Goal] : "healthy");

  const prefs: string[] = Array.isArray(body?.preferences)
    ? body.preferences
    : profile?.dietary_preferences ?? [];

  const targets = calcMacroTargets({
    gender: profile?.gender ?? null,
    age: profile?.age ?? null,
    height_cm: profile?.height_cm ?? null,
    weight_kg: profile?.weight_kg ?? null,
    activity_level: profile?.activity_level ?? null,
    nutrition_goal: nutritionGoal,
    weekly_training_days: profile?.weekly_training_days ?? null,
  });

  const plan = buildTemplateMealPlan(targets, prefs);
  const shopping = buildShoppingList(prefs);

  const { data: mealPlan } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      title: `${NUTRITION_GOAL_LABELS[nutritionGoal]} · Günlük Plan`,
      goal: nutritionGoal,
      target_calories: targets.calories,
      target_protein: targets.protein_g,
      target_carbs: targets.carbs_g,
      target_fat: targets.fat_g,
      plan,
    })
    .select("*")
    .single();

  const { data: shoppingList } = await supabase
    .from("shopping_lists")
    .insert({
      user_id: user.id,
      plan_id: mealPlan?.id ?? null,
      title: "Haftalık Alışveriş Listesi",
      items: shopping,
    })
    .select("*")
    .single();

  return NextResponse.json({ plan: mealPlan, targets, shopping: shoppingList });
}
