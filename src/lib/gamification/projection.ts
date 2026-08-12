// ============================================================================
// ANTRENMANIN KAZANDIRACAĞI XP — canlı tahmin.
//
// NEDEN TAHMİN, NEDEN ARTIMLI ÖDÜL DEĞİL:
//   `sync_gamification` XP'yi KAYNAKTAN yeniden hesaplıyor
//   (`total_xp = base + achievement + challenge`) ve üzerine yazıyor. Yani
//   "her sette +5 XP ver" tarzı artımlı bir ödül bir sonraki senkronda
//   silinirdi. Üstelik o fonksiyon 13 tabloyu tarayan ağır bir işlem; her
//   sette çağrılamaz.
//
//   Çözüm: aynı formülü burada hesaplayıp GÖSTERİYORUZ. Kullanıcının antrenman
//   sırasında gördüğü sayı, bitişte gerçekten yatan sayının aynısı olur.
//
// FORMÜLÜN KAYNAĞI (migration 0034, sync_gamification):
//   v_base_xp := v_workouts * r_workout
//              + floor(v_volume / 1000) * r_volume
//              + v_pr * r_pr
//              + ... (su/protein/postür/AI/giriş — antrenmanla ilgisiz)
//
// KRİTİK İNCELİK: hacim XP'si KÜMÜLATİF. `floor(toplam/1000)` kullanıcının
// TÜM zamanlardaki hacmi üzerinden hesaplanıyor. Bu yüzden bir antrenmanın
// hacim katkısı, önceki toplamına bağlı:
//   önceki 4.800 kg + bu antrenman 500 kg → floor(5300/1000)-floor(4800/1000)
//   = 5 - 4 = 1 eşik → 5 XP
// `floor(500/1000) * 5 = 0` demek YANLIŞ olurdu.
// ============================================================================

/** `xp_rules` tablosundan okunan, antrenmanla ilgili kurallar. */
export interface XpRules {
  /** `workout_completed` — varsayılan 20 */
  workout: number;
  /** `volume_1000kg` — her 1000 kg için, varsayılan 5 */
  volume: number;
  /** `new_pr` — her rekor için, varsayılan 25 */
  pr: number;
}

export const DEFAULT_XP_RULES: XpRules = { workout: 20, volume: 5, pr: 25 };

export interface XpProjection {
  total: number;
  /** Dökümü — kullanıcıya "neden bu kadar" gösterilir. */
  parts: { label: string; xp: number }[];
}

export function projectWorkoutXp(input: {
  /** Bu antrenmandaki toplam hacim (kg × tekrar). */
  workoutVolume: number;
  /** Kullanıcının BU antrenman hariç tüm zamanlardaki hacmi. */
  priorVolume: number;
  /** Bu antrenmanda kırılan rekor sayısı. */
  newPrCount: number;
  /** En az bir set tamamlandı mı — yoksa antrenman "tamamlandı" sayılmaz. */
  hasCompletedSet: boolean;
  rules?: XpRules;
}): XpProjection {
  const r = input.rules ?? DEFAULT_XP_RULES;
  const parts: { label: string; xp: number }[] = [];

  if (!input.hasCompletedSet) return { total: 0, parts };

  parts.push({ label: "Antrenman tamamlama", xp: r.workout });

  // Kümülatif eşik farkı — bkz. yukarıdaki açıklama.
  const before = Math.floor(Math.max(0, input.priorVolume) / 1000);
  const after = Math.floor((Math.max(0, input.priorVolume) + Math.max(0, input.workoutVolume)) / 1000);
  const esik = Math.max(0, after - before);
  if (esik > 0) {
    parts.push({ label: `Hacim (${esik}× 1000 kg)`, xp: esik * r.volume });
  }

  if (input.newPrCount > 0) {
    parts.push({ label: `${input.newPrCount} yeni rekor`, xp: input.newPrCount * r.pr });
  }

  return { total: parts.reduce((a, p) => a + p.xp, 0), parts };
}
