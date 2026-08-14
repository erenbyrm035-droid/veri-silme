import { describe, it, expect } from "vitest";
import { projectWorkoutXp, DEFAULT_XP_RULES } from "./projection";

// ============================================================================
// Canlı tahmini XP.
//
// Bu fonksiyonun tek işi VERİTABANI FORMÜLÜNÜ birebir taklit etmek
// (`sync_gamification` RPC). Kullanıcı antrenman sırasında burada hesaplanan
// sayıyı görüyor; bitişte DB'nin yazdığı sayı farklı çıkarsa "XP'm eksildi"
// diye algılanır. Bu yüzden özellikle KÜMÜLATİF hacim eşiği sınanıyor.
// ============================================================================

const base = { workoutVolume: 0, priorVolume: 0, newPrCount: 0, hasCompletedSet: true };

describe("projectWorkoutXp", () => {
  it("hiç set tamamlanmadıysa XP yok", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: 5000, hasCompletedSet: false });
    expect(p.total).toBe(0);
    expect(p.parts).toHaveLength(0);
  });

  it("set tamamlandıysa antrenman XP'si verilir", () => {
    expect(projectWorkoutXp(base).total).toBe(DEFAULT_XP_RULES.workout);
  });

  // Eşik KÜMÜLATİF: 1000 kg'lık her basamak bir kez ödüllendirilir.
  // Antrenmanın kendi hacmine bakmak yanlış olurdu.
  it("1000 kg'lık eşiği geçmeyen antrenman hacim XP'si almaz", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: 999, priorVolume: 0 });
    expect(p.total).toBe(DEFAULT_XP_RULES.workout);
  });

  it("tam 1000 kg bir eşik verir", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: 1000, priorVolume: 0 });
    expect(p.total).toBe(DEFAULT_XP_RULES.workout + DEFAULT_XP_RULES.volume);
  });

  // Kritik durum: geçmiş hacim 999, bugün 2 kg. Toplam 1001 → eşik atlanır.
  // Sadece bugünün hacmine bakan bir hesap burada 0 verirdi.
  it("eşik geçmiş hacimle birlikte hesaplanır", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: 2, priorVolume: 999 });
    expect(p.total).toBe(DEFAULT_XP_RULES.workout + DEFAULT_XP_RULES.volume);
  });

  // Ters durum: geçmiş 1500, bugün 400 → toplam 1900, hâlâ 1. basamak.
  // Yeni eşik geçilmediği için ek XP OLMAMALI.
  it("aynı basamakta kalan antrenman ikinci kez ödül almaz", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: 400, priorVolume: 1500 });
    expect(p.total).toBe(DEFAULT_XP_RULES.workout);
  });

  it("birden çok eşik birden geçilebilir", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: 3000, priorVolume: 0 });
    expect(p.total).toBe(DEFAULT_XP_RULES.workout + 3 * DEFAULT_XP_RULES.volume);
  });

  it("rekor sayısı kadar rekor XP'si eklenir", () => {
    const p = projectWorkoutXp({ ...base, newPrCount: 2 });
    expect(p.total).toBe(DEFAULT_XP_RULES.workout + 2 * DEFAULT_XP_RULES.pr);
  });

  it("negatif hacim XP düşürmez", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: -5000, priorVolume: -100 });
    expect(p.total).toBe(DEFAULT_XP_RULES.workout);
  });

  it("kural kapalıysa (0) o kalem XP üretmez", () => {
    const p = projectWorkoutXp({
      ...base, workoutVolume: 5000, newPrCount: 3,
      rules: { workout: 0, volume: 0, pr: 0 },
    });
    expect(p.total).toBe(0);
  });

  it("toplam, dökümdeki kalemlerin toplamına eşittir", () => {
    const p = projectWorkoutXp({ ...base, workoutVolume: 2500, priorVolume: 300, newPrCount: 1 });
    expect(p.total).toBe(p.parts.reduce((a, x) => a + x.xp, 0));
  });
});
