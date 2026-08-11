"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass } from "./shared";
import { TIER_RING, type TeamBadgeView } from "@/lib/teams/types";

const TIER_LABEL: Record<TeamBadgeView["tier"], string> = {
  bronze: "Bronz", silver: "Gümüş", gold: "Altın", platinum: "Platin", diamond: "Elmas",
};

export function TeamBadges({ badges }: { badges: TeamBadgeView[] }) {
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);

  return (
    <div className="space-y-3">
      <Glass className="flex items-center justify-between p-3.5">
        <div>
          <p className="text-sm font-bold">Rozet Koleksiyonu</p>
          <p className="text-[11px] text-fg-muted">Takımın kazandığı başarımlar</p>
        </div>
        <p className="text-xl font-black tabular-nums">
          <span className="text-brand">{earned.length}</span>
          <span className="text-fg-muted">/{badges.length}</span>
        </p>
      </Glass>

      {earned.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {earned.map((b, i) => <BadgeCard key={b.id} badge={b} index={i} />)}
        </div>
      )}

      {locked.length > 0 && (
        <>
          <p className="pt-1 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Kilitli</p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {locked.map((b, i) => <BadgeCard key={b.id} badge={b} index={i} />)}
          </div>
        </>
      )}
    </div>
  );
}

function BadgeCard({ badge, index }: { badge: TeamBadgeView; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.03, 0.24) }}
    >
      <Glass className={cn("p-3.5 text-center", !badge.earned && "opacity-55")}>
        <div
          className={cn(
            "mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl ring-2",
            badge.earned ? TIER_RING[badge.tier] : "text-fg-muted ring-white/10",
            badge.earned ? "bg-white/5" : "bg-ink-soft/60"
          )}
        >
          {badge.earned ? (badge.icon ?? "🏅") : <Lock size={18} />}
        </div>
        <p className="mt-2 truncate text-xs font-bold">{badge.name}</p>
        <p className={cn("text-[10px] font-semibold uppercase tracking-wide", badge.earned ? TIER_RING[badge.tier].split(" ")[1] : "text-fg-muted")}>
          {TIER_LABEL[badge.tier]}
        </p>
        {badge.description && (
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-fg-muted">{badge.description}</p>
        )}
        {badge.earned && badge.awarded_at && (
          <p className="mt-1 text-[10px] text-brand tabular-nums">
            {new Date(badge.awarded_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        )}
      </Glass>
    </motion.div>
  );
}
