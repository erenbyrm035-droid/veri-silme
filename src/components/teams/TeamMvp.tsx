"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Crown, Flame, Dumbbell, Award, Zap, Trophy } from "lucide-react";
import { Glass, Avatar, compact } from "./shared";
import { PRESENCE_DOT } from "@/lib/social/types";
import type { TeamMemberView } from "@/lib/teams/types";

/** Haftanın MVP'si — büyük, animasyonlu vitrin kartı. */
export function TeamMvp({ mvp, weeklyTotal }: { mvp: TeamMemberView | null; weeklyTotal: number }) {
  if (!mvp || mvp.weekly_xp <= 0) {
    return (
      <Glass className="p-6 text-center">
        <Trophy size={26} className="mx-auto mb-2 text-fg-muted/60" />
        <p className="text-sm font-semibold">Haftanın MVP&apos;si henüz belli değil</p>
        <p className="mt-1 text-xs text-fg-muted">Bu hafta antrenman yapan ilk kişi burada olacak.</p>
      </Glass>
    );
  }

  const share = weeklyTotal > 0 ? Math.round((mvp.weekly_xp / weeklyTotal) * 100) : mvp.contribution;

  return (
    <Glass className="relative overflow-hidden border-[#FFD34D]/25 p-0">
      {/* Altın parıltı */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 15% 0%, rgba(255,211,77,0.16) 0%, transparent 60%)," +
            "radial-gradient(70% 60% at 95% 100%, rgba(163,230,53,0.10) 0%, transparent 60%)",
        }}
      />
      <motion.span
        aria-hidden
        animate={{ x: ["-30%", "130%"] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
        className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-white/6"
      />

      <div className="relative p-4 sm:p-5">
        <div className="flex items-center gap-1.5">
          <Crown size={14} className="text-[#FFD34D]" />
          <p className="text-[11px] font-black uppercase tracking-widest text-[#FFD34D]">Haftanın MVP&apos;si</p>
        </div>

        <div className="mt-3 flex items-center gap-3.5">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="relative shrink-0"
          >
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full opacity-70 blur-md"
              style={{ background: "conic-gradient(from 0deg, #FFD34D, #A3E635, #FFD34D)" }}
            />
            <Avatar
              src={mvp.avatar_url}
              name={mvp.name}
              size={68}
              className="relative text-2xl"
              ring="ring-[3px] ring-ink-card"
            />
            <span
              className={`absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full border-2 border-ink-card ${PRESENCE_DOT[mvp.presence.status]}`}
              title={mvp.presence.status}
            />
          </motion.div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black leading-tight">{mvp.name}</p>
            <p className="text-[11px] text-fg-muted">Seviye {mvp.level} · Bu haftanın lideri</p>

            {/* Katkı çubuğu */}
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="font-bold uppercase tracking-wide text-fg-muted">Takıma katkı</span>
                <span className="font-black tabular-nums text-[#FFD34D]">%{share}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-soft">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, share)}%` }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                  className="h-full rounded-full bg-gradient-to-r from-[#FFD34D]/70 to-[#FFD34D]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Metrikler */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Metric icon={<Zap size={12} />} label="Haftalık" value={compact(mvp.weekly_xp)} />
          <Metric icon={<Dumbbell size={12} />} label="Toplam XP" value={compact(mvp.total_xp)} />
          <Metric icon={<Flame size={12} />} label="Seri" value={`${mvp.streak} gün`} />
          <Metric icon={<Award size={12} />} label="Rozet" value={String(mvp.badges)} />
        </div>
      </div>
    </Glass>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-ink-soft/50 px-2 py-2 text-center">
      <p className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase tracking-wide text-fg-muted">
        {icon}{label}
      </p>
      <p className="mt-0.5 text-sm font-black tabular-nums">{value}</p>
    </div>
  );
}
