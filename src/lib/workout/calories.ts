// ============================================================================
// Kalori tahmini — MET (Metabolic Equivalent of Task) tabanlı.
//
// Formül (ACSM): kcal/dk = MET × 3.5 × kg / 200
// MET değerleri Compendium of Physical Activities (Ainsworth ve ark., 2011)
// referans alınarak, ürünün aktivite türlerine eşlenmiştir.
//
// Client + server güvenli — saf fonksiyonlar, bağımlılık yok.
// Aynı katsayılar `end_live_session()` RPC'sinde de kullanılır (migration 0044);
// oturum başlarken seçilen MET veritabanına yazılır, bitişte oradan okunur.
// ============================================================================

export type ActivityKey =
  | "strength" | "hiit" | "cardio" | "run" | "cycling"
  | "yoga" | "pilates" | "mobility" | "walk";

export interface Activity {
  key: ActivityKey;
  label: string;
  emoji: string;
  met: number;
}

export const ACTIVITIES: Activity[] = [
  { key: "strength", label: "Ağırlık",     emoji: "🏋️", met: 5.0 },
  { key: "hiit",     label: "HIIT",        emoji: "⚡",  met: 8.0 },
  { key: "cardio",   label: "Kardiyo",     emoji: "🔥",  met: 7.0 },
  { key: "run",      label: "Koşu",        emoji: "🏃",  met: 9.8 },
  { key: "cycling",  label: "Bisiklet",    emoji: "🚴",  met: 7.5 },
  { key: "yoga",     label: "Yoga",        emoji: "🧘",  met: 3.0 },
  { key: "pilates",  label: "Pilates",     emoji: "🤸",  met: 3.8 },
  { key: "mobility", label: "Mobilite",    emoji: "🌀",  met: 2.8 },
  { key: "walk",     label: "Yürüyüş",     emoji: "🚶",  met: 3.5 },
];

const BY_KEY = new Map(ACTIVITIES.map((a) => [a.key, a]));

/** Kilo bilinmiyorsa kullanılan taban ağırlık (kg). */
export const DEFAULT_WEIGHT_KG = 70;

export function activityOf(key: string | null | undefined): Activity {
  return BY_KEY.get((key ?? "strength") as ActivityKey) ?? ACTIVITIES[0];
}

export function metOf(key: string | null | undefined): number {
  return activityOf(key).met;
}

/**
 * Harcanan kaloriyi tahmin eder.
 *
 * @param minutes  Süre (dakika)
 * @param weightKg Kullanıcı kilosu; null/0 ise `DEFAULT_WEIGHT_KG` varsayılır
 * @param met      MET katsayısı (bkz. `metOf`)
 */
export function estimateCalories(minutes: number, weightKg: number | null | undefined, met: number): number {
  const kg = weightKg && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG;
  const mins = Math.max(0, minutes);
  return Math.round((met * 3.5 * kg) / 200 * mins);
}

/** Aktivite anahtarından doğrudan tahmin. */
export function estimateForActivity(
  minutes: number, weightKg: number | null | undefined, activity: string | null | undefined
): number {
  return estimateCalories(minutes, weightKg, metOf(activity));
}
