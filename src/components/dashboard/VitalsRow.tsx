"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Trophy, Activity, Flame, HeartPulse, BatteryCharging, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardGam, RecoveryInfo, ReadinessInfo } from "@/lib/data/dashboard";

interface Vital {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone: "brand" | "gold" | "cyan" | "coral";
  href?: string;
  /** 0-100 arası ise altta ince bir gösterge çizilir. */
  meter?: number;
}

const TONE: Record<Vital["tone"], string> = {
  brand: "text-brand",
  gold: "text-[#FFD34D]",
  cyan: "text-[#8FE3FF]",
  coral: "text-coral",
};
const METER: Record<Vital["tone"], string> = {
  brand: "bg-brand",
  gold: "bg-[#FFD34D]",
  cyan: "bg-[#8FE3FF]",
  coral: "bg-coral",
};

/** Günün canlı göstergeleri — XP, seviye, fitness, seri, toparlanma, hazır olma. */
export function VitalsRow({
  gam, recovery, readiness,
}: { gam: DashboardGam; recovery: RecoveryInfo; readiness: ReadinessInfo }) {
  const xpToNext = gam.nextMinXp ? Math.max(0, gam.nextMinXp - gam.total_xp) : null;
  const levelPct = gam.nextMinXp
    ? Math.round(((gam.total_xp - gam.currentMinXp) / Math.max(1, gam.nextMinXp - gam.currentMinXp)) * 100)
    : 100;

  const vitals: Vital[] = [
    {
      label: "Seviye", value: String(gam.level), hint: gam.levelTitle ?? undefined,
      icon: <Trophy size={13} />, tone: "gold", href: "/gamification", meter: levelPct,
    },
    {
      label: "Toplam XP", value: gam.total_xp.toLocaleString("tr-TR"),
      hint: xpToNext !== null ? `${xpToNext.toLocaleString("tr-TR")} XP kaldı` : "Zirvede",
      icon: <Zap size={13} />, tone: "brand", href: "/gamification",
    },
    {
      label: "Fitness Skoru", value: String(gam.fitness_score), hint: "0-100",
      icon: <Activity size={13} />, tone: "cyan", href: "/gamification", meter: gam.fitness_score,
    },
    {
      label: "Seri", value: `${gam.current_streak} gün`,
      hint: gam.current_streak > 0 ? "Devam ettir" : "Bugün başlat",
      icon: <Flame size={13} />, tone: "coral", href: "/gamification",
    },
    {
      label: "Toparlanma", value: String(recovery.score), hint: recovery.label,
      icon: <BatteryCharging size={13} />, tone: "brand", meter: recovery.score,
    },
    {
      label: "Hazır Olma", value: String(readiness.score), hint: readiness.label,
      icon: <HeartPulse size={13} />, tone: "coral", meter: readiness.score,
    },
  ];

  if (gam.coins > 0) {
    vitals.push({
      label: "Coin", value: gam.coins.toLocaleString("tr-TR"), hint: "Ödüllerde kullan",
      icon: <Coins size={13} />, tone: "gold", href: "/gamification",
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {vitals.map((v, i) => (
        <VitalCard key={v.label} vital={v} index={i} />
      ))}
    </div>
  );
}

function VitalCard({ vital, index }: { vital: Vital; index: number }) {
  const body = (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-card/70 p-3 backdrop-blur-xl">
      <p className={cn("flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide", TONE[vital.tone])}>
        {vital.icon}
        <span className="truncate text-fg-muted">{vital.label}</span>
      </p>
      <p className="mt-1 text-xl font-black tabular-nums leading-none">{vital.value}</p>
      {vital.hint && <p className="mt-0.5 truncate text-[10px] text-fg-muted">{vital.hint}</p>}

      {typeof vital.meter === "number" && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-soft">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, Math.min(100, vital.meter))}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 + index * 0.04 }}
            className={cn("h-full rounded-full", METER[vital.tone])}
          />
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.2) }}
    >
      {vital.href ? (
        <Link href={vital.href} className="block transition-transform active:scale-[0.98]">{body}</Link>
      ) : (
        body
      )}
    </motion.div>
  );
}
