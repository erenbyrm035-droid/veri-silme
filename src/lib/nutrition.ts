import type {
  Gender,
  Goal,
  Experience,
  NutritionGoal,
  ActivityLevel,
  MacroTargets,
} from "./database.types";

interface CalorieInput {
  gender: Gender | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: Goal | null;
  experience: Experience | null;
  weekly_training_days: number | null;
}

/**
 * Mifflin-St Jeor denklemi ile BMR hesaplar.
 */
export function calcBMR(input: CalorieInput): number {
  const { gender, age, height_cm, weight_kg } = input;
  if (!age || !height_cm || !weight_kg) return 0;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return gender === "female" ? base - 161 : base + 5;
}

/** Haftalık antrenman gününe göre aktivite çarpanı. */
function activityFactor(days: number | null): number {
  if (!days || days <= 2) return 1.375;
  if (days <= 4) return 1.55;
  return 1.725;
}

/**
 * Günlük kalori hedefi (hedefe göre ayarlanmış).
 */
export function calcCalorieGoal(input: CalorieInput): number {
  const bmr = calcBMR(input);
  if (!bmr) return 2000;
  let tdee = bmr * activityFactor(input.weekly_training_days);

  switch (input.goal) {
    case "lose_weight":
      tdee -= 400; // hafif kalori açığı
      break;
    case "gain_muscle":
      tdee += 300; // hafif kalori fazlası
      break;
    case "gain_strength":
      tdee += 200; // hafif fazla (güç odaklı)
      break;
    default:
      break;
  }
  return Math.round(tdee / 10) * 10;
}

/**
 * Günlük protein hedefi (g). Kas kazanımında daha yüksek.
 */
export function calcProteinGoal(input: CalorieInput): number {
  const w = input.weight_kg ?? 75;
  const perKg =
    input.goal === "gain_muscle"
      ? 2.0
      : input.goal === "gain_strength"
      ? 1.9
      : input.goal === "lose_weight"
      ? 1.8
      : 1.6;
  return Math.round(w * perKg);
}

// ============================================================================
// AI Diyetisyen — makro/mikro hedef motoru (Sprint 10)
// ============================================================================

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.3,
  light: 1.45,
  moderate: 1.6,
  active: 1.75,
  athlete: 1.9,
};

export interface NutritionProfileInput {
  gender: Gender | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  activity_level: ActivityLevel | null;
  nutrition_goal: NutritionGoal | null;
  weekly_training_days: number | null;
}

/** Beslenme hedefine göre kalori ayarı (kcal). */
function goalCalorieShift(goal: NutritionGoal | null): number {
  switch (goal) {
    case "lose_fat":
      return -450;
    case "gain_muscle":
      return 300;
    case "strength":
      return 200;
    case "performance":
      return 150;
    case "endurance":
      return 100;
    default:
      return 0; // maintain / healthy
  }
}

/** Beslenme hedefine göre protein katsayısı (g/kg). */
function goalProteinPerKg(goal: NutritionGoal | null): number {
  switch (goal) {
    case "gain_muscle":
      return 2.0;
    case "lose_fat":
      return 2.0;
    case "strength":
      return 1.9;
    case "performance":
      return 1.8;
    case "endurance":
      return 1.6;
    default:
      return 1.5; // maintain / healthy
  }
}

/** Günlük su hedefi (ml): kilo + aktivite bazlı, 1500-4000 arası. */
export function calcWaterGoal(
  weight_kg: number | null,
  activity: ActivityLevel | null
): number {
  const base = (weight_kg ?? 75) * 35;
  const extra =
    activity === "active" ? 400 : activity === "athlete" ? 700 : 0;
  return Math.min(4000, Math.max(1500, Math.round((base + extra) / 50) * 50));
}

/**
 * Tam makro + mikro hedeflerini hesaplar.
 * BMR (Mifflin-St Jeor) → aktivite çarpanı → hedef ayarı.
 */
export function calcMacroTargets(input: NutritionProfileInput): MacroTargets {
  const bmr = calcBMR({
    gender: input.gender,
    age: input.age,
    height_cm: input.height_cm,
    weight_kg: input.weight_kg,
    goal: null,
    experience: null,
    weekly_training_days: input.weekly_training_days,
  });

  const factor = ACTIVITY_FACTORS[input.activity_level ?? "moderate"];
  const maintenance = bmr ? bmr * factor : 2000;
  const calories = Math.max(
    1200,
    Math.round((maintenance + goalCalorieShift(input.nutrition_goal)) / 10) * 10
  );

  const weight = input.weight_kg ?? 75;
  const protein_g = Math.round(weight * goalProteinPerKg(input.nutrition_goal));

  // Yağ: kalorinin ~%27'si (keto dışı genel dağılım).
  const fat_g = Math.round((calories * 0.27) / 9);
  // Karbonhidrat: proteinden ve yağdan kalan kaloriden.
  const carbs_g = Math.max(
    0,
    Math.round((calories - protein_g * 4 - fat_g * 9) / 4)
  );
  // Lif: 1000 kcal başına ~14 g.
  const fiber_g = Math.round((calories / 1000) * 14);
  // Şeker (üst sınır): kalorinin ~%10'u.
  const sugar_g = Math.round((calories * 0.1) / 4);

  return {
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fiber_g,
    sugar_g,
    sodium_mg: 2300, // önerilen üst sınır
    potassium_mg: 3500, // hedef
    water_ml: calcWaterGoal(input.weight_kg, input.activity_level),
  };
}

/** Günlük beslenme skoru (0-100): kalori/protein/su uyumunun ağırlıklı ortalaması. */
export function computeDailyNutritionScore(i: {
  calories: number;
  calorieGoal: number;
  protein: number;
  proteinGoal: number;
  waterMl: number;
  waterGoalMl: number;
}): number {
  const cal = adherence(i.calories, i.calorieGoal);
  const pro = Math.min(1, safeDiv(i.protein, i.proteinGoal)); // protein: hedefe ulaşmak iyi
  const water = Math.min(1, safeDiv(i.waterMl, i.waterGoalMl));
  const score = cal * 0.4 + pro * 0.35 + water * 0.25;
  return Math.round(score * 100);
}

/** Hedefe yakınlık: hedefin ±%10'u tam puan, uzaklaştıkça düşer. */
function adherence(value: number, goal: number): number {
  if (!goal) return 0;
  const ratio = value / goal;
  const diff = Math.abs(1 - ratio);
  if (diff <= 0.1) return 1;
  return Math.max(0, 1 - (diff - 0.1) * 1.5);
}

function safeDiv(a: number, b: number): number {
  return b ? a / b : 0;
}

/** Bir besinin gram bazında makro değerlerini hesaplar (100g referanslı). */
export function scaleMacros(
  per100: { calories: number; protein_g: number; carbs_g: number; fat_g: number },
  grams: number
) {
  const f = grams / 100;
  return {
    calories: Math.round(per100.calories * f),
    protein_g: Math.round(per100.protein_g * f * 10) / 10,
    carbs_g: Math.round(per100.carbs_g * f * 10) / 10,
    fat_g: Math.round(per100.fat_g * f * 10) / 10,
  };
}
