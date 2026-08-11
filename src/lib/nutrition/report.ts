// ============================================================================
// Haftalık beslenme raporu skorlama motoru (deterministik).
// ============================================================================
import type { NutritionReportScores } from "@/lib/database.types";

export interface WeekAggregate {
  daysLogged: number;
  avgCalories: number;
  calorieGoal: number;
  avgProtein: number;
  proteinGoal: number;
  avgWater: number;
  waterGoal: number;
  avgCarbs: number;
  carbGoal: number;
  avgFat: number;
  fatGoal: number;
  workoutsDone: number;
  trainingTarget: number;
  weightChange: number | null;
}

function adherence(value: number, goal: number): number {
  if (!goal) return 0;
  const diff = Math.abs(1 - value / goal);
  if (diff <= 0.1) return 1;
  return Math.max(0, 1 - (diff - 0.1) * 1.5);
}

function reach(value: number, goal: number): number {
  return goal ? Math.min(1, value / goal) : 0;
}

/** Haftalık verilerden 6 skoru (0-100) hesaplar. */
export function computeReportScores(w: WeekAggregate): NutritionReportScores {
  const calorie = Math.round(adherence(w.avgCalories, w.calorieGoal) * 100);
  const protein = Math.round(reach(w.avgProtein, w.proteinGoal) * 100);
  const water = Math.round(reach(w.avgWater, w.waterGoal) * 100);
  const macro = Math.round(
    ((adherence(w.avgCarbs, w.carbGoal) + adherence(w.avgFat, w.fatGoal)) / 2) * 100
  );
  const training = Math.round(reach(w.workoutsDone, w.trainingTarget) * 100);
  const nutrition = Math.round(
    calorie * 0.3 + protein * 0.3 + water * 0.2 + macro * 0.2
  );
  return { nutrition, protein, calorie, water, macro, training };
}

/** Skorlardan kısa Türkçe öneri metni (AI yoksa). */
export function buildReportAdvice(
  s: NutritionReportScores,
  w: WeekAggregate
): string {
  const tips: string[] = [];
  if (s.protein < 70)
    tips.push("Protein hedefinin gerisindesin — her öğüne bir protein kaynağı ekle.");
  if (s.water < 70)
    tips.push("Su tüketimini artır; gün içinde düzenli aralıklarla iç.");
  if (s.calorie < 60)
    tips.push("Kalori uyumun dalgalı — öğün planına daha yakın kalmayı dene.");
  if (s.training < 60 && w.trainingTarget > 0)
    tips.push("Antrenman sıklığın hedefin altında; bu hafta bir seans daha ekle.");
  if (tips.length === 0)
    tips.push("Harika bir hafta! Tutarlılığını koru ve mevcut ritmini sürdür.");

  const wc =
    w.weightChange == null
      ? ""
      : w.weightChange < 0
      ? ` Bu hafta ${Math.abs(w.weightChange).toFixed(1)} kg verdin.`
      : w.weightChange > 0
      ? ` Bu hafta ${w.weightChange.toFixed(1)} kg aldın.`
      : "";

  return `Genel beslenme skorun ${s.nutrition}/100.${wc} ${tips.join(" ")}`;
}
