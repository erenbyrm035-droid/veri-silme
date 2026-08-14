"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import { guardAction, LIMITS } from "@/lib/security/action-guard";

export interface DailyResult { ok: boolean; error?: string }

/**
 * Günlük metrik kaydı (adım, uyku, ruh hali, kas ağrısı).
 *
 * RPC `auth.uid()` ile çalışır — kullanıcının yalnızca kendi satırını
 * yazabilmesi veritabanı tarafında garanti altında; service_role kullanılmaz.
 * Gönderilmeyen alanlar korunur (kısmi güncelleme).
 */
export async function saveDailyMetric(input: {
  date?: string;
  steps?: number | null;
  sleepMinutes?: number | null;
  mood?: number | null;
  soreness?: number | null;
}): Promise<DailyResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  const rl = await guardAction("daily:metric", user.id, LIMITS.reaction);
  if (!rl.ok) return { ok: false, error: rl.error };

  // Girdi doğrulama — makul aralıklar dışındaki değerler reddedilir.
  const steps = clamp(input.steps, 0, 200_000);
  const sleep = clamp(input.sleepMinutes, 0, 24 * 60);
  const mood = clamp(input.mood, 1, 5);
  const soreness = clamp(input.soreness, 1, 5);

  if (steps === null && sleep === null && mood === null && soreness === null) {
    return { ok: false, error: "Kaydedilecek bir değer yok." };
  }

  try {
    const { error } = await supabase.rpc("upsert_daily_metric", {
      p_date: input.date ?? null,
      p_steps: steps,
      p_sleep_minutes: sleep,
      p_resting_hr: null,
      p_hrv: null,
      p_mood: mood,
      p_soreness: soreness,
      p_note: null,
      p_source: "manual",
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard");
    revalidatePath("/gamification");
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "daily/saveDailyMetric", userId: user.id });
    return { ok: false, error: "Kaydedilemedi." };
  }
}

function clamp(v: number | null | undefined, min: number, max: number): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(max, Math.max(min, n)));
}
