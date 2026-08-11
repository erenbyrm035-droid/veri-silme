import Link from "next/link";
import { Target } from "lucide-react";
import type { GoalProgress } from "@/lib/ai/agent/types";

// ============================================================================
// Hedef takibi — kullanıcının koyduğu hedeflerin canlı ilerlemesi.
//
// İki çubuk üst üste gösteriliyor ve bu bilinçli:
//   İLERLEME → hedefe ne kadar yaklaştın
//   SÜRE     → hedef tarihine ne kadar kaldı
//
// Sapmayı görünür kılan şey bu ikisinin FARKI. "%40 ilerledin" tek başına iyi
// mi kötü mü belli değil; sürenin %80'i geçtiyse kötü, %20'si geçtiyse çok iyi.
// Tek çubuk gösteren tasarımlar bu bilgiyi gizler.
//
// `on_track` hesabı veritabanında (`goal_progress` RPC), %10 tolerans ile.
// ============================================================================

const METRIC_UNIT: Record<string, string> = {
  weight: "kg",
  body_fat: "%",
  workouts_per_week: "antrenman",
  protein_daily: "g",
  steps_daily: "adım",
  water_daily: "ml",
  volume_weekly: "kg",
  streak: "gün",
};

const fmt = (v: number | null, metric: string): string =>
  v === null ? "?" : `${Number(v) % 1 === 0 ? v : Number(v).toFixed(1)} ${METRIC_UNIT[metric] ?? ""}`.trim();

export function GoalTracker({ goals }: { goals: GoalProgress[] }) {
  if (goals.length === 0) return null;

  return (
    <section className="animate-fade-up rounded-2xl border border-ink-border bg-ink-card p-4">
      <div className="flex items-center gap-2">
        <Target size={16} className="text-brand" />
        <h2 className="text-sm font-bold">Hedeflerin</h2>
        <Link href="/coach" className="ml-auto text-xs font-semibold text-brand">
          Koça sor →
        </Link>
      </div>

      <div className="mt-3 space-y-4">
        {goals.map((g) => {
          const progress = g.progress_pct ?? 0;
          const time = g.time_pct ?? 0;
          return (
            <div key={g.id}>
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-semibold">{g.title}</p>
                <span
                  className={
                    g.on_track
                      ? "shrink-0 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400"
                      : "shrink-0 text-[11px] font-semibold text-amber-600 dark:text-amber-400"
                  }
                >
                  {g.on_track ? "yolunda" : "geride"}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-fg-muted">
                {fmt(g.current_value, g.metric)} → {fmt(g.target_value, g.metric)}
                {g.days_left !== null && ` · ${g.days_left} gün kaldı`}
              </p>

              {/* İlerleme */}
              <div className="mt-2 flex items-center gap-2">
                <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-fg-muted">İlerleme</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-soft">
                  <div
                    className={g.on_track ? "h-full rounded-full bg-brand" : "h-full rounded-full bg-amber-500"}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                  %{Math.round(progress)}
                </span>
              </div>

              {/* Süre — hedefte tarih varsa anlamlı */}
              {g.time_pct !== null && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-fg-muted">Süre</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-soft">
                    <div
                      className="h-full rounded-full bg-fg-muted/40"
                      style={{ width: `${Math.min(100, Math.max(0, time))}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-fg-muted">
                    %{Math.round(time)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
