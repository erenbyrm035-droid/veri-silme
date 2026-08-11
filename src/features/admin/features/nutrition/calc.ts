/** Kalori & makro hesaplayıcıları (saf fonksiyonlar, client+server). */

export type Sex = "male" | "female";
export type ActivityKey = "sedentary" | "light" | "moderate" | "active" | "athlete";

export const ACTIVITY_FACTORS: Record<ActivityKey, number> = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9,
};
export const ACTIVITY_LABELS: Record<ActivityKey, string> = {
  sedentary: "Hareketsiz", light: "Az aktif", moderate: "Orta aktif", active: "Aktif", athlete: "Sporcu",
};

/** Mifflin-St Jeor BMR (kcal/gün). */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

export function tdee(bmrValue: number, activity: ActivityKey): number {
  return Math.round(bmrValue * ACTIVITY_FACTORS[activity]);
}

/** Vücut kitle indeksi. */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  if (m <= 0) return 0;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
export function bmiCategory(value: number): string {
  if (value < 18.5) return "Zayıf";
  if (value < 25) return "Normal";
  if (value < 30) return "Fazla Kilolu";
  if (value < 35) return "Obez (I)";
  if (value < 40) return "Obez (II)";
  return "Aşırı Obez";
}

/** Yağsız kütle indeksi (FFMI). bodyFatPct 0-100. */
export function ffmi(weightKg: number, heightCm: number, bodyFatPct: number): number {
  const leanMass = weightKg * (1 - bodyFatPct / 100);
  const m = heightCm / 100;
  if (m <= 0) return 0;
  const raw = leanMass / (m * m);
  const normalized = raw + 6.1 * (1.8 - m);
  return Math.round(normalized * 10) / 10;
}

/** US Navy yöntemi ile vücut yağ oranı tahmini (%). */
export function bodyFatNavy(
  sex: Sex, heightCm: number, neckCm: number, waistCm: number, hipCm?: number
): number | null {
  try {
    if (sex === "male") {
      const v = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
      return Math.max(2, Math.round(v * 10) / 10);
    }
    if (!hipCm) return null;
    const v = 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
    return Math.max(2, Math.round(v * 10) / 10);
  } catch {
    return null;
  }
}

/** İdeal kilo aralığı (BMI 18.5–24.9). */
export function idealWeightRange(heightCm: number): { min: number; max: number } {
  const m = heightCm / 100;
  return { min: Math.round(18.5 * m * m), max: Math.round(24.9 * m * m) };
}

export interface MacroSplit {
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}
export interface MacroGrams {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories: number;
}

/** Yüzde bazlı makro → gram. */
export function macrosFromPercent(calories: number, split: MacroSplit): MacroGrams {
  return {
    protein_g: Math.round((calories * split.proteinPct) / 100 / 4),
    carbs_g: Math.round((calories * split.carbsPct) / 100 / 4),
    fat_g: Math.round((calories * split.fatPct) / 100 / 9),
    calories,
  };
}

/** Gramdan kalori (4/4/9). */
export function caloriesFromMacros(protein_g: number, carbs_g: number, fat_g: number): number {
  return Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9);
}
