"use client";

import { motion } from "framer-motion";
import * as React from "react";
import { Play, RotateCcw, Clock, Flame, Dumbbell, Layers, Target, TrendingUp, Users, Loader2 } from "lucide-react";
import { startFriendParty } from "@/lib/social/actions";
import { displayName } from "@/lib/exercises/display";
import { DIFFICULTY_LABELS } from "@/lib/constants";
import type { WorkoutOverview as Overview } from "@/lib/workout/engine";
import type { EngineExercise } from "@/lib/workout/session-data";

// ============================================================================
// Antrenman ÖNCESİ özet — kullanıcı neye gireceğini bilerek başlasın.
// Tüm rakamlar planlı setlerden hesaplanır (lib/workout/engine.ts), sabit
// değer yok.
// ============================================================================

export function WorkoutOverview({
  title,
  overview,
  exercises,
  onStart,
}: {
  title: string;
  overview: Overview;
  exercises: EngineExercise[];
  onStart: () => void;
}) {
  const devam = overview.started;
  const kalan = overview.totalSets - overview.completedSets;

  // PARTİ BAŞLATMA BURADA, özet ekranında — antrenmana BAŞLARKEN anlamlı.
  // Bitirdikten sonra parti açmak anlamsız olurdu; oradaki seçenek
  // "arkadaşlarına KATIL" (bkz. JoinParty).
  const [partiBusy, setPartiBusy] = React.useState(false);
  const [partiHata, setPartiHata] = React.useState<string | null>(null);
  const [partiAcik, setPartiAcik] = React.useState(false);

  async function partiBaslat() {
    setPartiBusy(true);
    setPartiHata(null);
    const res = await startFriendParty({ title, activity: "strength" });
    setPartiBusy(false);
    if (res.ok) setPartiAcik(true);
    else setPartiHata(res.error ?? "Parti başlatılamadı.");
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {devam && (
              <p className="mt-0.5 text-sm text-brand">
                {overview.completedSets}/{overview.totalSets} set tamamlandı · {kalan} set kaldı
              </p>
            )}
          </div>
          {overview.difficulty && (
            <span className="shrink-0 rounded-full bg-fg/10 px-2.5 py-0.5 text-xs font-medium text-fg-muted">
              {DIFFICULTY_LABELS[overview.difficulty as keyof typeof DIFFICULTY_LABELS] ?? overview.difficulty}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat icon={<Clock size={15} />} label="Süre" value={`~${overview.estimatedMinutes} dk`} />
          <Stat icon={<Dumbbell size={15} />} label="Hareket" value={String(overview.exerciseCount)} />
          <Stat icon={<Layers size={15} />} label="Set" value={String(overview.totalSets)} />
          <Stat icon={<Flame size={15} />} label="Kalori" value={`~${overview.estimatedCalories}`} />
        </div>

        {overview.muscleGroups.length > 0 && (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
              <Target size={13} /> Hedef kas grupları
            </p>
            <div className="flex flex-wrap gap-1.5">
              {overview.muscleGroups.map((m) => (
                <span key={m.name} className="rounded-lg bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                  {m.name} · {m.sets} set
                </span>
              ))}
            </div>
          </div>
        )}

        <button onClick={onStart} className="btn-primary w-full">
          {devam ? <RotateCcw size={18} /> : <Play size={18} />}
          {devam ? "Devam Et" : "Antrenmanı Başlat"}
        </button>

        {partiAcik ? (
          <p className="text-center text-xs text-brand">
            Parti açıldı — arkadaşların akıştan katılabilir.
          </p>
        ) : (
          <button onClick={partiBaslat} disabled={partiBusy} className="btn-ghost w-full text-sm disabled:opacity-50">
            {partiBusy ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
            Arkadaşlarınla birlikte antren
          </button>
        )}
        {partiHata && <p className="text-center text-xs text-coral">{partiHata}</p>}
      </div>

      {/* Bugünün önerileri — her egzersiz için geçmişten hesaplanmış */}
      {exercises.some((e) => e.previous) && (
        <div className="card space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp size={16} className="text-brand" /> Bugünkü öneriler
          </h3>
          <div className="space-y-2">
            {exercises.filter((e) => e.previous).map((ex, i) => (
              <motion.div
                key={ex.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.04, 0.3) }}
                className="rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5"
              >
                <p className="text-sm font-semibold">{displayName(ex)}</p>
                <p className="mt-0.5 text-xs text-fg-muted">{ex.suggestion.reason}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-fg-muted">{icon} {label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
    </div>
  );
}
