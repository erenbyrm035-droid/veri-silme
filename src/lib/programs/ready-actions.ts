"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability/report-server";
import { guardAction, LIMITS } from "@/lib/security/action-guard";

export interface StartResult { ok: boolean; error?: string; created?: number }

/** "12-15", "30-45 sn", "8/taraf" → baştaki sayıyı int olarak alır (yoksa null). */
function parseReps(reps: string | null): number | null {
  const m = String(reps ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

type Admin = ReturnType<typeof createAdminClient>;

/** Programın günlerini kullanıcının workouts listesine planlı antrenman olarak ekler. */
async function createWorkoutsForProgram(admin: Admin, userId: string, programId: string, slug: string): Promise<number> {
  const { data: prog } = await admin.from("workout_programs").select("name").eq("id", programId).maybeSingle();
  const { data: days } = await admin
    .from("workout_program_days").select("id, day, title, is_rest")
    .eq("program_id", programId).eq("week", 1).order("day", { ascending: true });

  const dayList = (days ?? []) as { id: string; day: number; title: string | null; is_rest: boolean }[];
  const dayIds = dayList.map((d) => d.id);
  let exByDay: Record<string, { exercise_id: string | null; exercise_name: string; sets: number | null; reps: string | null }[]> = {};
  if (dayIds.length) {
    const { data: exs } = await admin
      .from("workout_program_exercises").select("day_id, exercise_id, exercise_name, sets, reps, sort_order")
      .in("day_id", dayIds).order("sort_order", { ascending: true });
    exByDay = (exs ?? []).reduce((acc: typeof exByDay, r: { day_id: string } & typeof exByDay[string][number]) => {
      (acc[r.day_id] ??= []).push(r); return acc;
    }, {});
  }

  const today = new Date();
  let created = 0;
  for (let i = 0; i < dayList.length; i++) {
    const d = dayList[i];
    if (d.is_rest) continue;
    const date = new Date(today);
    date.setDate(today.getDate() + i * 2);
    const title = `${prog?.name ?? "Program"} · ${d.title ?? `${d.day}. Gün`}`;

    const { data: w, error: wErr } = await admin.from("workouts")
      .insert({ user_id: userId, title, workout_date: date.toISOString().slice(0, 10), status: "planned", notes: `hazir:${slug}` })
      .select("id").single();
    if (wErr || !w) continue;
    created++;

    const sets: { workout_id: string; exercise_id: string | null; exercise_name: string; set_order: number; reps: number | null; completed: boolean }[] = [];
    for (const ex of exByDay[d.id] ?? []) {
      const nSets = Math.max(1, Math.min(6, ex.sets ?? 1));
      const reps = parseReps(ex.reps);
      for (let s = 1; s <= nSets; s++) {
        sets.push({ workout_id: w.id, exercise_id: ex.exercise_id, exercise_name: ex.exercise_name, set_order: s, reps, completed: false });
      }
    }
    if (sets.length) await admin.from("workout_sets").insert(sets);
  }
  return created;
}

/**
 * Hazır programı başlatır: program_progress kaydı + kullanıcının antrenman
 * listesine (workouts) programın günlerini PLANLI olarak ekler. Böylece
 * Antrenmanlar ekranında görünüp tek tek yapılabilir. Yalnızca ilk başlatmada
 * antrenman oluşturur (tekrar başlatınca çoğaltmaz).
 */
export async function startReadyProgram(programId: string, slug: string): Promise<StartResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  const rl = await guardAction("program:start", user.id, LIMITS.sensitive);
  if (!rl.ok) return { ok: false, error: rl.error };

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // İlk başlatma mı? (varsa antrenman tekrar oluşturmayalım)
    const { data: existing } = await admin
      .from("program_progress").select("program_id").eq("user_id", user.id).eq("program_id", programId).maybeSingle();
    const firstStart = !existing;

    const { error: pErr } = await admin.from("program_progress").upsert(
      { user_id: user.id, program_id: programId, status: "active", progress_pct: 0, started_at: now, updated_at: now },
      { onConflict: "user_id,program_id" }
    );
    if (pErr) return { ok: false, error: pErr.message };

    let created = 0;
    if (firstStart) {
      created = await createWorkoutsForProgram(admin, user.id, programId, slug);
    }

    // Kullanım sayacı (kritik değil).
    try {
      const { data } = await admin.from("workout_programs").select("use_count").eq("id", programId).maybeSingle();
      await admin.from("workout_programs").update({ use_count: ((data?.use_count as number) ?? 0) + 1 }).eq("id", programId);
    } catch { /* yut */ }

    revalidatePath("/programs/hazir");
    revalidatePath(`/programs/hazir/${slug}`);
    revalidatePath("/workouts");
    return { ok: true, created };
  } catch (err) {
    await reportError(err, { where: "ready-programs/start", userId: user.id });
    return { ok: false, error: "Program başlatılamadı." };
  }
}

/**
 * Programı yeniden başlatır: bu programdan oluşturulmuş TAMAMLANMAMIŞ planlı
 * antrenmanları siler ve günleri yeniden oluşturur. Tamamlanan antrenmanlara
 * dokunmaz. (Antrenman oluşmayan eski başlatmaları düzeltmek için de kullanılır.)
 */
export async function restartReadyProgram(programId: string, slug: string): Promise<StartResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  const rl = await guardAction("program:restart", user.id, LIMITS.sensitive);
  if (!rl.ok) return { ok: false, error: rl.error };
  try {
    const admin = createAdminClient();
    // Bu programa ait tamamlanmamış planlı antrenmanları temizle.
    await admin.from("workouts")
      .delete()
      .eq("user_id", user.id)
      .eq("notes", `hazir:${slug}`)
      .neq("status", "completed");

    const created = await createWorkoutsForProgram(admin, user.id, programId, slug);

    const now = new Date().toISOString();
    await admin.from("program_progress").upsert(
      { user_id: user.id, program_id: programId, status: "active", progress_pct: 0, started_at: now, updated_at: now },
      { onConflict: "user_id,program_id" }
    );

    revalidatePath("/programs/hazir");
    revalidatePath(`/programs/hazir/${slug}`);
    revalidatePath("/workouts");
    return { ok: true, created };
  } catch (err) {
    await reportError(err, { where: "ready-programs/restart", userId: user.id });
    return { ok: false, error: "Yeniden başlatılamadı." };
  }
}

/** Başlatılan programı bırakır (durumu abandoned). */
export async function abandonReadyProgram(programId: string, slug: string): Promise<StartResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Oturum bulunamadı." };
  const rl = await guardAction("program:abandon", user.id, LIMITS.sensitive);
  if (!rl.ok) return { ok: false, error: rl.error };
  try {
    const admin = createAdminClient();
    await admin.from("program_progress")
      .update({ status: "abandoned", updated_at: new Date().toISOString() })
      .eq("user_id", user.id).eq("program_id", programId);
    revalidatePath("/programs/hazir");
    revalidatePath(`/programs/hazir/${slug}`);
    return { ok: true };
  } catch (err) {
    await reportError(err, { where: "ready-programs/abandon", userId: user.id });
    return { ok: false, error: "İşlem yapılamadı." };
  }
}
