import "server-only";
import { createClient } from "@/lib/supabase/server";

const isoDaysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export interface DailyReport {
  date: string;
  calorieGoal: number;
  caloriesConsumed: number;
  proteinGoal: number;
  proteinConsumed: number;
  waterGoalMl: number;
  waterMl: number;
  sleepHours: number | null;
  workoutToday: string | null;
}

export async function getDailyReport(userId: string): Promise<DailyReport> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: profile }, nutrition, water, workout] = await Promise.all([
    supabase.from("profiles").select("daily_calorie_goal, daily_protein_goal, daily_water_goal_ml, sleep_hours").eq("id", userId).single(),
    supabase.from("nutrition_logs").select("calories, protein_g").eq("user_id", userId).eq("log_date", today),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("log_date", today),
    supabase.from("workouts").select("title").eq("user_id", userId).eq("workout_date", today).limit(1).maybeSingle(),
  ]);
  const p = profile as { daily_calorie_goal: number; daily_protein_goal: number; daily_water_goal_ml: number; sleep_hours: number | null } | null;
  const nut = (nutrition.data ?? []) as { calories: number; protein_g: number }[];
  return {
    date: today,
    calorieGoal: p?.daily_calorie_goal ?? 2000,
    caloriesConsumed: Math.round(nut.reduce((a, r) => a + Number(r.calories), 0)),
    proteinGoal: p?.daily_protein_goal ?? 120,
    proteinConsumed: Math.round(nut.reduce((a, r) => a + Number(r.protein_g), 0)),
    waterGoalMl: p?.daily_water_goal_ml ?? 2500,
    waterMl: (water.data ?? []).reduce((a: number, r: { amount_ml: number }) => a + Number(r.amount_ml), 0),
    sleepHours: p?.sleep_hours ?? null,
    workoutToday: (workout.data as { title: string } | null)?.title ?? null,
  };
}

export interface WeeklyReport {
  workoutsCompleted: number;
  totalMinutes: number;
  avgCalories: number;
  weightChange: number | null;
}

export async function getWeeklyReport(userId: string): Promise<WeeklyReport> {
  const supabase = await createClient();
  const weekAgo = isoDaysAgo(7);
  const [workouts, nutrition, measurements] = await Promise.all([
    supabase.from("workouts").select("duration_min, status").eq("user_id", userId).gte("workout_date", weekAgo),
    supabase.from("nutrition_logs").select("calories, log_date").eq("user_id", userId).gte("log_date", weekAgo),
    supabase.from("body_measurements").select("weight_kg, measured_on").eq("user_id", userId).order("measured_on", { ascending: false }).limit(10),
  ]);
  const w = (workouts.data ?? []) as { duration_min: number | null; status: string }[];
  const completed = w.filter((x) => x.status === "completed");
  const nut = (nutrition.data ?? []) as { calories: number; log_date: string }[];
  const days = new Set(nut.map((n) => n.log_date)).size || 1;
  const meas = (measurements.data ?? []) as { weight_kg: number | null }[];
  const weightChange = meas.length >= 2 && meas[0].weight_kg != null && meas[meas.length - 1].weight_kg != null
    ? Math.round((Number(meas[0].weight_kg) - Number(meas[meas.length - 1].weight_kg)) * 10) / 10
    : null;
  return {
    workoutsCompleted: completed.length,
    totalMinutes: completed.reduce((a, x) => a + (x.duration_min ?? 0), 0),
    avgCalories: Math.round(nut.reduce((a, r) => a + Number(r.calories), 0) / days),
    weightChange,
  };
}
