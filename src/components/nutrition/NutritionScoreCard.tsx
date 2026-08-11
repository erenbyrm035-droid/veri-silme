"use client";

import * as React from "react";
import { RefreshCw, Salad } from "lucide-react";
import { refreshNutritionScore } from "@/lib/nutrition/dietitian-actions";

const FACTOR_LABELS: Record<string, string> = {
  protein: "Protein", calorie: "Kalori", macros: "Makro Dengesi", water: "Su",
  variety: "Besin Çeşitliliği", regularity: "Öğün Düzeni", processed: "İşlenmemiş Gıda",
};

function color(v: number) { return v >= 70 ? "#34D399" : v >= 45 ? "#FBBF24" : "#FB7185"; }

export function NutritionScoreCard({
  initialScore, initialComment, initialBreakdown,
}: {
  initialScore: number; initialComment: string; initialBreakdown: Record<string, number>;
}) {
  const [score, setScore] = React.useState(initialScore);
  const [comment, setComment] = React.useState(initialComment);
  const [breakdown, setBreakdown] = React.useState(initialBreakdown);
  const [pending, start] = React.useTransition();

  function refresh() {
    start(async () => {
      const res = await refreshNutritionScore();
      if (res.ok && res.data) { setScore(res.data.score); setComment(res.data.comment); setBreakdown(res.data.breakdown); }
    });
  }

  const sw = 12, size = 132, r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-border bg-ink-card p-5">
        <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-ink-soft" strokeWidth={sw} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color(score)} strokeWidth={sw} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c - (score / 100) * c} style={{ transition: "stroke-dashoffset .8s ease" }} />
          </svg>
          <div className="absolute grid place-items-center text-center">
            <span className="text-3xl font-bold" style={{ color: color(score) }}>{score}</span>
            <span className="text-[11px] uppercase tracking-wide text-fg-muted">Nutrition Score</span>
          </div>
        </div>
        <p className="flex items-start gap-2 text-center text-sm text-fg-muted">
          <Salad size={16} className="mt-0.5 shrink-0 text-brand" /> {comment}
        </p>
        <button onClick={refresh} disabled={pending} className="inline-flex items-center gap-1.5 rounded-xl bg-ink-soft px-3 py-2 text-sm font-semibold text-fg disabled:opacity-50">
          <RefreshCw size={14} className={pending ? "animate-spin" : ""} /> Yenile
        </button>
      </div>

      <div className="rounded-2xl border border-ink-border bg-ink-card p-4">
        <h3 className="mb-3 text-sm font-semibold">Bileşen Analizi</h3>
        <div className="space-y-2">
          {Object.entries(breakdown).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-32 shrink-0 text-xs text-fg-muted">{FACTOR_LABELS[k] ?? k}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-soft">
                <div className="h-full rounded-full" style={{ width: `${v}%`, background: color(v) }} />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-semibold">{v}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-fg-muted">Skor günlük öğün, su ve besin çeşitliliği verilerinden hesaplanır. Fitness Score ile birlikte AI koçun genel değerlendirmesine katkı sağlar.</p>
      </div>
    </div>
  );
}
