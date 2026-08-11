"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncMyGamification } from "@/lib/gamification/actions";
import type { Exercise, WorkoutSet, Workout } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import { RestTimer } from "@/components/workout/RestTimer";
import { VoiceToggle } from "@/components/workout/VoiceToggle";
import { useVoiceCoach, useWakeLock } from "@/lib/voice/useVoiceCoach";
import { VOICE_LINES } from "@/lib/voice/provider";
import { Plus, Check, Trophy, Trash2, Timer } from "lucide-react";

/** Epley formülü ile tahmini 1RM. */
function estimate1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function WorkoutSession({
  workout,
  exercises,
  initialSets,
  isPremium = false,
}: {
  workout: Workout;
  exercises: Exercise[];
  initialSets: WorkoutSet[];
  /** ElevenLabs sesi yalnızca Premium'da; free kullanıcı Web Speech ile duyar. */
  isPremium?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [sets, setSets] = useState<WorkoutSet[]>(initialSets);
  const [selectedExercise, setSelectedExercise] = useState<string>(
    exercises[0]?.id ?? ""
  );
  const [reps, setReps] = useState("10");
  const [weight, setWeight] = useState("");
  const [completed, setCompleted] = useState(workout.status === "completed");
  const [restSeconds, setRestSeconds] = useState<number | null>(null);
  const [prExercise, setPrExercise] = useState<string | null>(null);

  const voice = useVoiceCoach({ premium: isPremium });
  // Antrenman sürerken ekran kapanmasın (set aralarında telefona dokunmadan).
  useWakeLock(!completed);

  // Antrenman süresi: ilk set eklendiğinde başlar, bitişte `duration_min` olarak
  // yazılır. Daha önce bu alan hiç doldurulmuyordu; haftalık rapor ve takım
  // istatistiklerindeki "toplam dakika" bu yüzden hep 0 görünüyordu.
  const startedAt = useRef<number | null>(
    initialSets.length > 0 ? new Date(initialSets[0].created_at).getTime() : null
  );

  const groupedByExercise = sets.reduce<Record<string, WorkoutSet[]>>((acc, s) => {
    (acc[s.exercise_name] ||= []).push(s);
    return acc;
  }, {});

  async function addSet() {
    const ex = exercises.find((e) => e.id === selectedExercise);
    if (!ex) return;
    const order =
      (groupedByExercise[ex.name]?.length ?? 0) + 1;

    const { data, error } = await supabase
      .from("workout_sets")
      .insert({
        workout_id: workout.id,
        exercise_id: ex.id,
        exercise_name: ex.name,
        set_order: order,
        reps: reps ? parseInt(reps, 10) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        completed: true,
      })
      .select("*")
      .single();

    if (!error && data) {
      startedAt.current ??= Date.now(); // ilk set → süre sayacı başlar
      setSets((s) => [...s, data as WorkoutSet]);
      voice.speak(VOICE_LINES.setLogged(order, ex.name));
      // Dinlenme sayacını başlat (egzersiz önerisi ya da 90 sn)
      setRestSeconds(ex.rec_rest_sec ?? 90);
      // PR kontrolü (ağırlık girildiyse)
      if (weight) {
        void checkPR(ex, parseFloat(weight), reps ? parseInt(reps, 10) : 1);
      }
    }
  }

  async function checkPR(ex: Exercise, w: number, r: number) {
    if (!w || w <= 0) return;
    const e1rm = estimate1RM(w, r);
    const { data: existing } = await supabase
      .from("personal_records")
      .select("id, est_1rm")
      .eq("user_id", workout.user_id)
      .eq("exercise_name", ex.name)
      .maybeSingle();

    if (!existing || e1rm > Number(existing.est_1rm)) {
      await supabase.from("personal_records").upsert(
        {
          user_id: workout.user_id,
          exercise_id: ex.id,
          exercise_name: ex.name,
          best_weight: w,
          best_reps: r,
          est_1rm: e1rm,
          achieved_on: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,exercise_name" }
      );
      setPrExercise(ex.name);
      voice.speak(VOICE_LINES.prHit(ex.name), { interrupt: true });
      setTimeout(() => setPrExercise((p) => (p === ex.name ? null : p)), 5000);
    }
  }

  async function toggleSet(set: WorkoutSet) {
    const next = !set.completed;
    setSets((s) =>
      s.map((x) => (x.id === set.id ? { ...x, completed: next } : x))
    );
    await supabase
      .from("workout_sets")
      .update({ completed: next })
      .eq("id", set.id);
  }

  async function deleteSet(id: string) {
    setSets((s) => s.filter((x) => x.id !== id));
    await supabase.from("workout_sets").delete().eq("id", id);
  }

  async function finishWorkout() {
    setCompleted(true);
    const minutes = startedAt.current
      ? Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
      : null;
    await supabase
      .from("workouts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ...(minutes ? { duration_min: minutes } : {}),
      })
      .eq("id", workout.id);
    if (minutes) voice.speak(VOICE_LINES.workoutDone(minutes), { interrupt: true });
    await syncMyGamification(); // XP/başarım/streak güncelle
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Yeni PR bildirimi */}
      {prExercise && (
        <div className="flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 animate-fade-up">
          <Trophy size={20} className="text-brand" />
          <p className="text-sm font-semibold">
            🎉 Yeni rekor! <span className="text-brand">{prExercise}</span>
          </p>
        </div>
      )}

      {/* Sesli koç */}
      {!completed && voice.ready && (
        <VoiceToggle
          enabled={voice.enabled}
          provider={voice.provider}
          isPremium={isPremium}
          onToggle={voice.toggle}
          onProvider={voice.setProvider}
        />
      )}

      {/* Set ekleme */}
      {!completed && (
        <div className="card space-y-4">
          <h2 className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-fg-muted">
            <span>Set Ekle</span>
            {restSeconds === null && (
              <span className="inline-flex items-center gap-1 text-xs normal-case text-fg-muted/70">
                <Timer size={13} /> set sonrası dinlenme başlar
              </span>
            )}
          </h2>
          <div>
            <label className="label">Egzersiz</label>
            <select
              className="input"
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
            >
              {exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.muscle_group}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tekrar</label>
              <input
                type="number"
                className="input"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                placeholder="10"
              />
            </div>
            <div>
              <label className="label">Ağırlık (kg)</label>
              <input
                type="number"
                className="input"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>
          </div>
          <button onClick={addSet} className="btn-primary w-full">
            <Plus size={18} /> Seti Kaydet
          </button>
        </div>
      )}

      {/* Kaydedilen setler */}
      {Object.keys(groupedByExercise).length === 0 ? (
        <p className="py-8 text-center text-sm text-fg-muted">
          Henüz set eklenmedi.
        </p>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByExercise).map(([name, exSets]) => (
            <div key={name} className="card">
              <h3 className="mb-3 font-semibold">{name}</h3>
              <div className="space-y-2">
                {exSets.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl bg-ink-soft px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-fg/5 text-xs font-semibold text-fg-muted">
                        {s.set_order}
                      </span>
                      <span className="text-sm">
                        {s.reps ?? "—"} tekrar
                        {s.weight_kg ? ` × ${s.weight_kg} kg` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!completed && (
                        <>
                          <button
                            onClick={() => toggleSet(s)}
                            className={cn(
                              "grid h-8 w-8 place-items-center rounded-lg transition-colors",
                              s.completed
                                ? "bg-brand text-black"
                                : "bg-fg/5 text-fg-muted hover:text-fg"
                            )}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => deleteSet(s.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-fg/5 text-fg-muted transition-colors hover:text-red-400"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                      {completed && s.completed && (
                        <Check size={16} className="text-brand" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bitir */}
      {!completed && sets.length > 0 && (
        <button onClick={finishWorkout} className="btn-primary w-full">
          <Trophy size={18} /> Antrenmanı Tamamla
        </button>
      )}

      {completed && (
        <div className="card flex items-center gap-3 border-brand/30 bg-brand/5">
          <Trophy className="text-brand" size={22} />
          <p className="text-sm font-medium">
            Bu antrenman tamamlandı. Harika iş çıkardın! 🎉
          </p>
        </div>
      )}

      {/* Dinlenme sayacı */}
      {restSeconds !== null && (
        <RestTimer
          key={sets.length}
          seconds={restSeconds}
          onClose={() => setRestSeconds(null)}
          onSpeak={voice.speak}
        />
      )}
    </div>
  );
}
