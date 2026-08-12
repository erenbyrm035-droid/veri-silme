"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Trophy, Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { syncMyGamification } from "@/lib/gamification/actions";
import { useVoiceCoach, useWakeLock } from "@/lib/voice/useVoiceCoach";
import { VOICE_LINES } from "@/lib/voice/provider";
import { RestTimer } from "@/components/workout/RestTimer";
import { VoiceToggle } from "@/components/workout/VoiceToggle";
import { WorkoutOverview } from "@/components/workout/WorkoutOverview";
import { ExerciseMediaPanel } from "@/components/workout/ExerciseMediaPanel";
import { SetTracker, type SetDraft } from "@/components/workout/SetTracker";
import { displayName } from "@/lib/exercises/display";
import { estimate1RM, computeTotals } from "@/lib/workout/engine";
import { projectWorkoutXp, type XpRules } from "@/lib/gamification/projection";
import { trackWorkoutEvent } from "@/lib/workout/events";
import type { EngineExercise } from "@/lib/workout/session-data";
import type { WorkoutOverview as Overview } from "@/lib/workout/engine";
import type { Workout, WorkoutSet } from "@/lib/database.types";

// ============================================================================
// WORKOUT ENGINE — akışı yöneten kabuk.
//
// AKIŞ: Özet ekranı → egzersiz egzersiz ilerleme → set tamamlama → dinlenme.
//
// KALICI DURUM: Antrenman ilerlemesi zaten `workout_sets` tablosunda; sayfa
// yenilense de kaybolmaz. Burada YALNIZCA "hangi egzersizdeydim" bilgisi
// localStorage'da tutulur — sunucuya yazmaya değmeyecek kadar önemsiz ama
// kullanıcı geri döndüğünde kaldığı yerden devam etmesi için gerekli.
//
// YERLEŞİM: mobilde video üstte + set takibi altta (tek elle kullanım için
// büyük buton en altta). Desktopta iki sütun: solda video, sağda set takibi.
// ============================================================================

const LS_KEY = (id: string) => `viva:workout:${id}:idx`;

export function WorkoutEngine({
  workout,
  exercises,
  initialSets,
  overview,
  xpRules,
  priorVolume,
  isPremium = false,
}: {
  workout: Workout;
  exercises: EngineExercise[];
  initialSets: WorkoutSet[];
  overview: Overview;
  xpRules: XpRules;
  priorVolume: number;
  isPremium?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [sets, setSets] = React.useState<WorkoutSet[]>(initialSets);
  const [started, setStarted] = React.useState(false);
  const [exIndex, setExIndex] = React.useState(0);
  const [draft, setDraft] = React.useState<SetDraft>({ reps: "", weight: "", rir: null, rpe: null });
  const [busy, setBusy] = React.useState(false);
  const [restSeconds, setRestSeconds] = React.useState<number | null>(null);
  const [pr, setPr] = React.useState<string | null>(null);
  const [prCount, setPrCount] = React.useState(0);
  const [finished, setFinished] = React.useState(workout.status === "completed");

  const voice = useVoiceCoach({ premium: isPremium });
  useWakeLock(started && !finished);

  // Antrenman süresi: ilk tamamlanan setten itibaren.
  const startedAt = React.useRef<number | null>(
    initialSets.find((s) => s.completed)?.created_at
      ? new Date(initialSets.find((s) => s.completed)!.created_at).getTime()
      : null
  );

  // Kaldığı egzersizi geri yükle.
  React.useEffect(() => {
    const saved = Number(localStorage.getItem(LS_KEY(workout.id)));
    if (Number.isFinite(saved) && saved > 0 && saved < exercises.length) setExIndex(saved);
  }, [workout.id, exercises.length]);

  React.useEffect(() => {
    if (started) localStorage.setItem(LS_KEY(workout.id), String(exIndex));
  }, [exIndex, started, workout.id]);

  // CANLI XP — veritabanının kullandığı formülün aynısı (bkz. projection.ts).
  // Gösterilen sayı, antrenman bitince gerçekten yatan sayıdır.
  const xp = React.useMemo(() => {
    const totals = computeTotals(sets as unknown as Parameters<typeof computeTotals>[0], exercises);
    return projectWorkoutXp({
      workoutVolume: totals.totalVolume,
      priorVolume,
      newPrCount: prCount,
      hasCompletedSet: totals.totalSets > 0,
      rules: xpRules,
    });
  }, [sets, exercises, priorVolume, prCount, xpRules]);

  const aktifEx = exercises[exIndex];
  const exSets = React.useMemo(
    () => sets.filter((s) => s.exercise_id === aktifEx?.id).sort((a, b) => a.set_order - b.set_order),
    [sets, aktifEx?.id]
  );
  const aktifSetIdx = Math.max(0, exSets.findIndex((s) => !s.completed));

  async function completeSet() {
    if (!aktifEx || busy) return;
    setBusy(true);
    const reps = draft.reps ? parseInt(draft.reps, 10) : null;
    const weight = draft.weight ? parseFloat(draft.weight) : null;
    const hedef = exSets[aktifSetIdx];

    const payload = {
      reps, weight_kg: weight, rir: draft.rir, rpe: draft.rpe,
      completed: true, rest_sec: aktifEx.restSec,
    };

    let kaydedilen: WorkoutSet | null = null;
    if (hedef && !hedef.completed) {
      // Planlı set VAR → güncelle. Yeni satır açmak planı bozar ve
      // "3 set planlandı" bilgisi anlamsızlaşırdı.
      const { data } = await supabase.from("workout_sets").update(payload).eq("id", hedef.id).select("*").single();
      kaydedilen = (data as WorkoutSet) ?? null;
      if (kaydedilen) setSets((prev) => prev.map((s) => (s.id === kaydedilen!.id ? kaydedilen! : s)));
    } else {
      // Plan dışı ek set.
      const { data } = await supabase.from("workout_sets").insert({
        workout_id: workout.id,
        exercise_id: aktifEx.id,
        exercise_name: aktifEx.name,   // TÜRKÇE iç isim — geçmiş kayıt tutarlılığı
        set_order: exSets.length + 1,
        target_reps: aktifEx.suggestion.reps,
        ...payload,
      }).select("*").single();
      kaydedilen = (data as WorkoutSet) ?? null;
      if (kaydedilen) setSets((prev) => [...prev, kaydedilen!]);
    }

    startedAt.current ??= Date.now();
    setDraft({ reps: "", weight: "", rir: null, rpe: null });
    voice.speak(VOICE_LINES.setLogged(hedef?.set_order ?? exSets.length + 1, displayName(aktifEx)));
    void trackWorkoutEvent({ event: "set_completed", workoutId: workout.id, exerciseId: aktifEx.id,
      payload: { reps, weight, rir: draft.rir, rpe: draft.rpe, set_order: hedef?.set_order ?? null } });
    void trackWorkoutEvent({ event: "rest_started", workoutId: workout.id, exerciseId: aktifEx.id,
      payload: { seconds: aktifEx.restSec } });
    setRestSeconds(aktifEx.restSec);
    if (weight && reps) void checkPR(aktifEx, weight, reps);
    setBusy(false);
  }

  async function checkPR(ex: EngineExercise, w: number, r: number) {
    const e1rm = estimate1RM(w, r);
    if (e1rm <= 0) return;
    const { data: mevcut } = await supabase
      .from("personal_records").select("id, est_1rm")
      .eq("user_id", workout.user_id).eq("exercise_name", ex.name).maybeSingle();

    if (!mevcut || e1rm > Number(mevcut.est_1rm)) {
      await supabase.from("personal_records").upsert({
        user_id: workout.user_id, exercise_id: ex.id,
        exercise_name: ex.name,             // iç anahtar korunur
        best_weight: w, best_reps: r, est_1rm: e1rm,
        achieved_on: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,exercise_name" });
      const ad = displayName(ex);
      setPrCount((c) => c + 1);
      void trackWorkoutEvent({ event: "pr_achieved", workoutId: workout.id, exerciseId: ex.id,
        payload: { weight: w, reps: r, est_1rm: e1rm } });
      setPr(`${ad} · ${w} kg × ${r}`);
      voice.speak(VOICE_LINES.prHit(ad), { interrupt: true });
      setTimeout(() => setPr(null), 6000);
    }
  }

  async function finishWorkout() {
    setFinished(true);
    const minutes = startedAt.current
      ? Math.max(1, Math.round((Date.now() - startedAt.current) / 60000)) : null;
    await supabase.from("workouts").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      ...(minutes ? { duration_min: minutes } : {}),
    }).eq("id", workout.id);
    localStorage.removeItem(LS_KEY(workout.id));
    void trackWorkoutEvent({ event: "workout_completed", workoutId: workout.id,
      payload: { minutes, xp: xp.total, prs: prCount } });
    if (minutes) voice.speak(VOICE_LINES.workoutDone(minutes), { interrupt: true });
    await syncMyGamification();
    router.refresh();
  }

  // --- Özet ekranı ---------------------------------------------------------
  if (!started && !finished) {
    return (
      <WorkoutOverview
        title={workout.title}
        overview={overview}
        exercises={exercises}
        onStart={() => {
          setStarted(true);
          void trackWorkoutEvent({ event: "workout_started", workoutId: workout.id,
            payload: { planned_sets: overview.totalSets, exercises: overview.exerciseCount } });
        }}
      />
    );
  }

  if (finished) {
    return (
      <div className="card flex items-center gap-3 border-brand/30 bg-brand/5">
        <Trophy className="shrink-0 text-brand" size={22} />
        <p className="text-sm font-medium">Bu antrenman tamamlandı. Harika iş çıkardın! 🎉</p>
      </div>
    );
  }

  if (!aktifEx) {
    return <p className="py-8 text-center text-sm text-fg-muted">Bu antrenmanda egzersiz yok.</p>;
  }

  const tumSetlerBitti = sets.length > 0 && sets.every((s) => s.completed);

  return (
    <div className="space-y-4">
      {pr && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3"
        >
          <Trophy size={20} className="shrink-0 text-brand" />
          <p className="text-sm font-semibold">🎉 Yeni rekor! <span className="text-brand">{pr}</span></p>
        </motion.div>
      )}

      {voice.ready && (
        <VoiceToggle
          enabled={voice.enabled} provider={voice.provider} isPremium={isPremium}
          onToggle={voice.toggle} onProvider={voice.setProvider}
        />
      )}

      {/* CANLI XP — set tamamladıkça artar. Gösterilen sayı, bitişte
          gerçekten yatan sayının aynısı (aynı formül, bkz. projection.ts). */}
      {xp.total > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-brand/25 bg-brand/5 px-3.5 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] text-fg-muted">Bu antrenmandan kazanacaksın</p>
            <p className="truncate text-[11px] text-fg-muted">
              {xp.parts.map((p) => `${p.label} +${p.xp}`).join(" · ")}
            </p>
          </div>
          <motion.span
            key={xp.total}
            initial={{ scale: 1.25 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="shrink-0 text-lg font-black text-brand"
          >
            +{xp.total} XP
          </motion.span>
        </div>
      )}

      {/* Egzersizler arası gezinme */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExIndex((i) => Math.max(0, i - 1))}
          disabled={exIndex === 0}
          className="btn-ghost h-9 px-2.5 text-sm disabled:opacity-40"
          aria-label="Önceki hareket"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-medium text-fg-muted">
          {exIndex + 1} / {exercises.length}
        </span>
        <button
          onClick={() => setExIndex((i) => Math.min(exercises.length - 1, i + 1))}
          disabled={exIndex === exercises.length - 1}
          className="btn-ghost h-9 px-2.5 text-sm disabled:opacity-40"
          aria-label="Sonraki hareket"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* MOBİL: video üstte, set takibi altta · DESKTOP: yan yana */}
      <AnimatePresence mode="wait">
        <motion.div
          key={aktifEx.id}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
          className="grid gap-4 lg:grid-cols-2 lg:items-start"
        >
          <ExerciseMediaPanel exercise={aktifEx} />
          <SetTracker
            exercise={aktifEx}
            sets={exSets}
            activeIndex={aktifSetIdx}
            draft={draft}
            onDraft={setDraft}
            onComplete={completeSet}
            busy={busy}
          />
        </motion.div>
      </AnimatePresence>

      {(tumSetlerBitti || sets.some((s) => s.completed)) && (
        <button onClick={finishWorkout} className="btn-primary w-full">
          <Flag size={18} /> Antrenmanı Tamamla
        </button>
      )}

      {restSeconds !== null && (
        <RestTimer
          key={`${aktifEx.id}-${sets.filter((s) => s.completed).length}`}
          seconds={restSeconds}
          onClose={() => {
            void trackWorkoutEvent({ event: "rest_skipped", workoutId: workout.id, exerciseId: aktifEx.id });
            setRestSeconds(null);
          }}
          onSpeak={voice.speak}
        />
      )}
    </div>
  );
}
