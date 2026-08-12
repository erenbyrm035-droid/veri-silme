import "server-only";
import { createClient } from "@/lib/supabase/server";
import { computeTotals, estimate1RM, type SetLike, type ExerciseLike, type WorkoutTotals } from "./engine";
import { estimateCalories, metOf } from "./calories";
import type { Workout, WorkoutSet } from "@/lib/database.types";

// ============================================================================
// ANTRENMAN SONU ÖZETİ
//
// TASARIM: Bulgular ÖNCE deterministik olarak hesaplanır, AI SONRA yalnızca
// anlatır. Sebebi:
//   · Rakamı model uydurmaz — "%12 arttı" gerçekten hesaplanmış bir sayıdır
//   · AI erişilemezse (kota, ağ, anahtar yok) özet YİNE çalışır; sadece
//     anlatı eksik olur, veri değil
//   · Aynı bulgular ileride bildirim/rapor gibi başka yerlerde de kullanılır
// ============================================================================

export interface PrHit {
  exerciseName: string;      // standart İngilizce ad (gösterim için)
  weightKg: number;
  reps: number;
  est1rm: number;
  /** Önceki rekor — ilk kez ise null. */
  previous1rm: number | null;
}

export interface WorkoutComparison {
  /** Önceki tamamlanmış antrenmanın toplam hacmi. */
  previousVolume: number | null;
  /** Yüzde değişim (+12 → %12 arttı). Önceki yoksa null. */
  volumeChangePct: number | null;
  previousDate: string | null;
}

export interface WorkoutSummaryData {
  workout: Workout;
  totals: WorkoutTotals;
  durationMin: number | null;
  calories: number;
  prs: PrHit[];
  comparison: WorkoutComparison;
  /** Deterministik bulgu cümleleri — AI bunları ANLATIR, üretmez. */
  facts: string[];
  /** Toparlanma etkisi: bu antrenmanın yüküne dair nesnel not. */
  recoveryNote: string | null;
}

export async function getWorkoutSummary(
  workoutId: string,
  userId: string
): Promise<WorkoutSummaryData | null> {
  const supabase = await createClient();

  const { data: workout } = await supabase
    .from("workouts").select("*").eq("id", workoutId).eq("user_id", userId).maybeSingle();
  if (!workout) return null;

  const { data: setRows } = await supabase
    .from("workout_sets").select("*").eq("workout_id", workoutId);
  const sets = (setRows ?? []) as WorkoutSet[];

  const exerciseIds = [...new Set(sets.map((s) => s.exercise_id).filter((x): x is string => !!x))];

  const [{ data: exRows }, { data: profile }, { data: prevWorkouts }] = await Promise.all([
    exerciseIds.length
      ? supabase.from("exercises")
          .select("id, name, english_name, muscle_group, movement_type, rec_reps, rec_rest_sec")
          .in("id", exerciseIds)
      : Promise.resolve({ data: [] }),
    supabase.from("profiles").select("weight_kg").eq("id", userId).maybeSingle(),
    // Bu antrenmandan ÖNCEKİ tamamlanmış antrenmanlar (karşılaştırma için).
    supabase.from("workouts")
      .select("id, workout_date, completed_at")
      .eq("user_id", userId).eq("status", "completed").neq("id", workoutId)
      .lte("workout_date", workout.workout_date)
      .order("workout_date", { ascending: false })
      .limit(1),
  ]);

  const exercises = (exRows ?? []) as unknown as ExerciseLike[];
  const totals = computeTotals(sets as unknown as SetLike[], exercises);
  const weightKg = (profile?.weight_kg as number | null) ?? null;
  const durationMin = (workout.duration_min as number | null) ?? null;
  const calories = estimateCalories(durationMin ?? 0, weightKg, metOf("strength"));

  const comparison = await buildComparison(supabase, prevWorkouts?.[0]?.id ?? null,
    prevWorkouts?.[0]?.workout_date ?? null, totals.totalVolume, exercises);

  const prs = await findPrs(supabase, userId, sets, exercises);

  return {
    workout: workout as Workout,
    totals,
    durationMin,
    calories,
    prs,
    comparison,
    facts: buildFacts(totals, comparison, prs, durationMin),
    recoveryNote: recoveryNote(totals, comparison),
  };
}

/** Önceki antrenmanın hacmi — aynı hesap fonksiyonuyla, tutarlı olsun diye. */
async function buildComparison(
  supabase: Awaited<ReturnType<typeof createClient>>,
  prevId: string | null,
  prevDate: string | null,
  currentVolume: number,
  exercises: ExerciseLike[]
): Promise<WorkoutComparison> {
  if (!prevId) return { previousVolume: null, volumeChangePct: null, previousDate: null };

  const { data } = await supabase.from("workout_sets").select("*").eq("workout_id", prevId);
  const prevTotals = computeTotals((data ?? []) as unknown as SetLike[], exercises);
  const prev = prevTotals.totalVolume;

  return {
    previousVolume: prev,
    // Önceki hacim 0 ise yüzde hesaplanamaz (sıfıra bölme) — null döner.
    volumeChangePct: prev > 0 ? Math.round(((currentVolume - prev) / prev) * 100) : null,
    previousDate: prevDate,
  };
}

/**
 * Bu antrenmanda kırılan rekorlar.
 *
 * `personal_records` tablosu zaten güncellenmiş durumda (set tamamlanırken
 * yazılıyor). Burada o kayıtların TARİHİNE bakıp bugün kırılanları buluyoruz.
 */
async function findPrs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  sets: WorkoutSet[],
  exercises: ExerciseLike[]
): Promise<PrHit[]> {
  const done = sets.filter((s) => s.completed && (s.weight_kg ?? 0) > 0 && (s.reps ?? 0) > 0);
  if (done.length === 0) return [];

  const names = [...new Set(done.map((s) => s.exercise_name))];
  const { data: prRows } = await supabase
    .from("personal_records")
    .select("exercise_name, best_weight, best_reps, est_1rm, achieved_on")
    .eq("user_id", userId).in("exercise_name", names);

  const byName = new Map(((prRows ?? []) as { exercise_name: string; best_weight: number; best_reps: number; est_1rm: number; achieved_on: string }[])
    .map((r) => [r.exercise_name, r]));
  const exByName = new Map(exercises.map((e) => [e.name, e]));

  const bugun = new Date().toISOString().slice(0, 10);
  const hits: PrHit[] = [];

  for (const name of names) {
    const rec = byName.get(name);
    if (!rec || rec.achieved_on !== bugun) continue;   // bugün kırılmamış
    const ex = exByName.get(name);
    hits.push({
      exerciseName: ex?.english_name?.trim() || name,   // GÖSTERİM standart isimle
      weightKg: Number(rec.best_weight),
      reps: Number(rec.best_reps),
      est1rm: Number(rec.est_1rm),
      previous1rm: null,
    });
  }
  return hits;
}

/**
 * Deterministik bulgu cümleleri. AI bunları ANLATIR; sayı üretmez.
 * AI çalışmasa bile kullanıcı bu cümleleri görür.
 */
function buildFacts(
  totals: WorkoutTotals,
  cmp: WorkoutComparison,
  prs: PrHit[],
  durationMin: number | null
): string[] {
  const f: string[] = [];

  f.push(`Bu antrenmanda ${totals.exerciseCount} harekette ${totals.totalSets} set, ` +
         `${totals.totalReps} tekrar yaptın; toplam hacim ${totals.totalVolume.toLocaleString("tr-TR")} kg.`);

  if (durationMin) f.push(`Antrenman ${durationMin} dakika sürdü.`);

  if (cmp.volumeChangePct !== null && cmp.previousVolume !== null) {
    const yon = cmp.volumeChangePct >= 0 ? "arttı" : "azaldı";
    f.push(`Toplam hacmin bir önceki antrenmana göre %${Math.abs(cmp.volumeChangePct)} ${yon} ` +
           `(${cmp.previousVolume.toLocaleString("tr-TR")} kg → ${totals.totalVolume.toLocaleString("tr-TR")} kg).`);
  } else if (cmp.previousVolume === null) {
    f.push("Karşılaştırılacak önceki antrenman yok — bu senin ilk kayıtlı antrenmanın.");
  }

  if (totals.muscleGroups.length > 0) {
    const top = totals.muscleGroups.slice(0, 3)
      .map((m) => `${m.name} (${m.sets} set)`).join(", ");
    f.push(`En çok çalışan kas grupları: ${top}.`);
  }

  for (const pr of prs) {
    f.push(`YENİ REKOR: ${pr.exerciseName} — ${pr.weightKg} kg × ${pr.reps} (tahmini 1RM ${pr.est1rm} kg).`);
  }

  return f;
}

/**
 * Toparlanma etkisi — nesnel, tıbbi iddia içermeyen bir not.
 * Hacim sıçraması yüksekse dinlenmeye dikkat çeker; teşhis koymaz.
 */
function recoveryNote(totals: WorkoutTotals, cmp: WorkoutComparison): string | null {
  if (totals.totalSets === 0) return null;
  if (cmp.volumeChangePct !== null && cmp.volumeChangePct >= 30) {
    return "Hacmin belirgin biçimde arttı. Bir sonraki antrenmana kadar uyku ve " +
           "protein alımına dikkat et; kas ağrısı beklenenden uzun sürerse yükü sabit tut.";
  }
  if (cmp.volumeChangePct !== null && cmp.volumeChangePct <= -25) {
    return "Hacmin önceki antrenmana göre düştü. Yorgunluk, uyku veya beslenme " +
           "kaynaklı olabilir; birkaç seans aynı yükte kalmak toparlanmaya yardım eder.";
  }
  if (totals.totalSets >= 20) {
    return "Yüksek set sayılı bir seans oldu. Aynı kas grubunu 48 saat içinde " +
           "tekrar zorlamamak toparlanmayı destekler.";
  }
  return null;
}

/** Her rekor için Epley — motor ile aynı formül kullanılsın diye dışa açık. */
export { estimate1RM };
