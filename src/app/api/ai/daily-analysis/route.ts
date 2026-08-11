// Günlük beslenme analizi — bugünün makroları vs hedef + AI yorumu
// (eksikler / fazlalıklar / öneriler). Türk mutfağından somut öneri.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getAIProvider } from "@/lib/ai/provider";
import { stripMarkdown } from "@/lib/ai/strip-markdown";
import { calcMacroTargets } from "@/lib/nutrition";
import { getTodayNutrition } from "@/lib/data/nutrition";
import type { NutritionGoal, Goal } from "@/lib/database.types";

export const runtime = "nodejs";

const GOAL_MAP: Record<Goal, NutritionGoal> = {
  lose_weight: "lose_fat", gain_muscle: "gain_muscle", get_fit: "healthy",
  improve_endurance: "endurance", gain_strength: "strength",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const rl = await aiRateGuard(request, supabase, user.id);
  if (rl) return rl;

  const [{ data: profile }, today] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getTodayNutrition(user.id),
  ]);
  const p = profile ?? {};
  const goal: NutritionGoal = (p.nutrition_goal as NutritionGoal) || (p.goal ? GOAL_MAP[p.goal as Goal] : "healthy") || "healthy";
  const t = calcMacroTargets({
    gender: p.gender ?? null, age: p.age ?? null, height_cm: p.height_cm ?? null, weight_kg: p.weight_kg ?? null,
    activity_level: p.activity_level ?? null, nutrition_goal: goal, weekly_training_days: p.weekly_training_days ?? null,
  });
  const waterGoal = p.daily_water_goal_ml ?? 2500;

  const metrics = {
    calories: { got: Math.round(today.calories), goal: t.calories },
    protein: { got: Math.round(today.protein_g), goal: t.protein_g },
    carbs: { got: Math.round(today.carbs_g), goal: t.carbs_g },
    fat: { got: Math.round(today.fat_g), goal: t.fat_g },
    water: { got: today.waterMl, goal: waterGoal },
    meals: today.mealCount,
  };

  // Kural tabanlı hızlı bulgular (AI yoksa da çalışır).
  const findings: string[] = [];
  const pct = (g: number, goal: number) => (goal ? g / goal : 0);
  if (metrics.meals === 0) findings.push("Bugün henüz öğün girmedin.");
  if (pct(metrics.protein.got, metrics.protein.goal) < 0.8 && metrics.meals > 0)
    findings.push(`Protein hedefin (${t.protein_g}g) altındasın — ${Math.max(0, t.protein_g - metrics.protein.got)}g eksik.`);
  if (pct(metrics.calories.got, metrics.calories.goal) > 1.15)
    findings.push(`Kalori hedefini aştın (${metrics.calories.got}/${t.calories}).`);
  if (pct(metrics.calories.got, metrics.calories.goal) < 0.6 && metrics.meals > 0)
    findings.push(`Kalori alımın düşük (${metrics.calories.got}/${t.calories}).`);
  if (pct(metrics.water.got, metrics.water.goal) < 0.7)
    findings.push(`Su hedefinin altındasın (${metrics.water.got}/${waterGoal} ml).`);

  let advice = "";
  const provider = getAIProvider();
  if (provider) {
    try {
      const prompt = `Kullanıcının bugünkü beslenmesini bir spor diyetisyeni gibi kısaca analiz et (Türkçe, 3-5 madde).
Hedef: ${t.calories} kcal, ${t.protein_g}g P, ${t.carbs_g}g K, ${t.fat_g}g Y, ${waterGoal}ml su.
Bugün alınan: ${metrics.calories.got} kcal, ${metrics.protein.got}g P, ${metrics.carbs.got}g K, ${metrics.fat.got}g Y, ${metrics.water.got}ml su, ${metrics.meals} öğün.
Eksikleri/fazlalıkları belirt ve Türk mutfağından somut, uygulanabilir öneriler ver. Markdown KULLANMA (yıldız/diyez yok); düz metin, liste gerekirse "• " ile.`;
      advice = stripMarkdown(await provider.complete(
        [{ role: "system", content: "Sen deneyimli bir spor diyetisyenisin. Kısa, net, motive edici." },
         { role: "user", content: prompt }],
        { temperature: 0.6, maxTokens: 350 }
      ));
    } catch { /* yorum yok */ }
  }

  return NextResponse.json({ metrics, findings, advice });
}
