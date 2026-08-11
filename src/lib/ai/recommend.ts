import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SmartRecommendation, Profile } from "@/lib/database.types";

const daysAgoISO = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

/**
 * Kullanıcı geçmişine göre kural tabanlı akıllı öneriler.
 * "Son 3 haftadır sırt çalışmadın", "Su tüketimin düşük" gibi.
 */
export async function smartRecommendations(userId: string): Promise<SmartRecommendation[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const recs: SmartRecommendation[] = [];

  const [{ data: profile }, workouts, nutritionToday, water, sets3w] = await Promise.all([
    supabase.from("profiles").select("daily_protein_goal, daily_water_goal_ml, weekly_training_days").eq("id", userId).single(),
    supabase.from("workouts").select("workout_date, status").eq("user_id", userId).gte("workout_date", daysAgoISO(9)).order("workout_date", { ascending: false }),
    supabase.from("nutrition_logs").select("protein_g, calories").eq("user_id", userId).eq("log_date", today),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("log_date", today),
    supabase.from("workout_sets").select("exercise_name, workouts!inner(user_id, workout_date)").eq("workouts.user_id", userId).gte("workouts.workout_date", daysAgoISO(21)).limit(500),
  ]);

  const p = profile as Partial<Profile> | null;

  // Son 3 haftada sırt çalışması var mı?
  const backKeywords = ["row", "pull", "deadlift", "lat", "sırt", "çekiş", "kürek", "barfiks"];
  const trainedBack = (sets3w.data ?? []).some((s: { exercise_name: string }) => backKeywords.some((k) => s.exercise_name.toLowerCase().includes(k)));
  if (!trainedBack && (sets3w.data ?? []).length > 0) {
    recs.push({ kind: "workout", title: "Sırt ihmal edilmiş", detail: "Son 3 haftada belirgin bir sırt çalışman görünmüyor. Bu hafta bir çekiş (row/lat pulldown) ekleyebilirsin." });
  }

  // Bugün antrenman + dinlenme önerisi
  const last7 = (workouts.data ?? []).filter((w: { workout_date: string; status: string }) => w.status === "completed" && w.workout_date >= daysAgoISO(7));
  if (last7.length >= (p?.weekly_training_days ?? 5)) {
    recs.push({ kind: "rest", title: "Dinlenme günü olabilir", detail: `Bu hafta ${last7.length} antrenman tamamladın. Toparlanma için bugün aktif dinlenme veya mobilite iyi gelebilir.` });
  }

  // Protein hedefi
  const proteinToday = (nutritionToday.data ?? []).reduce((a: number, r: { protein_g: number }) => a + Number(r.protein_g), 0);
  if (p?.daily_protein_goal && proteinToday < p.daily_protein_goal * 0.7 && new Date().getHours() >= 16) {
    recs.push({ kind: "nutrition", title: "Protein hedefinin altındasın", detail: `Bugün ~${Math.round(proteinToday)} g protein aldın (hedef ${p.daily_protein_goal} g). Akşam öğününde yoğurt, tavuk veya mercimek ekleyebilirsin.` });
  }

  // Su
  const waterToday = (water.data ?? []).reduce((a: number, r: { amount_ml: number }) => a + Number(r.amount_ml), 0);
  if (p?.daily_water_goal_ml && waterToday < p.daily_water_goal_ml * 0.5 && new Date().getHours() >= 14) {
    recs.push({ kind: "water", title: "Su tüketimin düşük", detail: `Bugün ${waterToday} ml su içtin (hedef ${p.daily_water_goal_ml} ml). Bir bardak su iyi gelir.` });
  }

  if (recs.length === 0) {
    recs.push({ kind: "motivation", title: "Harika gidiyorsun!", detail: "Verilerin dengeli görünüyor. Bugünkü planına sadık kal ve su içmeyi unutma." });
  }
  return recs;
}
