import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISO, formatShortDate } from "@/lib/utils";
import type { Goal } from "@/lib/database.types";

// ============================================================================
// Dashboard veri katmanı
//
// Sayfa eskiden 8 Supabase sorgusunu ARDIŞIK yapıyordu (~300-500 ms boşa
// gecikme). Burada hepsi tek `Promise.all` içinde paralelleştirildi ve günün
// özeti tek bir RPC'ye (`daily_summary`) indirildi.
// ============================================================================

export interface DailySummary {
  water_ml: number; water_goal: number;
  protein_g: number; protein_goal: number;
  calories: number; calorie_goal: number;
  steps: number; step_goal: number;
  sleep_minutes: number; sleep_goal: number;
  workout_done: boolean; workout_planned: boolean; workout_title: string | null;
  done_count: number; total_count: number; completion_pct: number;
}

export interface RecoveryInfo {
  score: number; label: string;
  sleep_avg_min: number; load_7d: number; rest_days: number;
}

export interface ReadinessInfo { score: number; label: string; hint: string }

export interface DashboardGam {
  total_xp: number; level: number; fitness_score: number;
  current_streak: number; coins: number;
  levelTitle: string | null; levelColor: string | null;
  nextMinXp: number | null; currentMinXp: number;
}

export interface DashboardData {
  firstName: string;
  goal: Goal | null;
  summary: DailySummary;
  recovery: RecoveryInfo;
  readiness: ReadinessInfo;
  gam: DashboardGam;
  todayWorkoutId: string | null;
  completedWorkouts: number;
  weightTrend: { label: string; value: number }[];
  currentWeight: number;
  startWeight: number;
  weightDelta: number;
}

const EMPTY_SUMMARY: DailySummary = {
  water_ml: 0, water_goal: 2500,
  protein_g: 0, protein_goal: 120,
  calories: 0, calorie_goal: 2000,
  steps: 0, step_goal: 8000,
  sleep_minutes: 0, sleep_goal: 450,
  workout_done: false, workout_planned: false, workout_title: null,
  done_count: 0, total_count: 5, completion_pct: 0,
};

const first = <T,>(d: unknown): T | null => (Array.isArray(d) ? (d[0] as T) ?? null : (d as T) ?? null);
const num = (v: unknown, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

/**
 * Dashboard'un ihtiyaç duyduğu her şeyi tek geçişte toplar.
 * Sorgular paralel; günün özeti + skorlar RPC üzerinden gelir.
 */
export async function getDashboard(userId: string): Promise<DashboardData> {
  const supabase = await createClient();
  const today = todayISO();

  const [
    { data: profile },
    { data: summaryRaw },
    { data: recoveryRaw },
    { data: readinessRaw },
    { data: gamRaw },
    { data: levelRows },
    { count: completedCount },
    { data: weightRows },
    { data: todayWorkout },
  ] = await Promise.all([
    // Yalnızca gereken alanlar — eskiden `select("*")` ile 50+ sütun çekiliyordu.
    supabase
      .from("profiles")
      .select("full_name, goal, weight_kg, starting_weight_kg")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("daily_summary", { p_user: userId, p_date: today }),
    supabase.rpc("recovery_score", { p_user: userId }),
    supabase.rpc("readiness_score", { p_user: userId }),
    supabase
      .from("user_gamification")
      .select("total_xp, level, fitness_score, current_streak, coins")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("levels").select("level, title, min_xp, color").order("min_xp"),
    supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed"),
    supabase
      .from("body_measurements")
      .select("weight_kg, measured_on")
      .eq("user_id", userId)
      .not("weight_kg", "is", null)
      .order("measured_on", { ascending: true })
      .limit(30),
    supabase
      .from("workouts")
      .select("id")
      .eq("user_id", userId)
      .eq("workout_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // --- Günün özeti ---
  const s = first<Record<string, unknown>>(summaryRaw);
  const summary: DailySummary = s
    ? {
        water_ml: num(s.water_ml), water_goal: num(s.water_goal, 2500),
        protein_g: num(s.protein_g), protein_goal: num(s.protein_goal, 120),
        calories: num(s.calories), calorie_goal: num(s.calorie_goal, 2000),
        steps: num(s.steps), step_goal: num(s.step_goal, 8000),
        sleep_minutes: num(s.sleep_minutes), sleep_goal: num(s.sleep_goal, 450),
        workout_done: !!s.workout_done,
        workout_planned: !!s.workout_planned,
        workout_title: (s.workout_title as string) ?? null,
        done_count: num(s.done_count), total_count: num(s.total_count, 5),
        completion_pct: num(s.completion_pct),
      }
    : EMPTY_SUMMARY;

  // --- Skorlar ---
  const r = first<Record<string, unknown>>(recoveryRaw);
  const recovery: RecoveryInfo = {
    score: num(r?.score, 60),
    label: (r?.label as string) ?? "İyi",
    sleep_avg_min: num(r?.sleep_avg_min),
    load_7d: num(r?.load_7d),
    rest_days: num(r?.rest_days),
  };

  const rd = first<Record<string, unknown>>(readinessRaw);
  const readiness: ReadinessInfo = {
    score: num(rd?.score, 60),
    label: (rd?.label as string) ?? "Hazır",
    hint: (rd?.hint as string) ?? "Planladığın antrenmanı yapabilirsin.",
  };

  // --- Oyunlaştırma + seviye ---
  const g = gamRaw as Record<string, unknown> | null;
  const totalXp = num(g?.total_xp);
  const levels = (levelRows as { level: number; title: string; min_xp: number; color: string }[]) ?? [];
  const current = [...levels].reverse().find((l) => l.min_xp <= totalXp) ?? levels[0] ?? null;
  const next = levels.find((l) => l.min_xp > totalXp) ?? null;

  const gam: DashboardGam = {
    total_xp: totalXp,
    level: num(g?.level, 1),
    fitness_score: num(g?.fitness_score),
    current_streak: num(g?.current_streak),
    coins: num(g?.coins),
    levelTitle: current?.title ?? null,
    levelColor: current?.color ?? null,
    nextMinXp: next?.min_xp ?? null,
    currentMinXp: current?.min_xp ?? 0,
  };

  // --- Kilo ---
  const weightTrend = ((weightRows as { weight_kg: number; measured_on: string }[]) ?? []).map((w) => ({
    label: formatShortDate(w.measured_on),
    value: Number(w.weight_kg),
  }));
  const currentWeight = num(profile?.weight_kg);
  const startWeight = num(profile?.starting_weight_kg, currentWeight);

  return {
    firstName: (profile?.full_name as string)?.split(" ")[0] || "Sporcu",
    goal: (profile?.goal as Goal) ?? null,
    summary,
    recovery,
    readiness,
    gam,
    todayWorkoutId: (todayWorkout?.id as string) ?? null,
    completedWorkouts: completedCount ?? 0,
    weightTrend,
    currentWeight,
    startWeight,
    weightDelta: Number((currentWeight - startWeight).toFixed(1)),
  };
}
