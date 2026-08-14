"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Zap, Target, Gift, Users, Clock, Award, Flame, Sparkles,
  Coins, Crown, Plus, LogOut, Activity, Dumbbell, Heart, CalendarDays,
  ChevronDown, ChevronRight, Medal, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fitnessLabel, RECOVERY_META, PERIOD_LABEL, TIER_STYLE, CATEGORY_LABEL, type RecoveryStatus } from "@/lib/gamification/constants";
import { XpBar, Gauge, StreakFlame, BadgeMedal, AchievementCard } from "./primitives";
import { LevelUpModal, CountUp } from "./animations";
import { BattlePass } from "./BattlePass";
import { loadLeaderboard, saveLeaderboardRegion, createTeam, joinTeam, leaveTeam, teamRoster } from "@/lib/gamification/actions";
import type {
  Level, BadgeTier, LeaderboardPeriod, LeaderboardScope, LeaderboardRow,
  RewardCatalogItem, RewardClaim,
} from "@/lib/database.types";
import type { GamificationOverview, ChallengeView, TimelineEvent, HeatmapEntry, TeamView, LeaderboardResult, TeamRosterMember } from "@/lib/gamification/queries";
import type { MotivationMessage } from "@/lib/gamification/motivation";
import type { SeasonState } from "@/lib/gamification/season-types";
import { SmartImage } from "@/components/ui/SmartImage";

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
function OverviewTab(props: GamificationClientProps) {
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
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div><span className="font-semibold text-emerald-400">En çok:</span> <span className="text-fg-muted">{most.map((m) => m.name).join(", ")}</span></div>
        <div><span className="font-semibold text-coral">En az:</span> <span className="text-fg-muted">{least.map((m) => m.name).join(", ")}</span></div>
      </div>
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
function AchievementsTab({ overview }: { overview: GamificationOverview }) {
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
const SCOPES: { id: LeaderboardScope; label: string; icon: string }[] = [
  { id: "global", label: "Global", icon: "🌍" },
  { id: "country", label: "Ülke", icon: "🇹🇷" },
  { id: "city", label: "Şehir", icon: "📍" },
];
const PERIODS: LeaderboardPeriod[] = ["weekly", "monthly", "yearly", "all_time"];
const PAGE = 25;

/** Apple/Linear tarzı kayan göstergeli segmented control. */
function PremiumSegmented<T extends string>({
  value, onChange, options, size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; icon?: string }[];
  size?: "sm" | "md";
}) {
  const id = React.useId();
  return (
    <div
      role="tablist"
      className="inline-flex w-full items-center gap-1 rounded-xl border border-ink-border bg-ink-soft/60 p-1 backdrop-blur sm:w-auto"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-lg font-semibold transition-colors duration-200 sm:flex-none",
              size === "sm" ? "px-3 py-1.5 text-xs" : "px-3.5 py-2 text-[13px]",
              active ? "text-black" : "text-fg-muted hover:text-fg"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-lg bg-brand shadow-[0_2px_10px_-2px_rgb(var(--brand)/0.55)]"
              />
            )}
            <span className="relative z-10">
              {o.icon && <span className="mr-1">{o.icon}</span>}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LeaderboardTab({ initial }: { initial: LeaderboardResult }) {
  const [period, setPeriod] = React.useState<LeaderboardPeriod>("weekly");
  const [scope, setScope] = React.useState<LeaderboardScope>("global");
  const [data, setData] = React.useState<LeaderboardResult>(initial);
  const [shown, setShown] = React.useState(PAGE);
  const [pending, start] = React.useTransition();

  const refresh = React.useCallback((p: LeaderboardPeriod, s: LeaderboardScope) => {
    setPeriod(p); setScope(s); setShown(PAGE);
    start(async () => setData(await loadLeaderboard(p, s, null, { limit: 200 })));
  }, []);

  const periodOpts = React.useMemo(
    () => PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] })),
    []
  );
  const scopeOpts = React.useMemo(
    () => SCOPES.map((s) => ({ value: s.id, label: s.label, icon: s.icon })),
    []
  );

  const visible = React.useMemo(() => data.rows.slice(0, shown), [data.rows, shown]);
  const podium = React.useMemo(() => visible.filter((r) => r.rank <= 3), [visible]);
  const rest = React.useMemo(() => visible.filter((r) => r.rank > 3), [visible]);
  const meOutside = data.me && !visible.some((r) => r.user_id === data.me!.user_id);

  return (
    <div className="space-y-4">
      {/* Filtreler */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <PremiumSegmented value={period} onChange={(v) => refresh(v, scope)} options={periodOpts} />
        <PremiumSegmented value={scope} onChange={(v) => refresh(period, v)} options={scopeOpts} size="sm" />
      </div>

      {/* Bölge etiketi + yarışmacı sayısı */}
      {data.total > 0 && (
        <p className="px-0.5 text-xs text-fg-muted">
          {scope === "global" ? "Dünya geneli" : data.scopeValue}
          {" · "}
          {data.total.toLocaleString("tr-TR")} sporcu
        </p>
      )}

      <div className={cn("space-y-4 transition-opacity duration-200", pending && "opacity-40")}>
        {data.needsProfile ? (
          <RegionPrompt scope={scope} onSaved={() => refresh(period, scope)} />
        ) : data.rows.length === 0 ? (
          <div className="rounded-2xl border border-ink-border bg-ink-card p-8 text-center">
            <Trophy size={26} className="mx-auto mb-2 text-fg-muted/60" />
            <p className="text-sm font-semibold">Bu kategoride henüz sıralama yok</p>
            <p className="mt-1 text-xs text-fg-muted">
              Antrenman yap, su ve beslenmeni kaydet — XP kazanınca burada görüneceksin.
            </p>
          </div>
        ) : (
          <>
            {podium.length > 0 && <Podium rows={podium} meId={data.me?.user_id} />}
            {rest.length > 0 && (
              <div className="space-y-1.5">
                {rest.map((r) => (
                  <LeaderRow key={r.user_id} row={r} highlight={data.me?.user_id === r.user_id} />
                ))}
              </div>
            )}

            {shown < data.rows.length && (
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="w-full rounded-xl border border-ink-border bg-ink-soft py-2.5 text-sm font-semibold text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
              >
                Daha fazla göster ({data.rows.length - shown})
              </button>
            )}

            {meOutside && data.me && (
              <div className="space-y-1.5 border-t border-ink-border pt-3">
                <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">Senin sıran</p>
                <LeaderRow row={data.me} highlight />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Ülke/şehir bilgisi yoksa kullanıcıdan ister. */
function RegionPrompt({ scope, onSaved }: { scope: LeaderboardScope; onSaved: () => void }) {
  const isCountry = scope === "country";
  const [value, setValue] = React.useState(isCountry ? "Türkiye" : "");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function save() {
    const v = value.trim();
    if (!v) return;
    setSaving(true); setErr(null);
    const res = isCountry
      ? await saveLeaderboardRegion(v, undefined)
      : await saveLeaderboardRegion(undefined, v);
    setSaving(false);
    if (res.ok) onSaved();
    else setErr(res.error ?? "Kaydedilemedi.");
  }

  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5 text-center">
      <span className="mb-2 block text-3xl">{isCountry ? "🇹🇷" : "📍"}</span>
      <p className="text-sm font-bold">{isCountry ? "Ülkeni seç" : "Şehrini gir"}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-fg-muted">
        {isCountry
          ? "Ülke sıralamasında yer alabilmen için ülke bilgin gerekiyor."
          : "Şehir sıralamasında yer alabilmen için şehir bilgin gerekiyor."}
      </p>
      <div className="mx-auto mt-4 flex max-w-xs gap-2">
        {isCountry ? (
          <select value={value} onChange={(e) => setValue(e.target.value)} className="input flex-1">
            {["Türkiye", "Almanya", "Hollanda", "Avusturya", "Fransa", "İngiltere", "ABD", "Azerbaycan", "KKTC", "Diğer"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="İstanbul"
            className="input flex-1"
            autoFocus
          />
        )}
        <button onClick={save} disabled={saving || !value.trim()} className="btn-primary shrink-0">
          {saving ? "…" : "Kaydet"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-coral">{err}</p>}
    </div>
  );
}

const PODIUM_STYLE: Record<number, { ring: string; bg: string; text: string; medal: string; glow: string }> = {
  1: { ring: "ring-[#FFD34D]", bg: "from-[#FFD34D]/20 to-transparent", text: "text-[#FFD34D]", medal: "🥇", glow: "shadow-[0_0_28px_-8px_#FFD34D]" },
  2: { ring: "ring-[#C9D2DC]", bg: "from-[#C9D2DC]/18 to-transparent", text: "text-[#C9D2DC]", medal: "🥈", glow: "shadow-[0_0_24px_-10px_#C9D2DC]" },
  3: { ring: "ring-[#E0955C]", bg: "from-[#E0955C]/18 to-transparent", text: "text-[#E0955C]", medal: "🥉", glow: "shadow-[0_0_24px_-10px_#E0955C]" },
};

/** İlk 3 için altın/gümüş/bronz kürsü. */
function Podium({ rows, meId }: { rows: LeaderboardRow[]; meId?: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map((r) => {
        const s = PODIUM_STYLE[r.rank];
        const mine = r.user_id === meId;
        return (
          <motion.div
            key={r.user_id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "relative flex items-center gap-3 overflow-hidden rounded-2xl border border-ink-border bg-gradient-to-br p-3.5 sm:flex-col sm:text-center",
              s.bg, mine && "border-brand"
            )}
          >
            <span className="absolute right-2.5 top-2 text-lg sm:left-2.5 sm:right-auto">{s.medal}</span>
            <Avatar row={r} className={cn("h-12 w-12 ring-2", s.ring, s.glow)} />
            <div className="min-w-0 flex-1 sm:w-full sm:flex-none">
              <p className="truncate text-sm font-bold">
                {r.full_name ?? "Anonim"}{mine && " (Sen)"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-muted sm:justify-center">
                <span>Sv {r.level}</span>
                {r.streak > 0 && <span className="text-amber-400">🔥{r.streak}</span>}
                <Delta value={r.delta} />
              </p>
              <p className={cn("mt-1 text-base font-black tabular-nums", s.text)}>
                {r.score.toLocaleString("tr-TR")}
                <span className="ml-1 text-[10px] font-bold opacity-70">XP</span>
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function Avatar({ row, className }: { row: LeaderboardRow; className?: string }) {
  if (row.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <SmartImage src={row.avatar_url} alt={row.full_name ?? "Sporcu"} width={40} height={40} className={cn("shrink-0 rounded-full border border-ink-border object-cover", className)} />;
  }
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-ink-soft text-sm font-bold text-fg-muted", className)}>
      {(row.full_name ?? "V").charAt(0).toUpperCase()}
    </span>
  );
}

/** Sıra değişimi göstergesi (önceki döneme göre). */
function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] font-semibold text-brand">YENİ</span>;
  if (value === 0) return <span className="text-[10px] text-fg-muted/70">—</span>;
  const up = value > 0;
  return (
    <span className={cn("text-[10px] font-bold", up ? "text-emerald-400" : "text-coral")}>
      {up ? "↑" : "↓"}{Math.abs(value)}
    </span>
  );
}

const LeaderRow = React.memo(function LeaderRow({ row, highlight }: { row: LeaderboardRow; highlight?: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
        highlight ? "border-brand bg-brand/10" : "border-ink-border bg-ink-card hover:border-ink-border/80 hover:bg-ink-soft/40"
      )}
    >
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-fg-muted">{row.rank}</span>
      <Avatar row={row} className="h-9 w-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {row.full_name ?? "Anonim"}{highlight && " (Sen)"}
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span>Seviye {row.level}</span>
          {row.streak > 0 && <span className="text-amber-400">🔥 {row.streak}</span>}
          {row.city && <span className="truncate">· {row.city}</span>}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-sm font-bold tabular-nums text-brand">{row.score.toLocaleString("tr-TR")}</span>
        <Delta value={row.delta} />
      </div>
    </motion.div>
  );
});

// --- Challenges --------------------------------------------------------------
function ChallengesTab({ challenges }: { challenges: ChallengeView[] }) {
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
function RewardsTab({ rewards }: { rewards: { catalog: RewardCatalogItem[]; coins: number; claims: RewardClaim[] } }) {
  // Ödül akışı /rewards sayfasına taşındı (Ödül Merkezi). Burada yalnızca
  // bakiye ve yönlendirme kalır; talep mantığı tek yerde (atomik RPC) yaşıyor.
  const available = rewards.catalog.length;
  const owned = rewards.claims.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-ink-border bg-ink-card p-4">
        <p className="text-sm text-fg-muted">Coin bakiyen</p>
        <span className="inline-flex items-center gap-1.5 text-lg font-bold text-amber-400">
          <Coins size={18} /> {rewards.coins.toLocaleString("tr-TR")}
        </span>
      </div>

      <Link
        href="/rewards"
        className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-4 transition-colors hover:border-brand/60"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
          <Gift size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Ödül Merkezi</p>
          <p className="text-xs text-fg-muted">
            {available} ödül · {owned > 0 ? `${owned} talebin var` : "henüz talebin yok"}
          </p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-brand" />
      </Link>

      <p className="text-center text-xs text-fg-muted">
        Coin; XP, başarım ve haftalık görevlerden kazanılır. (Gerçek para ödülü yoktur.)
      </p>
    </div>
  );
}

function TeamsTab({ teams }: { teams: { teams: TeamView[]; myTeamId: string | null } }) {
  const [list, setList] = React.useState(teams.teams);
  const [myTeam, setMyTeam] = React.useState(teams.myTeamId);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function refreshLocal(teamId: string, joined: boolean) {
    setMyTeam(joined ? teamId : null);
    setList((l) => l.map((t) => ({ ...t, is_member: t.id === teamId ? joined : (joined ? false : t.is_member), member_count: t.id === teamId ? t.member_count + (joined ? 1 : -1) : t.member_count })));
  }

  function onJoin(t: TeamView) { start(async () => { const r = await joinTeam(t.id); if (r.ok) refreshLocal(t.id, true); }); }
  function onLeave(t: TeamView) { start(async () => { const r = await leaveTeam(t.id); if (r.ok) refreshLocal(t.id, false); }); }
  function onCreate() {
    setMsg(null);
    start(async () => {
      const r = await createTeam(name);
      if (!r.ok) return setMsg(r.error ?? "Oluşturulamadı.");
      setName(""); setCreating(false); setMsg("Takım oluşturuldu! Sayfayı yenileyerek görebilirsin.");
    });
  }

  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [rosters, setRosters] = React.useState<Record<string, TeamRosterMember[]>>({});
  const [loadingRoster, setLoadingRoster] = React.useState<string | null>(null);

  function toggleExpand(teamId: string) {
    if (expanded === teamId) { setExpanded(null); return; }
    setExpanded(teamId);
    if (!rosters[teamId]) {
      setLoadingRoster(teamId);
      teamRoster(teamId).then((r) => {
        if (r.ok && r.data) setRosters((m) => ({ ...m, [teamId]: r.data! }));
        setLoadingRoster(null);
      });
    }
  }

  const rankStyle = (rank: number) =>
    rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-fg-muted";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Takımlar <span className="text-fg-muted">· puan = üyelerin XP toplamı</span></h3>
        {!myTeam && (
          <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-black">
            <Plus size={14} /> Takım Oluştur
          </button>
        )}
      </div>
      {creating && (
        <div className="flex gap-2 rounded-2xl border border-ink-border bg-ink-card p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Takım adı"
            className="flex-1 rounded-xl border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-brand" />
          <button onClick={onCreate} disabled={pending} className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-black">Oluştur</button>
        </div>
      )}
      {msg && <p className="rounded-xl bg-brand/10 px-3 py-2 text-sm text-brand">{msg}</p>}
      {list.length === 0 && <Empty icon={Users} text="Henüz takım yok. İlk takımı sen oluştur!" />}
      <div className="space-y-2">
        {list.map((t, i) => (
          <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className={cn("overflow-hidden rounded-2xl border bg-ink-card", t.is_member ? "border-brand/40" : "border-ink-border")}>
            <div className="flex items-center gap-3 p-4">
              <div className="flex w-6 shrink-0 items-center justify-center">
                {t.rank <= 3 ? <Medal size={18} className={rankStyle(t.rank)} /> : <span className="text-xs font-bold text-fg-muted">{t.rank}</span>}
              </div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black text-black" style={{ background: t.color ?? "#A3E635" }}>
                {t.badge ?? t.name.charAt(0).toUpperCase()}
              </span>
              <button onClick={() => toggleExpand(t.id)} className="min-w-0 flex-1 text-left">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {t.name}
                  {t.is_member && <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[11px] font-bold text-brand">Takımım</span>}
                </p>
                <p className="text-xs text-fg-muted">
                  {t.member_count} üye · {t.points.toLocaleString("tr-TR")} XP
                  {t.weekly_points > 0 && <span className="text-brand"> · +{t.weekly_points.toLocaleString("tr-TR")} bu hafta</span>}
                </p>
              </button>
              {t.is_member ? (
                <button onClick={() => onLeave(t)} disabled={pending || t.is_owner} className="inline-flex items-center gap-1 rounded-xl bg-ink-soft px-3 py-2 text-xs font-semibold text-fg-muted disabled:opacity-50">
                  <LogOut size={13} /> {t.is_owner ? "Kurucu" : "Ayrıl"}
                </button>
              ) : (
                <button onClick={() => onJoin(t)} disabled={pending || !!myTeam} className="rounded-xl bg-brand px-3 py-2 text-xs font-bold text-black disabled:opacity-40">Katıl</button>
              )}
              <button onClick={() => toggleExpand(t.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-fg-muted hover:text-fg" aria-label="Kadroyu göster">
                <ChevronDown size={16} className={cn("transition-transform", expanded === t.id && "rotate-180")} />
              </button>
            </div>
            <AnimatePresence initial={false}>
              {expanded === t.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                  className="border-t border-ink-border">
                  {loadingRoster === t.id ? (
                    <p className="p-4 text-center text-xs text-fg-muted">Kadro yükleniyor…</p>
                  ) : (rosters[t.id]?.length ?? 0) === 0 ? (
                    <p className="p-4 text-center text-xs text-fg-muted">Üye bulunamadı.</p>
                  ) : (
                    <div className="divide-y divide-ink-border">
                      {rosters[t.id].map((m, idx) => (
                        <div key={m.user_id} className={cn("flex items-center gap-3 px-4 py-2.5", m.is_me && "bg-brand/5")}>
                          <span className="w-5 shrink-0 text-center text-xs font-bold text-fg-muted">{idx + 1}</span>
                          {m.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <SmartImage src={m.avatar_url} alt={m.name} width={28} height={28} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-soft text-[11px] font-bold text-fg-muted">{m.name.charAt(0).toUpperCase()}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-xs font-semibold">
                              {m.name}
                              {m.role === "owner" && <Crown size={11} className="shrink-0 text-yellow-400" />}
                              {m.is_me && <span className="text-[11px] text-brand">(sen)</span>}
                            </p>
                            <p className="text-[11px] text-fg-muted">Sv {m.level}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold">{m.total_xp.toLocaleString("tr-TR")} XP</p>
                            {m.weekly_xp > 0 && <p className="text-[11px] text-brand">+{m.weekly_xp.toLocaleString("tr-TR")} bu hafta</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// --- Timeline ----------------------------------------------------------------
function TimelineTab({ events }: { events: TimelineEvent[] }) {
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

function Empty({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink-border bg-ink-card p-10 text-center">
      <Icon size={28} className="text-fg-muted" />
      <p className="max-w-xs text-sm text-fg-muted">{text}</p>
    </div>
  );
}
