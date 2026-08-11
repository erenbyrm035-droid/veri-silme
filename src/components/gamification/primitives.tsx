"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Lock, Check, Flame, Medal, Crown, Gem, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_STYLE, streakColor } from "@/lib/gamification/constants";
import type { BadgeTier } from "@/lib/database.types";
import type { AchievementView } from "@/lib/gamification/queries";

/** XP ilerleme çubuğu (mevcut seviye → sonraki seviye). */
export function XpBar({ value, max, color = "#A3E635" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 100;
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-soft">
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }} />
    </div>
  );
}

/** Dairesel skor göstergesi (fitness / recovery). */
export function Gauge({ value, size = 132, color = "#A3E635", label, sub }: { value: number; size?: number; color?: string; label: string; sub?: string }) {
  const sw = 12, r = (size - sw) / 2, c = 2 * Math.PI * r, clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-ink-soft" strokeWidth={sw} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={{ duration: 1.1, ease: "easeOut" }} />
      </svg>
      <div className="absolute grid place-items-center text-center">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>{Math.round(value)}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">{label}</span>
        {sub && <span className="mt-0.5 text-[11px] font-semibold" style={{ color }}>{sub}</span>}
      </div>
    </div>
  );
}

/** Seri alevi. */
export function StreakFlame({ days, size = 22 }: { days: number; size?: number }) {
  const color = streakColor(days);
  return (
    <span className="inline-flex items-center gap-1.5">
      <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
        <Flame size={size} style={{ color }} fill={days > 0 ? color : "none"} />
      </motion.span>
      <span className="font-bold" style={{ color }}>{days}</span>
    </span>
  );
}

const TIER_ICON: Record<BadgeTier, LucideIcon> = {
  bronze: Medal, silver: Medal, gold: Medal, platinum: Gem, diamond: Gem, legend: Crown,
};

/** Rozet madalyonu (animasyonlu). */
export function BadgeMedal({ tier, label, locked, size = 64 }: { tier: BadgeTier; label?: string; locked?: boolean; size?: number }) {
  const s = TIER_STYLE[tier];
  const Icon = TIER_ICON[tier];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        className={cn("grid place-items-center rounded-full ring-2", s.ring, s.bg, !locked && s.glow, locked && "opacity-40 grayscale")}
        style={{ width: size, height: size }}
        whileHover={!locked ? { scale: 1.08, rotate: 4 } : undefined}
        animate={!locked ? { y: [0, -3, 0] } : undefined} transition={{ duration: 2.5, repeat: Infinity }}
      >
        {locked ? <Lock size={size * 0.4} className="text-fg-muted" /> : <Icon size={size * 0.46} className={s.text} />}
      </motion.div>
      {label && <span className={cn("text-[11px] font-semibold", locked ? "text-fg-muted" : s.text)}>{label}</span>}
    </div>
  );
}

/** Başarım kartı — ilerleme çubuğu + kilit durumu. */
export function AchievementCard({ a }: { a: AchievementView }) {
  const pct = a.target > 0 ? Math.min(100, (a.progress / a.target) * 100) : 0;
  const tier = (a.badge?.tier ?? "bronze") as BadgeTier;
  const s = TIER_STYLE[tier];
  return (
    <motion.div
      className={cn("flex items-center gap-3 rounded-2xl border border-ink-border bg-ink-card p-3.5", a.completed && "ring-1", a.completed && s.ring)}
      initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3 }}
    >
      <div className={cn("relative grid h-12 w-12 shrink-0 place-items-center rounded-xl", s.bg, a.completed ? s.glow : "grayscale opacity-50")}>
        {a.completed ? <Check size={22} className={s.text} /> : <Lock size={18} className="text-fg-muted" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">{a.name}</p>
          <span className={cn("shrink-0 text-xs font-bold", a.completed ? "text-brand" : "text-fg-muted")}>+{a.xp_reward} XP</span>
        </div>
        <p className="truncate text-xs text-fg-muted">{a.description}</p>
        {!a.completed && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-soft">
              <div className="h-full rounded-full bg-brand/70" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] font-medium text-fg-muted">{Math.floor(a.progress)}/{a.target}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Yükleniyor iskeleti. */
export function GamSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-40 rounded-3xl bg-ink-soft" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-ink-soft" />)}
      </div>
      <div className="h-64 rounded-2xl bg-ink-soft" />
    </div>
  );
}
