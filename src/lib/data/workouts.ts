import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PersonalRecord } from "@/lib/database.types";

export interface WeekVolume {
  label: string;
  volume: number; // toplam tonaj (kg)
  sets: number;
}

/**
 * Son N haftanın antrenman hacmini (tonaj = ağırlık × tekrar) döndürür.
 * Tamamlanan setler baz alınır.
 */
export async function getWeeklyVolume(
  userId: string,
  weeks = 8
): Promise<WeekVolume[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);

  const { data } = await supabase
    .from("workout_sets")
    .select("reps, weight_kg, completed, workouts!inner(user_id, workout_date)")
    .eq("workouts.user_id", userId)
    .eq("completed", true)
    .gte("workouts.workout_date", since.toISOString().slice(0, 10));

  // Hafta anahtarına göre topla (pazartesi başlangıç)
  const buckets = new Map<string, { volume: number; sets: number; date: Date }>();
  (data ?? []).forEach((row) => {
    const w = row.workouts as unknown as { workout_date: string };
    const d = new Date(w.workout_date);
    const day = (d.getDay() + 6) % 7; // pazartesi = 0
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);
    const key = monday.toISOString().slice(0, 10);
    const vol = Number(row.weight_kg ?? 0) * Number(row.reps ?? 0);
    const cur = buckets.get(key) ?? { volume: 0, sets: 0, date: monday };
    cur.volume += vol;
    cur.sets += 1;
    buckets.set(key, cur);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((b) => ({
      label: new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(b.date),
      volume: Math.round(b.volume),
      sets: b.sets,
    }));
}

/** Kullanıcının en iyi kişisel rekorlarını getirir. */
export async function getTopPRs(userId: string, limit = 6): Promise<PersonalRecord[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("personal_records")
    .select("*")
    .eq("user_id", userId)
    .order("est_1rm", { ascending: false })
    .limit(limit);
  return (data ?? []) as PersonalRecord[];
}
