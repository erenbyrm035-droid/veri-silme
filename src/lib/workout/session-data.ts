import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveExerciseMedia, type ResolvedMedia } from "@/lib/media/exercise-media-set";
import {
  buildOverview, previousPerformance, suggestNextSet, parseRepRange, isTrendingDown,
  type SetLike, type ExerciseLike, type WorkoutOverview, type OverloadSuggestion,
  type PreviousPerformance,
} from "./engine";
import type { ExerciseMediaSet, WorkoutSet } from "@/lib/database.types";

// ============================================================================
// Antrenman ekranının TÜM verisi — tek yerde toplanır.
//
// ÖNCEKİ DURUM: sayfa `exercises` tablosunun TAMAMINI (682 satır, tüm
// sütunlarıyla) istemciye yolluyordu. Kullanıcı 4-5 egzersiz yaparken 682
// kaydın açıklaması, talimatları ve ipuçları da inip React ağacına giriyordu.
//
// ŞİMDİ: yalnızca bu antrenmandaki egzersizler + medyaları + o egzersizlerin
// geçmiş performansı çekilir. Egzersiz EKLEME akışı ayrı ve arama tabanlıdır
// (bkz. searchExercises), böylece tam liste hiç yüklenmez.
// ============================================================================

/** Motor arayüzünün bir egzersiz için ihtiyaç duyduğu her şey. */
export interface EngineExercise extends ExerciseLike {
  english_name: string | null;
  secondary_muscles: string[];
  video_slug: string | null;
  media: ResolvedMedia;
  /** Hedef tekrar aralığı (`rec_reps` metninden çözülür). */
  range: { min: number; max: number } | null;
  /** Bu egzersizin ÖNCEKİ seansı. */
  previous: PreviousPerformance | null;
  /** Bir sonraki set için öneri — kullanıcının geçmişinden hesaplanır. */
  suggestion: OverloadSuggestion;
  /** Varsayılan dinlenme (sn). */
  restSec: number;
}

export interface WorkoutSessionData {
  sets: WorkoutSet[];
  exercises: EngineExercise[];
  overview: WorkoutOverview;
}

/** Egzersiz listesinden gereken sütunlar — `select *` yerine dar seçim. */
const EX_COLS =
  "id, name, english_name, muscle_group, primary_muscles, secondary_muscles, equipment, " +
  "difficulty, movement_type, rec_sets, rec_reps, rec_rest_sec, average_duration_sec, " +
  "gif_url, image_url, video_url, video_slug";

const DEFAULT_REST = 90;

export async function getWorkoutSessionData(
  workoutId: string,
  userId: string
): Promise<WorkoutSessionData> {
  const supabase = await createClient();

  const [{ data: setRows }, { data: profile }] = await Promise.all([
    supabase.from("workout_sets").select("*").eq("workout_id", workoutId)
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("weight_kg, gender").eq("id", userId).maybeSingle(),
  ]);

  const sets = (setRows ?? []) as WorkoutSet[];
  const exerciseIds = [...new Set(sets.map((s) => s.exercise_id).filter((x): x is string => !!x))];

  if (exerciseIds.length === 0) {
    return { sets, exercises: [], overview: buildOverview([], []) };
  }

  const gender = (profile?.gender as "male" | "female" | null) ?? null;
  const weightKg = (profile?.weight_kg as number | null) ?? null;

  // Egzersizler + medyaları + geçmiş setler — üçü paralel.
  const [{ data: exRows }, { data: mediaRows }, { data: histRows }] = await Promise.all([
    supabase.from("exercises").select(EX_COLS).in("id", exerciseIds),
    supabase.from("exercise_media_set").select("*").in("exercise_id", exerciseIds),
    // BU antrenman HARİÇ, aynı egzersizlerin tamamlanmış setleri (yeniden eskiye).
    // Progressive overload önerisi buradan çıkar.
    supabase
      .from("workout_sets")
      .select("exercise_id, exercise_name, set_order, reps, weight_kg, rir, completed, created_at, workouts!inner(user_id, status)")
      .in("exercise_id", exerciseIds)
      .neq("workout_id", workoutId)
      .eq("completed", true)
      .eq("workouts.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  const mediaByEx = new Map(
    ((mediaRows ?? []) as ExerciseMediaSet[]).map((m) => [m.exercise_id, m])
  );

  // Geçmişi egzersize göre grupla; her egzersiz için SON SEANS ayrılır.
  type Hist = SetLike & { created_at: string };
  const histByEx = new Map<string, Hist[]>();
  for (const row of ((histRows ?? []) as unknown as Hist[])) {
    const key = row.exercise_id ?? "";
    if (!key) continue;
    (histByEx.get(key) ?? histByEx.set(key, []).get(key)!).push(row);
  }

  const exercises: EngineExercise[] = ((exRows ?? []) as unknown as (ExerciseLike & {
    english_name: string | null; secondary_muscles: string[] | null;
    gif_url: string | null; image_url: string | null; video_url: string | null;
    video_slug: string | null;
  })[]).map((ex) => {
    const hist = histByEx.get(ex.id) ?? [];
    const sonSeans = latestSession(hist);
    const previous = previousPerformance(sonSeans);
    const range = parseRepRange(ex.rec_reps);
    const trendDown = isTrendingDown(sessionVolumes(hist));

    return {
      ...ex,
      secondary_muscles: ex.secondary_muscles ?? [],
      // ANTRENMAN EKRANINDA VİDEO ÖNCELİKLİ. Kütüphanede GIF öne çıkıyor
      // (hızlı önizleme) ama hareket yaparken video daha öğretici.
      media: preferVideo(
        resolveExerciseMedia(mediaByEx.get(ex.id), ex, gender),
        mediaByEx.get(ex.id),
        ex,
        gender
      ),
      range,
      previous,
      suggestion: suggestNextSet(previous, range, { trendDown }),
      restSec: ex.rec_rest_sec && ex.rec_rest_sec > 0 ? ex.rec_rest_sec : DEFAULT_REST,
    };
  });

  return {
    sets,
    exercises,
    overview: buildOverview(sets as unknown as SetLike[], exercises, { weightKg, activity: "strength" }),
  };
}

/**
 * `resolveExerciseMedia` GIF'i önceliklendiriyor. Antrenman sırasında video
 * varsa onu göstermek gerekiyor — bu sarmalayıcı sırayı çevirir, video yoksa
 * mevcut zincire (GIF → thumbnail → üretilen görsel) dokunmaz.
 */
function preferVideo(
  resolved: ResolvedMedia,
  set: Partial<ExerciseMediaSet> | null | undefined,
  fallback: { video_url?: string | null },
  gender: "male" | "female" | null
): ResolvedMedia {
  const video =
    (gender === "female" ? set?.female_video : gender === "male" ? set?.male_video : null) ||
    set?.video_url || fallback.video_url ||
    set?.male_video || set?.female_video || null;
  if (video && video.trim()) {
    return { kind: "video", url: video, poster: resolved.poster ?? set?.thumbnail_url ?? null };
  }
  return resolved;
}

/** Aynı güne ait en yeni setler — "geçen sefer" bir SEANS demek, tek set değil. */
function latestSession<T extends { created_at: string }>(hist: T[]): T[] {
  if (hist.length === 0) return [];
  const gun = (d: string) => d.slice(0, 10);
  const sonGun = gun(hist[0].created_at);
  return hist.filter((h) => gun(h.created_at) === sonGun);
}

/** Seans bazında toplam hacim (yeniden eskiye) — düşüş tespiti için. */
function sessionVolumes(hist: (SetLike & { created_at: string })[]): number[] {
  const byGun = new Map<string, number>();
  for (const h of hist) {
    const g = h.created_at.slice(0, 10);
    byGun.set(g, (byGun.get(g) ?? 0) + (h.weight_kg ?? 0) * (h.reps ?? 0));
  }
  return [...byGun.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, v]) => v);
}

/**
 * Egzersiz ekleme için ARAMA — tam liste hiç yüklenmez.
 * Standart isim, Türkçe iç isim ve alias'lar üzerinden eşleşir.
 */
export async function searchExercises(query: string, limit = 20) {
  const supabase = await createClient();
  const q = query.trim();
  if (!q) return [];
  const { data } = await supabase
    .from("exercises")
    .select("id, name, english_name, muscle_group, equipment, aliases")
    .or(`english_name.ilike.%${q}%,name.ilike.%${q}%`)
    .limit(limit);
  return data ?? [];
}
