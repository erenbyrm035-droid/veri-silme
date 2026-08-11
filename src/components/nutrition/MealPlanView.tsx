"use client";

import { motion } from "framer-motion";
import { Sparkles, Loader2, Clock, Wallet, Flame } from "lucide-react";
import { MEAL_SLOT_LABELS, MEAL_SLOT_EMOJI, MEAL_SLOT_ORDER } from "@/lib/constants";
import type { MealPlan, MealSlot } from "@/lib/database.types";

/** AI öğün planını gösterir; yeni plan üretme düğmesi içerir. */
export function MealPlanView({
  plan,
  onGenerate,
  generating,
}: {
  plan: MealPlan | null;
  onGenerate: () => void;
  generating: boolean;
}) {
  const meals = plan?.plan?.meals ?? [];
  const ordered = [...meals].sort(
    (a, b) => MEAL_SLOT_ORDER.indexOf(a.slot) - MEAL_SLOT_ORDER.indexOf(b.slot)
  );

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Kişisel Öğün Planı</h2>
          {plan ? (
            <p className="mt-0.5 text-sm text-fg-muted">
              {plan.target_calories} kcal · {plan.target_protein} g protein hedefi
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-fg-muted">
              Profiline göre 6 öğünlük günlük plan oluştur.
            </p>
          )}
        </div>
        <button onClick={onGenerate} disabled={generating} className="btn-primary text-sm">
          {generating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {plan ? "Yeni Plan" : "Plan Oluştur"}
        </button>
      </div>

      {ordered.length === 0 ? (
        <div className="card py-10 text-center text-sm text-fg-muted">
          Henüz plan yok. “Plan Oluştur”a dokun.
        </div>
      ) : (
        <div className="grid gap-3">
          {ordered.map((m, i) => (
            <motion.div
              key={`${m.slot}-${i}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                    {MEAL_SLOT_EMOJI[m.slot as MealSlot]} {MEAL_SLOT_LABELS[m.slot as MealSlot]}
                  </span>
                  <h3 className="mt-0.5 font-bold">{m.title}</h3>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-xs font-semibold text-brand">
                  <Flame size={12} /> {m.calories} kcal
                </span>
              </div>
              <p className="mt-1.5 text-sm text-fg-muted">{m.recipe}</p>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <Macro label="P" value={`${m.protein_g}g`} color="bg-brand/15 text-brand" />
                <Macro label="K" value={`${m.carbs_g}g`} color="bg-sky-500/15 text-sky-300" />
                <Macro label="Y" value={`${m.fat_g}g`} color="bg-rose-500/15 text-rose-300" />
                <Macro label="Lif" value={`${m.fiber_g}g`} color="bg-emerald-500/15 text-emerald-300" />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} /> {m.prep_minutes} dk hazırlık
                </span>
                <span className="inline-flex items-center gap-1">
                  <Wallet size={12} /> ~{m.cost_tl} ₺
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function Macro({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span className={`rounded-md px-2 py-0.5 font-medium ${color}`}>
      {label}: {value}
    </span>
  );
}
