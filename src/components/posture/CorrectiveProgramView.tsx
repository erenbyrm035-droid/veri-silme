"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, Repeat, Timer, Wind } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { buildCorrectiveProgram } from "@/lib/posture/assemble";
import { DIFFICULTY_LABELS, CATEGORY_LABELS } from "@/lib/constants";
import type {
  PostureProblem,
  CorrectiveExercise,
  CorrectiveSectionType,
} from "@/lib/database.types";

const SECTION_EMOJI: Record<CorrectiveSectionType, string> = {
  mobilization: "🔄",
  activation: "⚡",
  strengthening: "💪",
  stretching: "🧘",
  cooldown: "🌬️",
};

/**
 * Postür bulgularına göre düzeltici programı gösterir.
 * Ev / Salon geçişi tek dokunuşta programı client-side yeniden hesaplar.
 */
export function CorrectiveProgramView({
  problems,
  initialEnv = "gym",
}: {
  problems: PostureProblem[];
  initialEnv?: "home" | "gym";
}) {
  const [env, setEnv] = useState<"home" | "gym">(initialEnv);
  const program = useMemo(
    () => buildCorrectiveProgram(problems, env),
    [problems, env]
  );

  if (program.sections.length === 0) {
    return (
      <div className="card text-center text-sm text-fg-muted">
        Bu analiz için düzeltici egzersiz bulunmuyor.
      </div>
    );
  }

  const totalExercises = program.sections.reduce(
    (n, s) => n + s.exercises.length,
    0
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Düzeltici Program</h2>
          <p className="mt-0.5 flex items-center gap-3 text-sm text-fg-muted">
            <span className="inline-flex items-center gap-1">
              <Clock size={14} /> ~{program.total_minutes} dk
            </span>
            <span>{totalExercises} hareket</span>
          </p>
        </div>
        <Segmented
          value={env}
          onChange={(v) => setEnv(v)}
          options={[
            { value: "home", label: "🏠 Ev" },
            { value: "gym", label: "🏋️ Salon" },
          ]}
        />
      </div>

      {/* Bölüm özeti */}
      <div className="flex flex-wrap gap-2">
        {program.sections.map((s) => (
          <span
            key={s.type}
            className="rounded-full bg-ink-soft px-3 py-1 text-xs font-medium"
          >
            {SECTION_EMOJI[s.type]} {s.exercises.length} {s.label}
          </span>
        ))}
      </div>

      {program.sections.map((section) => (
        <div key={section.type} className="space-y-3">
          <h3 className="flex items-center gap-2 pt-1 text-sm font-bold uppercase tracking-wide text-fg-muted">
            <span>{SECTION_EMOJI[section.type]}</span>
            {section.label}
            <span className="text-fg-muted/60">({section.exercises.length})</span>
          </h3>
          <div className="grid gap-3">
            {section.exercises.map((ex, i) => (
              <motion.div
                key={`${section.type}-${ex.key}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <ExerciseRow ex={ex} />
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExerciseRow({ ex }: { ex: CorrectiveExercise }) {
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold">{ex.name}</h4>
          <p className="text-xs text-fg-muted">{ex.english_name}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-md bg-ink-soft px-2 py-0.5 text-[11px] font-medium">
            {ex.equipment}
          </span>
          <span className="text-[11px] text-fg-muted">
            {DIFFICULTY_LABELS[ex.difficulty]} · {CATEGORY_LABELS[ex.category] ?? ex.category}
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm text-fg-muted">{ex.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {ex.sets != null && (
          <Meta icon={<Repeat size={13} />} label={`${ex.sets} set`} />
        )}
        {ex.reps && <Meta icon={<Repeat size={13} />} label={ex.reps} />}
        {ex.duration_sec != null && (
          <Meta icon={<Timer size={13} />} label={`${ex.duration_sec} sn`} />
        )}
        {ex.rest_sec != null && ex.rest_sec > 0 && (
          <Meta icon={<Clock size={13} />} label={`${ex.rest_sec} sn dinlenme`} />
        )}
      </div>

      {ex.breathing && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-sky-300/90">
          <Wind size={13} className="mt-0.5 shrink-0" /> {ex.breathing}
        </p>
      )}
    </div>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-fg-muted">
      {icon}
      {label}
    </span>
  );
}
