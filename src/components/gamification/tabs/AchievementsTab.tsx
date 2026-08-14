"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_STYLE, CATEGORY_LABEL } from "@/lib/gamification/constants";
import { BadgeMedal, AchievementCard } from "../primitives";
import type { BadgeTier } from "@/lib/database.types";
import type { GamificationOverview } from "@/lib/gamification/queries";

export function AchievementsTab({ overview }: { overview: GamificationOverview }) {
  const tiers: BadgeTier[] = ["bronze", "silver", "gold", "platinum", "diamond", "legend"];
  const [cat, setCat] = React.useState<string>("all");

  const categories = React.useMemo(
    () => Array.from(new Set(overview.achievements.map((a) => a.category))),
    [overview.achievements]
  );
  const completedCount = overview.achievements.filter((a) => a.completed).length;
  const totalXpFromAch = overview.achievements.filter((a) => a.completed).reduce((s, a) => s + a.xp_reward, 0);

  // Tamamlamaya en yakın (açılmamış, ilerlemesi olan) — ilk 3.
  const closest = overview.achievements
    .filter((a) => !a.completed && a.progress > 0)
    .map((a) => ({ a, pct: Math.min(100, Math.round((a.progress / Math.max(1, a.target)) * 100)) }))
    .sort((x, y) => y.pct - x.pct)
    .slice(0, 3);

  const filtered = cat === "all" ? overview.achievements : overview.achievements.filter((a) => a.category === cat);
  // Açılmamış + ilerlemesi yüksek olan üstte, tamamlananlar altta.
  const sorted = [...filtered].sort((x, y) => {
    if (x.completed !== y.completed) return x.completed ? 1 : -1;
    return (y.progress / Math.max(1, y.target)) - (x.progress / Math.max(1, x.target));
  });

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-ink-border bg-ink-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Rozet Koleksiyonu</h3>
          <span className="text-xs text-fg-muted">
            {completedCount}/{overview.achievements.length} · {totalXpFromAch.toLocaleString("tr-TR")} XP
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-5 sm:justify-start">
          {tiers.map((t) => {
            const owned = overview.achievements.some((a) => a.completed && a.badge?.tier === t);
            return <BadgeMedal key={t} tier={t} label={TIER_STYLE[t].label} locked={!owned} />;
          })}
        </div>
      </section>

      {closest.length > 0 && (
        <section className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Target size={16} className="text-brand" /> Tamamlamaya En Yakın
          </h3>
          <div className="space-y-3">
            {closest.map(({ a, pct }) => (
              <div key={a.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-fg-muted">{a.progress}/{a.target} · %{pct}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-soft">
                  <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterChip active={cat === "all"} onClick={() => setCat("all")} label="Tümü" />
        {categories.map((c) => (
          <FilterChip key={c} active={cat === c} onClick={() => setCat(c)} label={CATEGORY_LABEL[c] ?? c} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sorted.map((a) => <AchievementCard key={a.id} a={a} />)}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? "bg-brand text-black" : "bg-ink-soft text-fg-muted hover:text-fg"
      )}
    >
      {label}
    </button>
  );
}

// --- Leaderboard -------------------------------------------------------------

/** Apple/Linear tarzı kayan göstergeli segmented control. */
