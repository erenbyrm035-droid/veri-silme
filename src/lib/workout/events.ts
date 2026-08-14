"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Antrenman analitik olayları.
//
// HATA YUTULUR. Analitik kaybı antrenmanı bozmamalı: kullanıcı set kaydederken
// olay yazımı patlarsa set yine kaydedilmiş olmalı. Aynı yaklaşım ajan
// telemetrisinde de var (lib/ai/agents/runner.ts → recordRuns).
//
// RLS: kullanıcı yalnızca kendi user_id'siyle satır yazabilir (migration 0053).
// Bu yüzden `createClient()` (kullanıcı oturumu) kullanılıyor, admin istemci
// DEĞİL — servis anahtarıyla yazmak RLS'i devre dışı bırakır ve bir hata
// durumunda başka kullanıcının adına satır açılmasına kapı aralardı.
//
// HIZ SINIRI YOK — BİLEREK. Diğer yazma action'larına `guardAction` eklendi
// ama buraya eklenmedi: tek bir antrenman seansı yüzlerce olay üretebiliyor
// (her set, her dinlenme, her egzersiz geçişi). Normal bir sınır uygulanırsa
// olaylar sessizce düşer ve `workout_event_funnel` görünümü gerçekte olandan
// düşük tamamlanma oranı gösterir — yani veriyi korumak isterken veriyi
// bozarız. Suistimal yüzeyi de dar: yazma RLS ile kendi satırlarıyla sınırlı
// ve tablo yalnızca analitik amaçlı.
// ============================================================================

export type WorkoutEvent =
  | "workout_started"
  | "exercise_started"
  | "set_completed"
  | "set_skipped"
  | "rest_started"
  | "rest_skipped"
  | "pr_achieved"
  | "workout_completed";

export interface TrackInput {
  event: WorkoutEvent;
  workoutId?: string | null;
  exerciseId?: string | null;
  payload?: Record<string, unknown>;
}

export async function trackWorkoutEvent(input: TrackInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("workout_events").insert({
      user_id: user.id,
      workout_id: input.workoutId ?? null,
      exercise_id: input.exerciseId ?? null,
      event: input.event,
      payload: input.payload ?? {},
    });
  } catch {
    /* analitik kaybı sessiz — akış bozulmaz */
  }
}

/** Birden çok olayı tek turda yazar (ör. antrenman sonu toplu kayıt). */
export async function trackWorkoutEvents(inputs: TrackInput[]): Promise<void> {
  if (inputs.length === 0) return;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("workout_events").insert(
      inputs.map((i) => ({
        user_id: user.id,
        workout_id: i.workoutId ?? null,
        exercise_id: i.exerciseId ?? null,
        event: i.event,
        payload: i.payload ?? {},
      }))
    );
  } catch {
    /* sessiz */
  }
}
