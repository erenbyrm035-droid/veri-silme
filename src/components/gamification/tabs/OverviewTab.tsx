"use client";

import type { GamificationClientProps } from "../GamificationClient";

import { motion } from "framer-motion";
import { Zap, Award, Flame, Dumbbell, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeature } from "@/lib/premium/context";
import { PremiumGate } from "@/components/premium/PremiumGate";
import { fitnessLabel, RECOVERY_META } from "@/lib/gamification/constants";
import { Gauge, BadgeMedal } from "../primitives";
import type { Level, BadgeTier } from "@/lib/database.types";
import type { GamificationOverview, HeatmapEntry } from "@/lib/gamification/queries";

export function OverviewTab(props: GamificationClientProps) {
  const { overview, recovery, heatmap } = props;
  const fit = fitnessLabel(overview.stats.fitness_score);
  const rec = RECOVERY_META[recovery.status];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center rounded-2xl border border-ink-border bg-ink-card p-5">
          <Gauge value={overview.stats.fitness_score} color={fit.color} label="Fitness" sub={fit.label} />
          <p className="mt-2 text-center text-xs text-fg-muted">Antrenman, beslenme, su, postür ve AI uyumundan hesaplanır. Günlük güncellenir.</p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-ink-border bg-ink-card p-5">
          <Gauge value={recovery.score} color={rec.color} label="Recovery" sub={rec.label} />
          <p className="mt-2 text-center text-xs text-fg-muted">{rec.note}</p>
        </div>
      </div>

      <StatGrid overview={overview} />

      {overview.recentUnlocks.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-fg-muted">Son Kazanılan Rozetler</h3>
          <div className="flex flex-wrap gap-4 rounded-2xl border border-ink-border bg-ink-card p-4">
            {overview.recentUnlocks.map((a) => (
              <BadgeMedal key={a.id} tier={(a.badge?.tier ?? "bronze") as BadgeTier} label={a.name} />
            ))}
          </div>
        </section>
      )}

      {/* Kas ısı haritası = `advanced_analytics` kapsamındaki "kas dengesi".
          Seviye, rozet ve toparlanma göstergesi açık kalıyor; kapı yalnızca
          bu ayrıntılı dağılımda. */}
      <MuscleHeatmap heatmap={heatmap} />
      <LevelLadder levels={overview.levels} current={overview.stats.level} totalXp={overview.stats.total_xp} />
    </div>
  );
}

function StatGrid({ overview }: { overview: GamificationOverview }) {
  const items = [
    { icon: Zap, label: "Toplam XP", value: overview.stats.total_xp.toLocaleString("tr-TR"), color: "#A3E635" },
    { icon: CalendarDays, label: "Bu Hafta XP", value: `+${overview.weeklyXp.toLocaleString("tr-TR")}`, color: "#38BDF8" },
    { icon: Flame, label: "En Uzun Seri", value: `${overview.stats.longest_streak}g`, color: "#FB7185" },
    { icon: Award, label: "Başarım", value: `${overview.achievements.filter((a) => a.completed).length}/${overview.achievements.length}`, color: "#FBBF24" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <motion.div key={it.label} whileHover={{ y: -3 }} className="rounded-2xl border border-ink-border bg-ink-card p-4">
          <it.icon size={18} style={{ color: it.color }} />
          <p className="mt-2 text-xl font-bold tracking-tight">{it.value}</p>
          <p className="text-xs text-fg-muted">{it.label}</p>
        </motion.div>
      ))}
    </div>
  );
}

function MuscleHeatmap({ heatmap }: { heatmap: HeatmapEntry[] }) {
  // Kapı bileşenin İÇİNDE: kartın başlığı ve çerçevesi görünsün, kilit
  // yalnızca verinin üstünde olsun. Böylece ücretsiz kullanıcı neyi
  // kaçırdığını görüyor, boş bir yer değil.
  const unlocked = useFeature("advanced_analytics");
  if (heatmap.length === 0) return null;
  const max = Math.max(...heatmap.map((h) => h.sets), 1);
  const most = heatmap.slice(0, 3);
  const least = [...heatmap].reverse().slice(0, 3);
  return (
    <section className="rounded-2xl border border-ink-border bg-ink-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Dumbbell size={16} className="text-brand" />
        <h3 className="text-sm font-semibold">Kas Isı Haritası <span className="text-fg-muted">· son 30 gün</span></h3>
      </div>
      <PremiumGate feature="advanced_analytics"
        description="Kas grubu dağılımı ve denge analizi Premium'a özeldir.">
      <div className="space-y-1.5">
        {heatmap.slice(0, 10).map((h) => {
          const pct = (h.sets / max) * 100;
          const hue = 12 + (1 - h.sets / max) * 40; // kırmızı→sarı
          return (
            <div key={h.muscle_id} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-fg-muted">{h.name}</span>
              <div className="h-4 flex-1 overflow-hidden rounded-md bg-ink-soft">
                <motion.div className="h-full rounded-md" style={{ background: `hsl(${hue} 90% 55%)` }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-semibold">{h.sets}</span>
            </div>
          );
        })}
      </div>
      {unlocked && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div><span className="font-semibold text-emerald-400">En çok:</span> <span className="text-fg-muted">{most.map((m) => m.name).join(", ")}</span></div>
          <div><span className="font-semibold text-coral">En az:</span> <span className="text-fg-muted">{least.map((m) => m.name).join(", ")}</span></div>
        </div>
      )}
      </PremiumGate>
    </section>
  );
}

function LevelLadder({ levels, current, totalXp }: { levels: Level[]; current: number; totalXp: number }) {
  return (
    <section className="rounded-2xl border border-ink-border bg-ink-card p-5">
      <h3 className="mb-3 text-sm font-semibold">Seviye Yolu</h3>
      <div className="flex flex-wrap gap-2">
        {levels.map((l) => {
          const reached = totalXp >= l.min_xp;
          const isCurrent = l.level === current;
          return (
            <div key={l.level} className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs",
              isCurrent ? "border-brand bg-brand/10" : reached ? "border-ink-border bg-ink-soft" : "border-ink-border opacity-50")}>
              <span className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-bold text-black" style={{ background: reached ? l.color : "#3a3a40" }}>{l.level}</span>
              <div>
                <p className="font-semibold">{l.title}</p>
                <p className="text-fg-muted">{l.min_xp.toLocaleString("tr-TR")} XP</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- Achievements ------------------------------------------------------------
