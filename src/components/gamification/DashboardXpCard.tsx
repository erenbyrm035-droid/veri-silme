"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, ArrowRight, Sparkles } from "lucide-react";
import { XpBar, StreakFlame } from "./primitives";

export interface DashboardXpCardProps {
  level: number;
  title: string;
  color: string;
  totalXp: number;
  currentMin: number;
  nextMin: number | null;
  nextTitle: string | null;
  streak: number;
  fitness: number;
  started: boolean;
}

export function DashboardXpCard(props: DashboardXpCardProps) {
  if (!props.started) {
    return (
      <Link href="/gamification" className="block">
        <div className="flex items-center justify-between rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-transparent p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand"><Trophy size={18} /></span>
            <div>
              <p className="text-sm font-semibold">XP kazanmaya başla</p>
              <p className="text-xs text-fg-muted">Antrenman yap, rozet topla, seviye atla.</p>
            </div>
          </div>
          <ArrowRight size={18} className="shrink-0 text-brand" />
        </div>
      </Link>
    );
  }
  const span = Math.max(1, (props.nextMin ?? props.totalXp) - props.currentMin);
  const into = props.totalXp - props.currentMin;
  return (
    <Link href="/gamification" className="block">
      <motion.div whileHover={{ y: -2 }} className="rounded-2xl border border-ink-border bg-ink-card p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black text-black" style={{ background: props.color }}>{props.level}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{props.title}</p>
              <span className="flex items-center gap-3 text-xs text-fg-muted">
                <StreakFlame days={props.streak} size={15} />
                <span className="inline-flex items-center gap-1 text-brand"><Sparkles size={12} /> {props.fitness}</span>
              </span>
            </div>
            <div className="mt-2">
              <XpBar value={into} max={span} color={props.color} />
              <p className="mt-1 text-[11px] text-fg-muted">
                {props.totalXp.toLocaleString("tr-TR")} XP{props.nextTitle ? ` · ${props.nextTitle}'e ${(props.nextMin! - props.totalXp).toLocaleString("tr-TR")} XP` : " · Maks seviye"}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
