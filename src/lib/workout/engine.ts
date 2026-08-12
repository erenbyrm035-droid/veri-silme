// ============================================================================
// WORKOUT ENGINE — çekirdek hesaplar
//
// Bu dosyada AĞ YOK, DOM YOK: saf fonksiyonlar. Hem sunucuda hem istemcide
// çalışır ve test edilebilir. Veriyi çağıran taraf getirir.
//
// TASARIM KARARI — HARDCODED DEĞER YOK:
//   Progressive overload önerisi kullanıcının GERÇEK geçmişinden hesaplanır.
//   "Her hafta 2.5 kg ekle" gibi sabit bir kural, 3 aydır aynı kiloda takılan
//   kullanıcıya da yeni başlayana da aynı şeyi söylerdi. Öneri; hedef tekrar
//   aralığı, son seansta yapılan tekrar ve efor (RIR) üzerinden çıkar.
// ============================================================================

import { estimateCalories, metOf } from "./calories";

// --- Tipler ----------------------------------------------------------------

/** Bir setin özeti — DB satırından ya da istemci durumundan gelebilir. */
export interface SetLike {
  exercise_id: string | null;
  exercise_name: string;
  set_order: number;
  reps: number | null;
  weight_kg: number | null;
  target_reps?: number | null;
  rir?: number | null;
  rpe?: number | null;
  completed: boolean;
}

/** Egzersizin motor için gereken alanları. */
export interface ExerciseLike {
  id: string;
  name: string;
  english_name?: string | null;
  muscle_group: string;
  primary_muscles?: string[] | null;
  equipment?: string | null;
  difficulty?: string | null;
  movement_type?: string | null;
  rec_sets?: number | null;
  rec_reps?: string | null;
  rec_rest_sec?: number | null;
  average_duration_sec?: number | null;
}

// --- Hedef tekrar aralığı --------------------------------------------------

/**
 * `rec_reps` serbest metin ("8-12", "10", "12-15 kontrollü", "30 sn").
 * Sayısal aralığa çevirir; çıkarılamazsa null.
 *
 * Süre bazlı hareketlerde (plank: "30 sn") tekrar aralığı YOKTUR — null
 * dönmek doğru davranış; uydurma bir aralık progressive overload'ı yanıltır.
 */
export function parseRepRange(rec: string | null | undefined): { min: number; max: number } | null {
  if (!rec) return null;
  const s = String(rec).toLowerCase();
  if (/\b(sn|saniye|dk|dakika|sec|min)\b/.test(s)) return null; // süre bazlı
  const nums = s.match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  const a = parseInt(nums[0], 10);
  const b = nums.length > 1 ? parseInt(nums[1], 10) : a;
  if (!Number.isFinite(a) || a <= 0) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

// --- Antrenman özeti (başlamadan önce) -------------------------------------

export interface WorkoutOverview {
  exerciseCount: number;
  totalSets: number;
  completedSets: number;
  /** Tahmini süre (dk) — set süresi + dinlenmeler. */
  estimatedMinutes: number;
  estimatedCalories: number;
  /** Egzersizlerin zorluk dağılımından baskın olan. */
  difficulty: string | null;
  /** Hedeflenen kas grupları, set sayısına göre çoktan aza. */
  muscleGroups: { name: string; sets: number }[];
  /** Antrenman başlamış mı (en az bir tamamlanmış set). */
  started: boolean;
}

/** Bir setin tahmini süresi (sn): hareket süresi + dinlenme. */
const DEFAULT_SET_SECONDS = 40;
const DEFAULT_REST_SECONDS = 90;

/**
 * Planlı setlerden antrenman özeti çıkarır.
 *
 * Süre tahmini: her set için hareket süresi + dinlenme. Son setin dinlenmesi
 * sayılmaz — antrenman orada biter, kullanıcı 90 saniye daha beklemez.
 */
export function buildOverview(
  sets: SetLike[],
  exercises: ExerciseLike[],
  opts: { weightKg?: number | null; activity?: string | null } = {}
): WorkoutOverview {
  const byId = new Map(exercises.map((e) => [e.id, e]));

  const exerciseIds: string[] = [];
  const seen = new Set<string>();
  for (const s of sets) {
    const key = s.exercise_id ?? s.exercise_name;
    if (!seen.has(key)) { seen.add(key); exerciseIds.push(key); }
  }

  let seconds = 0;
  const muscleSets = new Map<string, number>();
  const diffCount = new Map<string, number>();

  sets.forEach((s, i) => {
    const ex = s.exercise_id ? byId.get(s.exercise_id) : undefined;
    const setSec = ex?.average_duration_sec && ex.average_duration_sec > 0
      ? Math.min(ex.average_duration_sec, 180)   // aşırı uç değerleri kırp
      : DEFAULT_SET_SECONDS;
    const restSec = ex?.rec_rest_sec && ex.rec_rest_sec > 0 ? ex.rec_rest_sec : DEFAULT_REST_SECONDS;
    seconds += setSec + (i < sets.length - 1 ? restSec : 0);

    const mg = ex?.muscle_group ?? "Diğer";
    muscleSets.set(mg, (muscleSets.get(mg) ?? 0) + 1);
    if (ex?.difficulty) diffCount.set(ex.difficulty, (diffCount.get(ex.difficulty) ?? 0) + 1);
  });

  const estimatedMinutes = sets.length > 0 ? Math.max(1, Math.round(seconds / 60)) : 0;
  const difficulty = [...diffCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    exerciseCount: exerciseIds.length,
    totalSets: sets.length,
    completedSets: sets.filter((s) => s.completed).length,
    estimatedMinutes,
    estimatedCalories: estimateCalories(estimatedMinutes, opts.weightKg, metOf(opts.activity ?? "strength")),
    difficulty,
    muscleGroups: [...muscleSets.entries()]
      .map(([name, s]) => ({ name, sets: s }))
      .sort((a, b) => b.sets - a.sets),
    started: sets.some((s) => s.completed),
  };
}

// --- Önceki performans -----------------------------------------------------

export interface PreviousPerformance {
  /** En iyi set (hacme göre) — kullanıcıya "geçen sefer" olarak gösterilir. */
  bestWeight: number | null;
  bestReps: number | null;
  /** O seanstaki tüm setler, sıraya göre. */
  sets: { reps: number | null; weight_kg: number | null; rir: number | null }[];
  /** Son seansta ulaşılan en düşük RIR (en zorlanılan set). */
  minRir: number | null;
}

/**
 * Aynı egzersizin ÖNCEKİ seansındaki performansını çıkarır.
 *
 * Girdi: bu egzersize ait, tarihe göre YENİDEN ESKİYE sıralı setler
 * (bu antrenman hariç). En yeni seansın setleri alınır.
 */
export function previousPerformance(history: SetLike[]): PreviousPerformance | null {
  const done = history.filter((s) => s.completed && (s.reps ?? 0) > 0);
  if (done.length === 0) return null;

  const best = done.reduce((b, s) => {
    const v = (s.weight_kg ?? 0) * (s.reps ?? 0);
    const bv = (b.weight_kg ?? 0) * (b.reps ?? 0);
    return v > bv ? s : b;
  }, done[0]);

  const rirs = done.map((s) => s.rir).filter((r): r is number => typeof r === "number");

  return {
    bestWeight: best.weight_kg ?? null,
    bestReps: best.reps ?? null,
    sets: done.map((s) => ({ reps: s.reps, weight_kg: s.weight_kg, rir: s.rir ?? null })),
    minRir: rirs.length ? Math.min(...rirs) : null,
  };
}

// --- Progressive overload --------------------------------------------------

export type OverloadAction = "increase_reps" | "increase_weight" | "hold" | "deload" | "first_time";

export interface OverloadSuggestion {
  action: OverloadAction;
  weightKg: number | null;
  reps: number;
  /** Kullanıcıya gösterilecek tek cümlelik gerekçe. */
  reason: string;
}

/** Ağırlık artışı: en küçük gerçekçi adım. Barbell 2.5, diğerleri 2.5'in altına inebilir. */
export function nextWeightStep(current: number): number {
  if (current <= 0) return 0;
  const step = current < 20 ? 1 : current < 40 ? 2.5 : 2.5;
  return Math.round((current + step) * 2) / 2; // 0.5 kg hassasiyet
}

/**
 * Bir sonraki set için öneri — kullanıcının GEÇMİŞİNDEN hesaplanır.
 *
 * Karar sırası:
 *   1. Geçmiş yok            → ilk kez; öneri verilmez, hedef aralığın altı
 *   2. RIR 0-1 (tükenmiş)    → sabit kal; efor zaten üst sınırda
 *   3. Hedef ÜST sınıra ulaşmış → ağırlığı artır, tekrarı alt sınıra indir
 *   4. Hedef aralığın içinde → tekrarı 1 artır
 *   5. Hedefin ALTINDA kalmış → tekrarı tekrar dene (ağırlık aynı)
 *   6. Performans düşüyor    → deload: ağırlığı %5 azalt
 *
 * `range` yoksa (süre bazlı hareket) sadece tekrar artışı önerilir.
 */
export function suggestNextSet(
  prev: PreviousPerformance | null,
  range: { min: number; max: number } | null,
  opts: { trendDown?: boolean } = {}
): OverloadSuggestion {
  const min = range?.min ?? 8;
  const max = range?.max ?? 12;

  if (!prev || prev.bestReps === null) {
    return {
      action: "first_time",
      weightKg: null,
      reps: min,
      reason: "Bu hareketi ilk kez yapıyorsun — rahat bir ağırlıkla başla, formu oturt.",
    };
  }

  const w = prev.bestWeight ?? 0;
  const r = prev.bestReps;
  const gecenSefer = w > 0 ? `${w} kg × ${r}` : `${r} tekrar`;

  // Performans düşüyorsa yükü artırmak yerine geri çek.
  if (opts.trendDown) {
    const deload = w > 0 ? Math.round(w * 0.95 * 2) / 2 : 0;
    return {
      action: "deload",
      weightKg: w > 0 ? deload : null,
      reps: min,
      reason: `Son seanslarda performans düşüyor. Ağırlığı %5 azaltıp (${deload} kg) formu toparlamanı öneriyorum.`,
    };
  }

  // RIR 0-1: kullanıcı zaten sınırda; yük artışı form bozar.
  if (prev.minRir !== null && prev.minRir <= 1) {
    return {
      action: "hold",
      weightKg: w > 0 ? w : null,
      reps: r,
      reason: `Geçen sefer ${gecenSefer} yaptın ve RIR ${prev.minRir}'e indin — sınırdaydın. Aynı yükte kal, dinlenmeni uzat.`,
    };
  }

  // Hedef üst sınıra ulaşmış → ağırlığı artır, tekrarı alta indir.
  if (r >= max && w > 0) {
    const next = nextWeightStep(w);
    return {
      action: "increase_weight",
      weightKg: next,
      reps: min,
      reason: `Geçen sefer ${gecenSefer} ile hedef aralığın üstüne çıktın. Bugün ${next} kg × ${min} dene.`,
    };
  }

  // Aralığın altında kalmış → aynı yükte hedefi tuttur.
  if (r < min) {
    return {
      action: "hold",
      weightKg: w > 0 ? w : null,
      reps: min,
      reason: `Geçen sefer ${gecenSefer} yaptın. Aynı ağırlıkta ${min} tekrarı tutturmayı hedefle.`,
    };
  }

  // Aralık içinde → tekrar ekle.
  const hedef = Math.min(r + 1, max);
  return {
    action: "increase_reps",
    weightKg: w > 0 ? w : null,
    reps: hedef,
    reason: `Geçen sefer ${gecenSefer} yaptın. Bugün ${w > 0 ? `${w} kg × ${hedef}` : `${hedef} tekrar`} dene.`,
  };
}

/**
 * Son seanslarda düşüş var mı — hacim (ağırlık × tekrar) karşılaştırması.
 *
 * En az 2 seans gerekir; tek seansa bakıp "düşüyorsun" demek yanıltıcı olur.
 * `sessions` yeniden eskiye sıralı, her biri o seansın toplam hacmi.
 */
export function isTrendingDown(sessions: number[]): boolean {
  if (sessions.length < 2) return false;
  const [son, onceki] = sessions;
  if (onceki <= 0) return false;
  return son < onceki * 0.9; // %10'dan fazla düşüş
}

// --- Antrenman özeti (bitişte) ---------------------------------------------

export interface WorkoutTotals {
  totalSets: number;
  totalReps: number;
  /** Toplam hacim (kg × tekrar). */
  totalVolume: number;
  exerciseCount: number;
  muscleGroups: { name: string; volume: number; sets: number }[];
}

export function computeTotals(sets: SetLike[], exercises: ExerciseLike[]): WorkoutTotals {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const done = sets.filter((s) => s.completed);
  const muscle = new Map<string, { volume: number; sets: number }>();
  const exIds = new Set<string>();

  let totalReps = 0;
  let totalVolume = 0;

  for (const s of done) {
    const reps = s.reps ?? 0;
    const vol = (s.weight_kg ?? 0) * reps;
    totalReps += reps;
    totalVolume += vol;
    exIds.add(s.exercise_id ?? s.exercise_name);

    const mg = (s.exercise_id ? byId.get(s.exercise_id)?.muscle_group : null) ?? "Diğer";
    const cur = muscle.get(mg) ?? { volume: 0, sets: 0 };
    muscle.set(mg, { volume: cur.volume + vol, sets: cur.sets + 1 });
  }

  return {
    totalSets: done.length,
    totalReps,
    totalVolume: Math.round(totalVolume),
    exerciseCount: exIds.size,
    muscleGroups: [...muscle.entries()]
      .map(([name, v]) => ({ name, volume: Math.round(v.volume), sets: v.sets }))
      .sort((a, b) => b.volume - a.volume),
  };
}

/** Epley formülü ile tahmini 1RM — PR tespitinde kullanılır. */
export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
