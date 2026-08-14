"use client";

import { motion } from "framer-motion";
import { Trophy, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChallengeView } from "@/lib/gamification/queries";
import { Empty } from "./shared";

export function ChallengesTab({ challenges }: { challenges: ChallengeView[] }) {
  if (challenges.length === 0) return <Empty icon={Target} text="Bu hafta için görev bulunmuyor. Admin panelinden oluşturulabilir." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {challenges.map((c) => {
        const pct = Number(c.target) > 0 ? Math.min(100, (c.progress / Number(c.target)) * 100) : 0;
        return (
          <motion.div key={c.id} whileHover={{ y: -3 }}
            className={cn("rounded-2xl border p-4", c.completed ? "border-brand/40 bg-brand/5" : "border-ink-border bg-ink-card")}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("grid h-9 w-9 place-items-center rounded-xl", c.completed ? "bg-brand text-black" : "bg-ink-soft text-fg-muted")}>
                  {c.completed ? <Trophy size={17} /> : <Target size={17} />}
                </span>
                <div>
                  <p className="text-sm font-semibold">{c.title}</p>
                  <p className="text-xs text-fg-muted">{c.description}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand">+{c.xp_reward}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-soft">
                <motion.div className="h-full rounded-full bg-brand" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7 }} />
              </div>
              <span className="text-[11px] font-medium text-fg-muted">{Math.floor(c.progress).toLocaleString("tr-TR")}/{Number(c.target).toLocaleString("tr-TR")}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// --- Rewards -----------------------------------------------------------------
