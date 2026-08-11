import "server-only";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { calcMacroTargets } from "@/lib/nutrition";
import type { NutritionGoal, Goal } from "@/lib/database.types";

const GOAL_MAP: Record<string, NutritionGoal> = {
  lose_weight: "lose_fat", gain_muscle: "gain_muscle", get_fit: "healthy",
  improve_endurance: "endurance", gain_strength: "strength",
};

// İşlenmiş gıda sezgisi (isim bazlı — kaba ama faydalı).
const PROCESSED_RE = /cips|gazlı|kola|şeker|çikolata|bisküvi|kraker|hamburger|pizza|kızart|sosis|salam|nugget|dondurma|gofret|enerji içece|tatlı|börek|poğaça|simit|beyaz ekmek/i;
const PRODUCE_RE = /elma|muz|portakal|domates|salatalık|marul|ıspanak|brokoli|havuç|biber|yeşillik|meyve|sebze|çilek|karpuz|üzüm|armut|kivi|avokado|mandalina|patlıcan|kabak|karnabahar|roka|maydanoz/i;

export interface NutritionScoreResult {
  score: number;
  breakdown: { protein: number; calorie: number; macros: number; water: number; variety: number; regularity: number; processed: number };
  metrics: { calories: number; protein: number; carbs: number; fat: number; waterMl: number; distinctFoods7d: number; mealsToday: number; processedRatio7d: number };
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
function adherence(value: number, goal: number): number {
  if (!goal) return 0;
  const diff = Math.abs(1 - value / goal);
  return diff <= 0.1 ? 1 : Math.max(0, 1 - (diff - 0.1) * 1.5);
}

/** Kullanıcının belirtilen gün için 0-100 beslenme skorunu hesaplar. */
export async function computeNutritionScore(userId: string, date?: string): Promise<NutritionScoreResult> {
  const supabase = await createClient();
  const day = date ?? new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);

  const [{ data: profile }, { data: today }, { data: week }, { data: water }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("nutrition_logs").select("food_name, meal, calories, protein_g, carbs_g, fat_g").eq("user_id", userId).eq("log_date", day),
    supabase.from("nutrition_logs").select("food_name").eq("user_id", userId).gte("log_date", weekAgo),
    supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("log_date", day),
    supabase.from("nutrition_preferences").select("meals_per_day").eq("user_id", userId).maybeSingle(),
  ]);

  const p = profile ?? {};
  const goal: NutritionGoal = (p.nutrition_goal as NutritionGoal) || (p.goal ? GOAL_MAP[p.goal as Goal] : "healthy") || "healthy";
  const targets = calcMacroTargets({
    gender: p.gender ?? null, age: p.age ?? null, height_cm: p.height_cm ?? null, weight_kg: p.weight_kg ?? null,
    activity_level: p.activity_level ?? null, nutrition_goal: goal, weekly_training_days: p.weekly_training_days ?? null,
  });

  const rows = (today as { food_name: string; meal: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[]) ?? [];
  const calories = rows.reduce((s, r) => s + Number(r.calories || 0), 0);
  const protein = rows.reduce((s, r) => s + Number(r.protein_g || 0), 0);
  const carbs = rows.reduce((s, r) => s + Number(r.carbs_g || 0), 0);
  const fat = rows.reduce((s, r) => s + Number(r.fat_g || 0), 0);
  const waterMl = ((water as { amount_ml: number }[]) ?? []).reduce((s, w) => s + (w.amount_ml || 0), 0);
  const waterGoal = p.daily_water_goal_ml ?? 2500;

  const weekFoods = ((week as { food_name: string }[]) ?? []).map((r) => r.food_name);
  const distinctFoods7d = new Set(weekFoods.map((f) => f.toLowerCase().trim())).size;
  const produceCount = weekFoods.filter((f) => PRODUCE_RE.test(f)).length;
  const processedCount = weekFoods.filter((f) => PROCESSED_RE.test(f)).length;
  const processedRatio7d = weekFoods.length ? processedCount / weekFoods.length : 0;
  const mealsToday = new Set(rows.map((r) => r.meal)).size;
  const mealsGoal = (prefs as { meals_per_day: number } | null)?.meals_per_day ?? p.meals_per_day ?? 3;

  // Makro dengesi: hedef karb/yağ oranına yakınlık
  const macroBalance = (() => {
    if (!carbs && !fat && !protein) return 0;
    const cAdh = adherence(carbs, targets.carbs_g);
    const fAdh = adherence(fat, targets.fat_g);
    return (cAdh + fAdh) / 2;
  })();

  const b = {
    protein: clamp01(protein / (targets.protein_g || 1)),
    calorie: adherence(calories, targets.calories),
    macros: macroBalance,
    water: clamp01(waterMl / waterGoal),
    variety: clamp01(distinctFoods7d / 15) * 0.6 + clamp01(produceCount / 10) * 0.4, // çeşitlilik + sebze/meyve
    regularity: clamp01(mealsToday / (mealsGoal || 3)),
    processed: 1 - clamp01(processedRatio7d * 2), // işlenmiş oranı düşükse yüksek puan
  };

  const score = Math.round(100 * (
    b.protein * 0.20 + b.calorie * 0.15 + b.macros * 0.15 + b.water * 0.15 +
    b.variety * 0.15 + b.regularity * 0.10 + b.processed * 0.10
  ));

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      protein: Math.round(b.protein * 100), calorie: Math.round(b.calorie * 100), macros: Math.round(b.macros * 100),
      water: Math.round(b.water * 100), variety: Math.round(b.variety * 100), regularity: Math.round(b.regularity * 100),
      processed: Math.round(b.processed * 100),
    },
    metrics: { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), waterMl, distinctFoods7d, mealsToday, processedRatio7d: Math.round(processedRatio7d * 100) },
  };
}

/** Kural tabanlı yorum (AI yoksa da anlamlı). */
export function interpretNutritionScore(r: NutritionScoreResult): string {
  const weak: string[] = [];
  const strong: string[] = [];
  const b = r.breakdown;
  const push = (v: number, label: string) => (v >= 70 ? strong : weak).push(label);
  push(b.protein, "protein"); push(b.water, "su"); push(b.variety, "besin çeşitliliği");
  push(b.regularity, "öğün düzeni"); push(b.processed, "işlenmiş gıdadan kaçınma");
  const level = r.score >= 80 ? "Mükemmel" : r.score >= 60 ? "İyi" : r.score >= 40 ? "Orta" : "Geliştirilmeli";
  let msg = `Beslenme skorun ${r.score}/100 (${level}). `;
  if (strong.length) msg += `Güçlü: ${strong.slice(0, 3).join(", ")}. `;
  if (weak.length) msg += `Geliştir: ${weak.slice(0, 3).join(", ")}.`;
  return msg.trim();
}

/** Bugünün skorunu hesaplar ve nutrition_scores'a yazar (idempotent). */
export async function syncNutritionScore(userId: string, aiComment?: string): Promise<NutritionScoreResult> {
  const result = await computeNutritionScore(userId);
  const admin = createAdminClient();
  await admin.from("nutrition_scores").upsert(
    { user_id: userId, score_date: new Date().toISOString().slice(0, 10), score: result.score, breakdown: result.breakdown, ai_comment: aiComment ?? interpretNutritionScore(result) },
    { onConflict: "user_id,score_date" }
  );
  return result;
}
