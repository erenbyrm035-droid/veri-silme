"use client";

import { motion } from "framer-motion";
import { Sparkles, Loader2, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import type { NutritionReport, NutritionReportScores } from "@/lib/database.types";

const SCORE_META: { key: keyof NutritionReportScores; label: string; color: string }[] = [
  { key: "nutrition", label: "Beslenme", color: "#e7fb00" },
  { key: "protein", label: "Protein", color: "#38bdf8" },
  { key: "calorie", label: "Kalori", color: "#fb7185" },
  { key: "water", label: "Su", color: "#22d3ee" },
  { key: "macro", label: "Makro", color: "#a78bfa" },
  { key: "training", label: "Antrenman", color: "#34d399" },
];

/** Haftalık AI beslenme raporu: skorlar + kilo değişimi + öneri. */
export function WeeklyReportView({
  report,
  onGenerate,
  generating,
}: {
  report: NutritionReport | null;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Haftalık AI Raporu</h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            Son 7 günün beslenme ve antrenman uyumu.
          </p>
        </div>
        <button onClick={onGenerate} disabled={generating} className="btn-primary text-sm">
          {generating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          Rapor Oluştur
        </button>
      </div>

      {!report ? (
        <div className="card py-10 text-center text-sm text-fg-muted">
          Henüz rapor yok. Bir haftalık veri biriktikten sonra rapor oluştur.
        </div>
      ) : (
        <>
          <div className="card">
            <div className="grid grid-cols-3 gap-4">
              {SCORE_META.map((s, i) => (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex flex-col items-center"
                >
                  <ProgressRing value={report.scores[s.key]} size={72} color={s.color}>
                    <span className="text-sm font-bold">{report.scores[s.key]}</span>
                  </ProgressRing>
                  <span className="mt-1.5 text-[11px] font-medium text-fg-muted">
                    {s.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {report.weight_change != null && (
            <div className="card flex items-center gap-3">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ${
                  report.weight_change < 0
                    ? "bg-emerald-500/15 text-emerald-400"
                    : report.weight_change > 0
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-ink-soft text-fg-muted"
                }`}
              >
                {report.weight_change < 0 ? (
                  <TrendingDown size={20} />
                ) : report.weight_change > 0 ? (
                  <TrendingUp size={20} />
                ) : (
                  <Minus size={20} />
                )}
              </span>
              <div>
                <p className="text-sm text-fg-muted">Bu haftaki kilo değişimi</p>
                <p className="text-lg font-bold">
                  {report.weight_change > 0 ? "+" : ""}
                  {report.weight_change} kg
                </p>
              </div>
            </div>
          )}

          {report.advice && (
            <div className="card flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                <Sparkles size={18} />
              </span>
              <p className="text-sm leading-relaxed">{report.advice}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
