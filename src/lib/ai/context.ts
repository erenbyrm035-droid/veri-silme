import "server-only";
import { createClient } from "@/lib/supabase/server";
import { GOAL_LABELS, EXPERIENCE_LABELS, ENVIRONMENT_LABELS } from "@/lib/constants";
import type { AiUserContext, Profile } from "@/lib/database.types";

const todayISO = () => new Date().toISOString().slice(0, 10);

/**
 * Kullanıcının AI koça açtığı bağlam paketini toplar.
 * Yalnızca RLS ile erişilebilen kendi verisini okur (cookie istemcisi).
 * profile.ai_consent=false ise yalnızca minimum bağlam döner.
 */
export async function gatherUserContext(userId: string): Promise<AiUserContext> {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  const consent = (profile as Partial<Profile> | null)?.ai_consent ?? true;

  if (!consent) {
    return {
      profile: profile ? { full_name: profile.full_name, goal: profile.goal } : null,
      favorites: [], completedWorkouts: 0, recentWorkouts: [], latestWeight: null,
      dietPlan: null, posture: null, waterToday: 0, sleepHours: null, injuries: [],
    };
  }

  const today = todayISO();
  const [
    favorites, workouts, completedCount, measurement, dietPlan, posture, water,
  ] = await Promise.all([
    supabase.from("favorites").select("exercises(name)").eq("user_id", userId).limit(10),
    supabase.from("workouts").select("title, workout_date, status").eq("user_id", userId).order("workout_date", { ascending: false }).limit(8),
    supabase.from("workouts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed"),
    supabase.from("body_measurements").select("weight_kg").eq("user_id", userId).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("meal_plans").select("title, target_calories").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("posture_analyses").select("posture_score, risk_level, findings").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("log_date", today),
  ]);

  const favNames = (favorites.data ?? [])
    .map((r: { exercises: { name: string } | { name: string }[] | null }) => {
      const ex = Array.isArray(r.exercises) ? r.exercises[0] : r.exercises;
      return ex?.name;
    })
    .filter((n: string | undefined): n is string => !!n);

  const waterToday = (water.data ?? []).reduce((a: number, r: { amount_ml: number }) => a + Number(r.amount_ml), 0);

  const p = profile as Partial<Profile> | null;
  const postureData = posture.data
    ? {
        score: (posture.data as { posture_score: number }).posture_score,
        risk: (posture.data as { risk_level: string | null }).risk_level,
        problems: ((posture.data as { findings: { label: string }[] }).findings ?? []).slice(0, 4).map((f) => f.label),
      }
    : null;

  return {
    profile: p,
    favorites: favNames,
    completedWorkouts: completedCount.count ?? 0,
    recentWorkouts: (workouts.data ?? []).map((w: { title: string; workout_date: string; status: string }) => ({ title: w.title, date: w.workout_date, status: w.status })),
    latestWeight: (measurement.data as { weight_kg: number } | null)?.weight_kg ?? p?.weight_kg ?? null,
    dietPlan: (dietPlan.data as { title: string } | null)?.title ?? null,
    posture: postureData,
    waterToday,
    sleepHours: p?.sleep_hours ?? null,
    injuries: p?.injuries ?? [],
  };
}

/** Bağlam paketinden AI'ya verilecek metni üretir. */
export function contextToPrompt(ctx: AiUserContext): string {
  const p = ctx.profile;
  const workoutLines = ctx.recentWorkouts.length
    ? ctx.recentWorkouts.map((w) => `- ${w.date}: ${w.title} (${w.status === "completed" ? "tamamlandı" : "planlandı"})`).join("\n")
    : "Henüz kayıtlı antrenman yok.";

  return `KULLANICI BAĞLAMI (yalnızca bu verilere dayan):
- İsim: ${p?.full_name ?? "?"}
- Yaş: ${p?.age ?? "?"} · Cinsiyet: ${p?.gender ?? "?"} · Boy: ${p?.height_cm ?? "?"} cm
- Güncel kilo: ${ctx.latestWeight ?? "?"} kg · Hedef kilo: ${p?.target_weight_kg ?? "?"} kg · Yağ: ${p?.body_fat_pct ?? "?"}%
- Hedef: ${p?.goal ? GOAL_LABELS[p.goal] : "?"} · Deneyim: ${p?.experience ? EXPERIENCE_LABELS[p.experience] : "?"}
- Ortam: ${p?.training_environment ? ENVIRONMENT_LABELS[p.training_environment] : "?"} · Aktivite: ${p?.activity_level ?? "?"}
- Premium: ${p?.is_premium ? "evet" : "hayır"}
- Günlük hedefler: ${p?.daily_calorie_goal ?? "?"} kcal, ${p?.daily_protein_goal ?? "?"} g protein, ${p?.daily_water_goal_ml ?? "?"} ml su
- Bugün su: ${ctx.waterToday} ml · Uyku: ${ctx.sleepHours ?? "?"} saat
- Tamamlanan antrenman (toplam): ${ctx.completedWorkouts}
- Favori egzersizler: ${ctx.favorites.join(", ") || "yok"}
- Aktif diyet planı: ${ctx.dietPlan ?? "yok"}
- Sakatlıklar: ${ctx.injuries.join(", ") || "yok"}
- Postür: ${ctx.posture ? `${ctx.posture.score}/100, risk ${ctx.posture.risk ?? "?"}, bulgular: ${ctx.posture.problems.join(", ") || "-"}` : "analiz yok"}

Son antrenmanlar:
${workoutLines}`;
}
