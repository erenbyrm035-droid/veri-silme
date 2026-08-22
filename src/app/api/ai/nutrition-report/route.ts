import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getAIProvider } from "@/lib/ai/provider";
import { getWeekAggregate } from "@/lib/data/nutrition";
import { computeReportScores, buildReportAdvice } from "@/lib/nutrition/report";
import { stripMarkdown } from "@/lib/ai/strip-markdown";
import { calcMacroTargets } from "@/lib/nutrition";
import type { NutritionGoal } from "@/lib/database.types";

export const runtime = "nodejs";
export const maxDuration = 60; // AI üretimi uzun sürer; Vercel varsayılanı (10-15 sn) yetmiyor

/** Son 7 günün verisinden haftalık AI beslenme raporu üretir ve kaydeder. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const targets = calcMacroTargets({
    gender: profile?.gender ?? null,
    age: profile?.age ?? null,
    height_cm: profile?.height_cm ?? null,
    weight_kg: profile?.weight_kg ?? null,
    activity_level: profile?.activity_level ?? null,
    nutrition_goal: (profile?.nutrition_goal as NutritionGoal) ?? "healthy",
    weekly_training_days: profile?.weekly_training_days ?? null,
  });

  const agg = await getWeekAggregate(user.id, {
    calorieGoal: profile?.daily_calorie_goal ?? targets.calories,
    proteinGoal: profile?.daily_protein_goal ?? targets.protein_g,
    waterGoal: profile?.daily_water_goal_ml ?? targets.water_ml,
    carbGoal: profile?.daily_carb_goal ?? targets.carbs_g,
    fatGoal: profile?.daily_fat_goal ?? targets.fat_g,
    trainingTarget: profile?.weekly_training_days ?? 3,
  });

  const scores = computeReportScores(agg);
  let advice = buildReportAdvice(scores, agg);

  const provider = getAIProvider();
  if (provider) {
    try {
      const text = await provider.complete(
        [
          {
            role: "system",
            content:
              "Sen destekleyici bir diyetisyensin. Haftalık verilere göre 2-3 cümlelik motive edici, uygulanabilir Türkçe öneri yaz. Tıbbi tanı koyma.",
          },
          {
            role: "user",
            content: `Beslenme ${scores.nutrition}, protein ${scores.protein}, kalori ${scores.calorie}, su ${scores.water}, makro ${scores.macro}, antrenman ${scores.training} (100 üzerinden). Kilo değişimi: ${
              agg.weightChange ?? "bilinmiyor"
            } kg. Kısa öneri ver.`,
          },
        ],
        { temperature: 0.6, maxTokens: 220 }
      );
      if (text && text.trim().length > 10) advice = stripMarkdown(text).trim();
    } catch {
      // deterministik öneri kalır
    }
  }

  const { data: report } = await supabase
    .from("nutrition_reports")
    .insert({
      user_id: user.id,
      scores,
      weight_change: agg.weightChange,
      advice,
      data: { ...agg },
    })
    .select("*")
    .single();

  return NextResponse.json({ report });
}
