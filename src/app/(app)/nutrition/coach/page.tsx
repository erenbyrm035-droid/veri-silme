import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { calcMacroTargets } from "@/lib/nutrition";
import {
  getLatestMealPlan,
  getLatestShoppingList,
  getReports,
} from "@/lib/data/nutrition";
import { NutritionCoachClient } from "@/components/nutrition/NutritionCoachClient";
import { computeNutritionScore, interpretNutritionScore } from "@/lib/nutrition/score";
import { getEntitlements } from "@/lib/premium/entitlements";
import type { NutritionGoal, Goal } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Diyetisyen · Viva",
  description:
    "Kişisel makro hedefleri, öğün planı, akıllı tarif, alışveriş listesi ve haftalık beslenme raporu.",
};

const GOAL_MAP: Record<Goal, NutritionGoal> = {
  lose_weight: "lose_fat",
  gain_muscle: "gain_muscle",
  get_fit: "healthy",
  improve_endurance: "endurance",
  gain_strength: "strength",
};

export default async function NutritionCoachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const nutritionGoal: NutritionGoal =
    (profile?.nutrition_goal as NutritionGoal) ||
    (profile?.goal ? GOAL_MAP[profile.goal as Goal] : "healthy");

  const targets = calcMacroTargets({
    gender: profile?.gender ?? null,
    age: profile?.age ?? null,
    height_cm: profile?.height_cm ?? null,
    weight_kg: profile?.weight_kg ?? null,
    activity_level: profile?.activity_level ?? null,
    nutrition_goal: nutritionGoal,
    weekly_training_days: profile?.weekly_training_days ?? null,
  });

  const [plan, shopping, reports, scoreResult] = await Promise.all([
    getLatestMealPlan(user.id),
    getLatestShoppingList(user.id),
    getReports(user.id),
    computeNutritionScore(user.id),
  ]);
  const nutritionScore = {
    score: scoreResult.score,
    comment: interpretNutritionScore(scoreResult),
    breakdown: scoreResult.breakdown as unknown as Record<string, number>,
  };

  return (
    <div className="space-y-3">
      <Link
        href="/nutrition"
        className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Beslenme
      </Link>
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          🥗 AI Diyetisyen
        </h1>
        <p className="hidden text-sm text-fg-muted sm:block">
          Sana özel makro hedefleri, öğün planı, tarif, alışveriş listesi ve
          haftalık rapor.
        </p>
      </header>

      <NutritionCoachClient
        userId={user.id}
        targets={targets}
        initialPlan={plan}
        initialShopping={shopping}
        initialReport={reports[0] ?? null}
        nutritionScore={nutritionScore}
        isPremium={getEntitlements(profile ?? undefined).isPremium}
      />
    </div>
  );
}
