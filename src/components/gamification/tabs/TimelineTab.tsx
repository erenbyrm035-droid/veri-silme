"use client";

import { motion } from "framer-motion";
import { Zap, Clock, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/lib/gamification/queries";
import { Empty } from "./shared";

export function TimelineTab({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) return <Empty icon={Clock} text="Henüz aktivite yok. Antrenmana başla, geçmişin burada belirsin!" />;
  return (
    <div className="relative space-y-3 pl-6">
      <div className="absolute bottom-2 left-2 top-2 w-px bg-ink-border" />
      {events.map((e, i) => (
        <motion.div key={e.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.5) }} className="relative">
          <span className={cn("absolute -left-[18px] top-1.5 h-3 w-3 rounded-full ring-4 ring-ink",
            e.kind === "achievement" ? "bg-amber-400" : "bg-brand")} />
          <div className="rounded-2xl border border-ink-border bg-ink-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                {e.kind === "achievement" ? <Crown size={14} className="text-amber-400" /> : <Zap size={14} className="text-brand" />}
                {e.title}
              </p>
              <span className="shrink-0 text-xs font-bold text-brand">+{e.xp} XP</span>
            </div>
            <p className="text-xs text-fg-muted">{e.detail} · {new Date(e.at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
