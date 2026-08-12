"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, History, Lightbulb, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EngineExercise } from "@/lib/workout/session-data";
import type { WorkoutSet } from "@/lib/database.types";

// ============================================================================
// Tek bir setin takibi.
//
// RIR ve RPE İSTEĞE BAĞLI: zorunlu tutulsa kullanıcı her sette iki alan daha
// doldurmak zorunda kalır ve akış bozulur. Boş bırakılabilir; progressive
// overload motoru RIR yoksa yalnızca tekrar/ağırlık üzerinden karar verir.
// ============================================================================

export interface SetDraft {
  reps: string;
  weight: string;
  rir: number | null;
  rpe: number | null;
}

export function SetTracker({
  exercise,
  sets,
  activeIndex,
  draft,
  onDraft,
  onComplete,
  onSkip,
  busy,
}: {
  exercise: EngineExercise;
  /** Bu egzersize ait setler, sıraya göre. */
  sets: WorkoutSet[];
  /** Şu an doldurulan setin dizindeki yeri. */
  activeIndex: number;
  draft: SetDraft;
  onDraft: (d: SetDraft) => void;
  onComplete: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const aktif = sets[activeIndex];
  const setNo = aktif?.set_order ?? sets.length + 1;
  const hedef = aktif?.target_reps ?? exercise.suggestion.reps;
  const prev = exercise.previous;

  return (
    <div className="space-y-3">
      {/* Set ilerlemesi */}
      <div className="flex flex-wrap gap-1.5">
        {sets.map((s, i) => (
          <span
            key={s.id}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition-colors",
              s.completed ? "bg-brand text-black"
                : i === activeIndex ? "bg-fg/15 text-fg ring-2 ring-brand"
                : "bg-ink-soft text-fg-muted"
            )}
          >
            {s.completed ? <Check size={14} /> : s.set_order}
          </span>
        ))}
      </div>

      {/* Öneri + geçen sefer */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
            <Lightbulb size={13} /> Bugünkü öneri
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">{exercise.suggestion.reason}</p>
        </div>
        <div className="rounded-xl border border-ink-border bg-ink-soft px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted">
            <History size={13} /> Geçen sefer
          </p>
          <p className="mt-0.5 text-xs text-fg-muted">
            {prev
              ? prev.sets.map((s) => `${s.weight_kg ? `${s.weight_kg}kg × ` : ""}${s.reps}`).join(" · ")
              : "Bu hareketi ilk kez yapıyorsun."}
          </p>
        </div>
      </div>

      {/* Giriş alanları */}
      <div className="card space-y-3">
        <p className="text-sm font-semibold">
          Set {setNo}
          {hedef ? <span className="ml-1.5 font-normal text-fg-muted">· hedef {hedef} tekrar</span> : null}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Tekrar</span>
            <input
              type="number" inputMode="numeric" className="input text-lg font-semibold"
              value={draft.reps} placeholder={String(hedef ?? "")}
              onChange={(e) => onDraft({ ...draft, reps: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="label">Ağırlık (kg)</span>
            <input
              type="number" inputMode="decimal" step="0.5" className="input text-lg font-semibold"
              value={draft.weight}
              placeholder={exercise.suggestion.weightKg ? String(exercise.suggestion.weightKg) : "—"}
              onChange={(e) => onDraft({ ...draft, weight: e.target.value })}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Scale
            label="RIR" hint="kaç tekrar daha yapabilirdin"
            values={[0, 1, 2, 3, 4]} value={draft.rir}
            onChange={(v) => onDraft({ ...draft, rir: v })}
          />
          <Scale
            label="RPE" hint="zorluk (6-10)"
            values={[6, 7, 8, 9, 10]} value={draft.rpe}
            onChange={(v) => onDraft({ ...draft, rpe: v })}
          />
        </div>

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onComplete}
            disabled={busy || !draft.reps}
            className="btn-primary h-14 flex-1 text-base disabled:opacity-50"
          >
            <Check size={20} /> Seti Tamamla
          </motion.button>
          {/* Atlama seti SİLMEZ, tamamlanmamış bırakır — kullanıcı geri
              dönüp doldurabilir, plan bilgisi de korunur. */}
          <button
            onClick={onSkip}
            disabled={busy}
            className="btn-ghost h-14 px-4 text-sm disabled:opacity-50"
            aria-label="Bu seti atla"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** RIR/RPE için dokunmatik dostu ölçek — klavye açmadan seçilir. */
function Scale({
  label, hint, values, value, onChange,
}: {
  label: string; hint: string; values: number[];
  value: number | null; onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <span className="label" title={hint}>{label}</span>
      <div className="flex gap-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            // Aynı değere tekrar basmak seçimi kaldırır — alan isteğe bağlı.
            onClick={() => onChange(value === v ? null : v)}
            className={cn(
              "h-10 flex-1 rounded-lg text-sm font-semibold transition-colors",
              value === v ? "bg-brand text-black" : "bg-ink-soft text-fg-muted hover:text-fg"
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
