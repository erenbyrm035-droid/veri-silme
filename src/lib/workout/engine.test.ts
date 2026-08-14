import { describe, it, expect } from "vitest";
import {
  parseRepRange,
  buildOverview,
  previousPerformance,
  suggestNextSet,
  nextWeightStep,
  isTrendingDown,
  computeTotals,
  estimate1RM,
  type SetLike,
  type ExerciseLike,
} from "./engine";

// ============================================================================
// Workout Engine — saf fonksiyonlar.
//
// Bu motor kullanıcıya AĞIRLIK ÖNERİSİ veriyor. Sessizce bozulursa kimse fark
// etmez ama insanlar yanlış yükle antrenman yapar. Bu yüzden özellikle sınır
// durumları (süre bazlı hareket, RIR sınırı, düşen performans) sınanıyor.
// ============================================================================

describe("parseRepRange", () => {
  it("aralığı ayrıştırır", () => {
    expect(parseRepRange("8-12")).toEqual({ min: 8, max: 12 });
  });

  it("tek sayıyı min=max yapar", () => {
    expect(parseRepRange("10")).toEqual({ min: 10, max: 10 });
  });

  it("serbest metnin içindeki aralığı bulur", () => {
    expect(parseRepRange("12-15 kontrollü")).toEqual({ min: 12, max: 15 });
  });

  it("ters yazılmış aralığı düzeltir", () => {
    expect(parseRepRange("15-12")).toEqual({ min: 12, max: 15 });
  });

  // EN ÖNEMLİSİ: plank gibi süre bazlı hareketlerde tekrar aralığı YOKTUR.
  // "30 sn" → {min:30,max:30} dönseydi motor "31 tekrar dene" derdi.
  it("süre bazlı hareketlerde null döner", () => {
    expect(parseRepRange("30 sn")).toBeNull();
    expect(parseRepRange("45 saniye")).toBeNull();
    expect(parseRepRange("2 dk")).toBeNull();
    expect(parseRepRange("60 sec")).toBeNull();
  });

  it("boş/geçersiz girdide null döner", () => {
    expect(parseRepRange(null)).toBeNull();
    expect(parseRepRange(undefined)).toBeNull();
    expect(parseRepRange("")).toBeNull();
    expect(parseRepRange("maksimum")).toBeNull();
  });
});

describe("nextWeightStep", () => {
  it("küçük ağırlıklarda küçük adım atar", () => {
    const next = nextWeightStep(20);
    expect(next).toBeGreaterThan(20);
    expect(next - 20).toBeLessThanOrEqual(2.5);
  });

  it("her zaman 0.5 kg katı döner (plakalar öyle)", () => {
    for (const w of [12.5, 20, 42.5, 60, 100, 140]) {
      expect((nextWeightStep(w) * 2) % 1).toBe(0);
    }
  });

  it("monoton artar", () => {
    for (const w of [10, 20, 40, 80, 120]) {
      expect(nextWeightStep(w)).toBeGreaterThan(w);
    }
  });
});

describe("previousPerformance", () => {
  const set = (o: Partial<SetLike>): SetLike =>
    ({ exercise_id: "e1", exercise_name: "Squat", set_order: 1, reps: 10, weight_kg: 60, completed: true, ...o } as SetLike);

  it("tamamlanmamış setleri saymaz", () => {
    const p = previousPerformance([set({ reps: 99, weight_kg: 200, completed: false })]);
    expect(p).toBeNull();
  });

  it("en iyi seti bulur", () => {
    const p = previousPerformance([
      set({ reps: 8, weight_kg: 60 }),
      set({ reps: 10, weight_kg: 70 }),
      set({ reps: 6, weight_kg: 65 }),
    ]);
    expect(p?.bestWeight).toBe(70);
  });

  it("boş geçmişte null döner", () => {
    expect(previousPerformance([])).toBeNull();
  });
});

describe("suggestNextSet", () => {
  const range = { min: 8, max: 12 };

  // PreviousPerformance.sets o seansın set LİSTESİ (sayısı değil).
  const prev = (bestWeight: number, bestReps: number, minRir: number | null, setCount = 3) => ({
    bestWeight,
    bestReps,
    minRir,
    sets: Array.from({ length: setCount }, () => ({ reps: bestReps, weight_kg: bestWeight, rir: minRir })),
    totalVolume: bestWeight * bestReps * setCount,
  });

  it("geçmiş yoksa ilk kez olarak işaretler", () => {
    const s = suggestNextSet(null, range);
    expect(s.action).toBe("first_time");
    expect(s.reps).toBe(range.min);
  });

  it("hedef üst sınıra ulaşınca ağırlığı artırır ve tekrarı tabana indirir", () => {
    const s = suggestNextSet(prev(60, 12, 3), range);
    expect(s.action).toBe("increase_weight");
    expect(s.weightKg!).toBeGreaterThan(60);
    expect(s.reps).toBe(range.min);
  });

  it("aralık içindeyse tekrar ekler, ağırlığı sabit tutar", () => {
    const s = suggestNextSet(prev(60, 9, 3), range);
    expect(s.action).toBe("increase_reps");
    expect(s.weightKg).toBe(60);
    expect(s.reps).toBe(10);
  });

  it("tekrar önerisi üst sınırı aşmaz", () => {
    const s = suggestNextSet(prev(60, 11, 3), range);
    expect(s.reps).toBeLessThanOrEqual(range.max);
  });

  // RIR ≤ 1: kullanıcı zaten sınırda. Yük artışı form bozar, sakatlık riski.
  it("RIR 1 veya altındaysa yükü artırmaz", () => {
    const s = suggestNextSet(prev(60, 12, 1), range);
    expect(s.action).toBe("hold");
    expect(s.weightKg).toBe(60);
  });

  it("RIR 0 da sınır sayılır", () => {
    const s = suggestNextSet(prev(60, 12, 0), range);
    expect(s.action).toBe("hold");
  });

  // Düşen performans, RIR'dan da hedef aralığından da ÖNCE gelmeli.
  it("performans düşüyorsa deload eder", () => {
    const s = suggestNextSet(
      prev(100, 12, 3),
      range,
      { trendDown: true }
    );
    expect(s.action).toBe("deload");
    expect(s.weightKg!).toBeLessThan(100);
    expect(s.weightKg).toBe(95);
  });

  it("aralığın altında kalındıysa aynı yükte hedefi tutturmayı ister", () => {
    const s = suggestNextSet(prev(60, 5, 3), range);
    expect(s.action).toBe("hold");
    expect(s.reps).toBe(range.min);
  });

  it("vücut ağırlığı hareketinde (ağırlık 0) ağırlık önermez", () => {
    const s = suggestNextSet(prev(0, 12, 3), range);
    expect(s.weightKg).toBeNull();
    expect(s.action).not.toBe("increase_weight");
  });

  it("aralık bilinmiyorsa makul bir varsayılanla çalışır", () => {
    const s = suggestNextSet(null, null);
    expect(s.reps).toBeGreaterThan(0);
  });
});

describe("isTrendingDown", () => {
  it("tek seansa bakıp karar vermez", () => {
    expect(isTrendingDown([1000])).toBe(false);
    expect(isTrendingDown([])).toBe(false);
  });

  it("hacim düşüyorsa true", () => {
    expect(isTrendingDown([800, 1000, 1200])).toBe(true);
  });

  it("hacim artıyorsa false", () => {
    expect(isTrendingDown([1400, 1200, 1000])).toBe(false);
  });
});

describe("buildOverview", () => {
  const ex: ExerciseLike[] = [
    { id: "e1", name: "Squat", muscle_group: "Bacak", difficulty: "intermediate", rec_rest_sec: 90, average_duration_sec: 40 } as ExerciseLike,
    { id: "e2", name: "Bench", muscle_group: "Göğüs", difficulty: "intermediate", rec_rest_sec: 90, average_duration_sec: 40 } as ExerciseLike,
  ];
  const sets: SetLike[] = [
    { exercise_id: "e1", exercise_name: "Squat", set_order: 1, reps: 10, weight_kg: 60, completed: true } as SetLike,
    { exercise_id: "e1", exercise_name: "Squat", set_order: 2, reps: 10, weight_kg: 60, completed: false } as SetLike,
    { exercise_id: "e2", exercise_name: "Bench", set_order: 1, reps: 10, weight_kg: 40, completed: false } as SetLike,
  ];

  it("egzersiz ve set sayılarını doğru sayar", () => {
    const o = buildOverview(sets, ex);
    expect(o.exerciseCount).toBe(2);
    expect(o.totalSets).toBe(3);
    expect(o.completedSets).toBe(1);
    expect(o.started).toBe(true);
  });

  it("hiç tamamlanmış set yoksa başlamamış sayar", () => {
    const o = buildOverview(sets.map((s) => ({ ...s, completed: false })), ex);
    expect(o.started).toBe(false);
    expect(o.completedSets).toBe(0);
  });

  it("kas gruplarını set sayısına göre çoktan aza sıralar", () => {
    const o = buildOverview(sets, ex);
    expect(o.muscleGroups[0].name).toBe("Bacak");
    expect(o.muscleGroups[0].sets).toBe(2);
  });

  it("süre tahmini pozitif ve makul", () => {
    const o = buildOverview(sets, ex);
    expect(o.estimatedMinutes).toBeGreaterThan(0);
    expect(o.estimatedMinutes).toBeLessThan(60);
  });

  it("boş antrenmanda çökmeden sıfır döner", () => {
    const o = buildOverview([], []);
    expect(o.totalSets).toBe(0);
    expect(o.exerciseCount).toBe(0);
    expect(o.started).toBe(false);
  });
});

describe("computeTotals", () => {
  it("yalnızca tamamlanmış setleri toplar", () => {
    const t = computeTotals(
      [
        { exercise_id: "e1", exercise_name: "Squat", set_order: 1, reps: 10, weight_kg: 60, completed: true } as SetLike,
        { exercise_id: "e1", exercise_name: "Squat", set_order: 2, reps: 10, weight_kg: 60, completed: false } as SetLike,
      ],
      []
    );
    expect(t.totalSets).toBe(1);
    expect(t.totalReps).toBe(10);
    expect(t.totalVolume).toBe(600);
  });
});

describe("estimate1RM", () => {
  it("tek tekrarda ağırlığın kendisidir", () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it("tekrar arttıkça tahmini 1RM artar", () => {
    expect(estimate1RM(100, 5)).toBeGreaterThan(100);
  });

  it("geçersiz girdide 0 döner", () => {
    expect(estimate1RM(0, 10)).toBe(0);
  });
});
