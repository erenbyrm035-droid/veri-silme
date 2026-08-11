import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import type {
  MealPlan,
  ShoppingList,
  NutritionReport,
} from "@/lib/database.types";
import type { WeekAggregate } from "@/lib/nutrition/report";

export interface TodayNutrition {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  waterMl: number;
  mealCount: number;
}

/** Bugünün toplam makro + su verisi. */
export async function getTodayNutrition(userId: string): Promise<TodayNutrition> {
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: logs }, { data: water }] = await Promise.all([
    supabase
      .from("nutrition_logs")
      .select("calories, protein_g, carbs_g, fat_g")
      .eq("user_id", userId)
      .eq("log_date", today),
    supabase
      .from("water_logs")
      .select("amount_ml")
      .eq("user_id", userId)
      .eq("log_date", today),
  ]);
  const rows = logs ?? [];
  const sum = rows.reduce(
    (a, r) => ({
      calories: a.calories + Number(r.calories),
      protein_g: a.protein_g + Number(r.protein_g),
      carbs_g: a.carbs_g + Number(r.carbs_g),
      fat_g: a.fat_g + Number(r.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  return {
    ...sum,
    fiber_g: 0,
    waterMl: (water ?? []).reduce((s, w) => s + Number(w.amount_ml), 0),
    mealCount: rows.length,
  };
}

export async function getLatestMealPlan(userId: string): Promise<MealPlan | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meal_plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MealPlan) ?? null;
}

export async function getLatestShoppingList(
  userId: string
): Promise<ShoppingList | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ShoppingList) ?? null;
}

export async function getReports(userId: string): Promise<NutritionReport[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nutrition_reports")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12);
  return (data ?? []) as NutritionReport[];
}

/** Son 7 günün beslenme/antrenman/kilo özeti (rapor için). */
export async function getWeekAggregate(
  userId: string,
  goals: {
    calorieGoal: number;
    proteinGoal: number;
    waterGoal: number;
    carbGoal: number;
    fatGoal: number;
    trainingTarget: number;
  }
): Promise<WeekAggregate> {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 6 * 86400000);
  const from = weekAgo.toISOString().slice(0, 10);
  const to = todayISO();

  const [{ data: logs }, { data: water }, { data: workouts }, { data: measures }] =
    await Promise.all([
      supabase
        .from("nutrition_logs")
        .select("log_date, calories, protein_g, carbs_g, fat_g")
        .eq("user_id", userId)
        .gte("log_date", from)
        .lte("log_date", to),
      supabase
        .from("water_logs")
        .select("log_date, amount_ml")
        .eq("user_id", userId)
        .gte("log_date", from)
        .lte("log_date", to),
      supabase
        .from("workouts")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("workout_date", from)
        .lte("workout_date", to),
      supabase
        .from("body_measurements")
        .select("measured_on, weight_kg")
        .eq("user_id", userId)
        .gte("measured_on", from)
        .lte("measured_on", to)
        .order("measured_on", { ascending: true }),
    ]);

  // Günlük gruplama (kayıt olan gün sayısı üzerinden ortalama)
  const dayCal = new Map<string, { c: number; p: number; cb: number; f: number }>();
  for (const l of logs ?? []) {
    const d = l.log_date as string;
    const cur = dayCal.get(d) ?? { c: 0, p: 0, cb: 0, f: 0 };
    cur.c += Number(l.calories);
    cur.p += Number(l.protein_g);
    cur.cb += Number(l.carbs_g);
    cur.f += Number(l.fat_g);
    dayCal.set(d, cur);
  }
  const dayWater = new Map<string, number>();
  for (const w of water ?? []) {
    const d = w.log_date as string;
    dayWater.set(d, (dayWater.get(d) ?? 0) + Number(w.amount_ml));
  }

  const days = Math.max(1, dayCal.size);
  const sum = Array.from(dayCal.values()).reduce(
    (a, v) => ({ c: a.c + v.c, p: a.p + v.p, cb: a.cb + v.cb, f: a.f + v.f }),
    { c: 0, p: 0, cb: 0, f: 0 }
  );
  const waterDays = Math.max(1, dayWater.size);
  const waterSum = Array.from(dayWater.values()).reduce((a, v) => a + v, 0);

  const ms = measures ?? [];
  const weightChange =
    ms.length >= 2 && ms[0].weight_kg && ms[ms.length - 1].weight_kg
      ? Math.round((Number(ms[ms.length - 1].weight_kg) - Number(ms[0].weight_kg)) * 10) / 10
      : null;

  return {
    daysLogged: dayCal.size,
    avgCalories: Math.round(sum.c / days),
    calorieGoal: goals.calorieGoal,
    avgProtein: Math.round(sum.p / days),
    proteinGoal: goals.proteinGoal,
    avgWater: Math.round(waterSum / waterDays),
    waterGoal: goals.waterGoal,
    avgCarbs: Math.round(sum.cb / days),
    carbGoal: goals.carbGoal,
    avgFat: Math.round(sum.f / days),
    fatGoal: goals.fatGoal,
    workoutsDone: (workouts ?? []).length,
    trainingTarget: goals.trainingTarget,
    weightChange,
  };
}
