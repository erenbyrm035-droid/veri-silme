"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Target, Gift, Users, Clock, Award, Sparkles, Coins, Activity, Heart, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RECOVERY_META, type RecoveryStatus } from "@/lib/gamification/constants";
import { XpBar, StreakFlame } from "./primitives";
import { LevelUpModal, CountUp } from "./animations";
import { BattlePass } from "./BattlePass";
import { OverviewTab } from "./tabs/OverviewTab";
import { AchievementsTab } from "./tabs/AchievementsTab";
import { LeaderboardTab } from "./tabs/LeaderboardTab";
import { ChallengesTab } from "./tabs/ChallengesTab";
import { RewardsTab } from "./tabs/RewardsTab";
import { TeamsTab } from "./tabs/TeamsTab";
import { TimelineTab } from "./tabs/TimelineTab";
import type { RewardCatalogItem, RewardClaim } from "@/lib/database.types";
import type { GamificationOverview, ChallengeView, TimelineEvent, HeatmapEntry, TeamView, LeaderboardResult } from "@/lib/gamification/queries";
import type { MotivationMessage } from "@/lib/gamification/motivation";
import type { SeasonState } from "@/lib/gamification/season-types";

type Tab = "overview" | "battlepass" | "achievements" | "leaderboard" | "challenges" | "rewards" | "teams" | "timeline";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Genel", icon: Activity },
  { id: "battlepass", label: "Battle Pass", icon: Sparkles },
  { id: "achievements", label: "Başarımlar", icon: Award },
  { id: "leaderboard", label: "Liderlik", icon: Trophy },
  { id: "challenges", label: "Görevler", icon: Target },
  { id: "rewards", label: "Ödüller", icon: Gift },
  { id: "teams", label: "Takımlar", icon: Users },
  { id: "timeline", label: "Zaman Çizgisi", icon: Clock },
];

export interface GamificationClientProps {
  userName: string;
  overview: GamificationOverview;
  challenges: ChallengeView[];
  rewards: { catalog: RewardCatalogItem[]; coins: number; claims: RewardClaim[] };
  timeline: TimelineEvent[];
  heatmap: HeatmapEntry[];
  recovery: { status: RecoveryStatus; score: number };
  leaderboard: LeaderboardResult;
  teams: { teams: TeamView[]; myTeamId: string | null };
  season: SeasonState;
  motivation: MotivationMessage[];
}

export function GamificationClient(props: GamificationClientProps) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [levelUpOpen, setLevelUpOpen] = React.useState(props.overview.sync.leveled_up);

  return (
    <div className="space-y-6">
      <LevelUpModal
        open={levelUpOpen}
        level={props.overview.currentLevel?.level ?? props.overview.stats.level}
        title={props.overview.currentLevel?.title ?? `Seviye ${props.overview.stats.level}`}
        color={props.overview.currentLevel?.color ?? "#A3E635"}
        onClose={() => setLevelUpOpen(false)}
      />

      <HeroCard overview={props.overview} recovery={props.recovery} />

      <MotivationBanner messages={props.motivation} />

      {/* Sekme çubuğu */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === t.id ? "bg-brand text-black" : "bg-ink-soft text-fg-muted hover:text-fg"
            )}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === "overview" && <OverviewTab {...props} />}
          {tab === "battlepass" && <BattlePass state={props.season} />}
          {tab === "achievements" && <AchievementsTab overview={props.overview} />}
          {tab === "leaderboard" && <LeaderboardTab initial={props.leaderboard} />}
          {tab === "challenges" && <ChallengesTab challenges={props.challenges} />}
          {tab === "rewards" && <RewardsTab rewards={props.rewards} />}
          {tab === "teams" && <TeamsTab teams={props.teams} />}
          {tab === "timeline" && <TimelineTab events={props.timeline} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- Hero --------------------------------------------------------------------
function HeroCard({ overview, recovery }: { overview: GamificationOverview; recovery: { status: RecoveryStatus; score: number } }) {
  const { stats, currentLevel, nextLevel } = overview;
  const floor = currentLevel?.min_xp ?? 0;
  const ceil = nextLevel?.min_xp ?? stats.total_xp;
  const span = Math.max(1, ceil - floor);
  const into = stats.total_xp - floor;
  const rec = RECOVERY_META[recovery.status];
  const color = currentLevel?.color ?? "#A3E635";

  return (
    <div className="relative overflow-hidden rounded-3xl border border-ink-border bg-gradient-to-br from-ink-card to-ink-soft p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl" style={{ background: `${color}22` }} />
      <div className="relative flex flex-wrap items-center gap-6">
        <motion.div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-3xl font-black text-black"
          style={{ background: color }} initial={{ scale: 0.8, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring" }}>
          {stats.level}
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-muted">Seviye {stats.level}</p>
          <h2 className="text-2xl font-bold tracking-tight">{currentLevel?.title ?? "Rookie"}</h2>
          <div className="mt-3 max-w-md">
            <div className="mb-1 flex items-center justify-between text-xs text-fg-muted">
              <span><CountUp to={stats.total_xp} /> XP</span>
              {nextLevel ? <span>{nextLevel.title} · {ceil.toLocaleString("tr-TR")}</span> : <span>Maks seviye 🎉</span>}
            </div>
            <XpBar value={into} max={span} color={color} />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <StreakFlame days={stats.current_streak} size={26} />
            <p className="mt-0.5 text-[11px] text-fg-muted">Seri</p>
          </div>
          <div className="text-center">
            <span className="inline-flex items-center gap-1 text-xl font-bold text-amber-400"><Coins size={18} /> {stats.coins}</span>
            <p className="text-[11px] text-fg-muted">Coin</p>
          </div>
          <div className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold sm:flex" style={{ background: `${rec.color}18`, color: rec.color }}>
            <Heart size={15} /> {rec.label}
          </div>
        </div>
      </div>
    </div>
  );
}

function MotivationBanner({ messages }: { messages: MotivationMessage[] }) {
  if (!messages.length) return null;
  return (
    <div className="space-y-2">
      {messages.map((m, i) => (
        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
          className="flex items-start gap-2.5 rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
          <span>{m.text}</span>
        </motion.div>
      ))}
    </div>
  );
}

// --- Overview ----------------------------------------------------------------
