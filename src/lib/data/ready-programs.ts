import "server-only";
import { unstable_cache } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { CATALOG_TAGS, ensure } from "./catalog";

export interface ReadyProgram {
  id: string;
  slug: string;
  name: string;
  short_description: string | null;
  description: string | null;
  category: string | null;
  level: string;
  goal: string | null;
  gender: string;
  environment: string;
  weeks: number;
  days_per_week: number;
  est_minutes: number | null;
  calories: number | null;
  tags: string[];
  rating_avg: number;
  rating_count: number;
  use_count: number;
}

export interface ReadyExercise {
  exercise_id: string | null;
  exercise_name: string;
  sets: number | null;
  reps: string | null;
  rest_sec: number | null;
  note: string | null;
}

export interface ReadyDay {
  id: string;
  week: number;
  day: number;
  title: string | null;
  focus: string | null;
  is_rest: boolean;
  exercises: ReadyExercise[];
}

export interface ProgramCategory { slug: string; name: string }

/** Program listesi/detayında seçilen sütunlar — iki sorguda da aynı. */
const PROGRAM_COLS =
  "id, slug, name, short_description, description, category, level, goal, gender, environment, weeks, days_per_week, est_minutes, calories, tags, rating_avg, rating_count, use_count";

// ---------------------------------------------------------------------------
// ÖNBELLEK — hazır programlar kullanıcıya göre değişmiyor.
//
// Bu iki sorgu yalnızca `status = 'published'` filtreliyor; sonuç her kullanıcı
// için aynı. Egzersiz kataloğuyla birebir aynı gerekçe, o yüzden aynı tag'i
// (`CATALOG_TAGS.programs`) paylaşıyorlar — admin bir programı yayınladığında
// tek `revalidateTag` ikisini birden tazeliyor.
//
// `createAdminClient` kullanılıyor çünkü `unstable_cache` çerez okuyan bir
// fonksiyonu saramaz. Veri zaten herkese açık katalog.
//
// HATA YUTULMUYOR: eskiden ikisi de `?? []` / sessiz null döndürüyordu.
// Önbellekle birlikte bu tehlikeli hale gelirdi — anlık bir sorgu hatası "0
// program" sonucunu BİR SAAT saklardı. `ensure` hata halinde throw ediyor,
// `unstable_cache` da throw eden çağrının sonucunu saklamıyor.
// ---------------------------------------------------------------------------

/** Yayınlanmış hazır programlar (katalog). */
export const listReadyPrograms = unstable_cache(
  async (): Promise<ReadyProgram[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("workout_programs")
      .select(PROGRAM_COLS)
      .eq("status", "published")
      .order("sort_order", { ascending: true });
    return ensure<ReadyProgram>(data as ReadyProgram[] | null, error, "hazır programlar");
  },
  ["catalog-ready-programs"],
  { tags: [CATALOG_TAGS.programs], revalidate: 3600 }
);

/** Programlarda geçen kategori sluglarına karşılık gelen kategori adları. */
export async function listProgramCategories(): Promise<ProgramCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_categories")
    .select("slug, name")
    .order("sort_order", { ascending: true });
  return (data as ProgramCategory[]) ?? [];
}

/**
 * Tek program + günleri + egzersizleri (slug ile).
 *
 * ÜÇ SORGU YAPIYOR ve `/programs/hazir/[slug]` sayfası bunu İKİ kez çağırıyordu
 * (`generateMetadata` + sayfanın kendisi) — görüntüleme başına 6 sorgu. Artık
 * hem önbellekli hem de tekrar çağrı aynı sonuca düşüyor.
 */
export const getReadyProgram = unstable_cache(
  async (slug: string): Promise<{ program: ReadyProgram; days: ReadyDay[] } | null> => {
  const admin = createAdminClient();
  const { data: program, error: pErr } = await admin
    .from("workout_programs")
    .select(PROGRAM_COLS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  // Bulunamadı (null) ile sorgu hatası ayrı şeyler: ilki geçerli bir sonuç
  // (404 sayfası), ikincisi önbelleğe alınmaması gereken bir arıza.
  if (pErr) throw new Error(`Program yüklenemedi (${slug}): ${pErr.message}`);
  if (!program) return null;

  const { data: dayRows, error: dErr } = await admin
    .from("workout_program_days")
    .select("id, week, day, title, focus, is_rest")
    .eq("program_id", program.id)
    .order("week", { ascending: true })
    .order("day", { ascending: true });
  const days = ensure<Omit<ReadyDay, "exercises">>(
    dayRows as Omit<ReadyDay, "exercises">[] | null, dErr, "program günleri"
  );

  const dayIds = days.map((d) => d.id);
  let exByDay: Record<string, ReadyExercise[]> = {};
  if (dayIds.length) {
    const { data: exRows, error: eErr } = await admin
      .from("workout_program_exercises")
      .select("day_id, exercise_id, exercise_name, sets, reps, rest_sec, note, sort_order")
      .in("day_id", dayIds)
      .order("sort_order", { ascending: true });
    if (eErr) throw new Error(`Program egzersizleri yüklenemedi (${slug}): ${eErr.message}`);
    exByDay = (exRows ?? []).reduce((acc: Record<string, ReadyExercise[]>, r: ReadyExercise & { day_id: string }) => {
      (acc[r.day_id] ??= []).push({ exercise_id: r.exercise_id, exercise_name: r.exercise_name, sets: r.sets, reps: r.reps, rest_sec: r.rest_sec, note: r.note });
      return acc;
    }, {});
  }

  return {
    program: program as ReadyProgram,
    days: days.map((d) => ({ ...d, exercises: exByDay[d.id] ?? [] })),
  };
  },
  ["catalog-ready-program"],
  { tags: [CATALOG_TAGS.programs], revalidate: 3600 }
);

/** Kullanıcının başlattığı programların durumu (program_id → status/pct). */
export async function getMyProgramProgress(userId: string): Promise<Record<string, { status: string; progress_pct: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_progress")
    .select("program_id, status, progress_pct")
    .eq("user_id", userId);
  const map: Record<string, { status: string; progress_pct: number }> = {};
  for (const r of (data ?? []) as { program_id: string; status: string; progress_pct: number }[]) {
    map[r.program_id] = { status: r.status, progress_pct: r.progress_pct };
  }
  return map;
}
