"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles, Users2, Dumbbell, CalendarDays, Target, Flame, Star, TrendingUp, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Glass, Segments, compact } from "@/components/teams/shared";
import { PersonCard } from "@/components/social/PersonCard";
import type { DiscoverData } from "@/lib/social/feed";
import type { TeamSummary } from "@/lib/teams/types";

type Tab = "people" | "exercises" | "teams" | "programs" | "challenges";

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "people", label: "Sporcular", icon: <Users2 size={13} /> },
  { value: "exercises", label: "Trendler", icon: <TrendingUp size={13} /> },
  { value: "teams", label: "Takımlar", icon: <Users2 size={13} /> },
  { value: "programs", label: "Programlar", icon: <CalendarDays size={13} /> },
  { value: "challenges", label: "Görevler", icon: <Target size={13} /> },
];

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Başlangıç", intermediate: "Orta", advanced: "İleri",
};

export function DiscoverClient({
  data, teams,
}: { data: DiscoverData; teams: TeamSummary[] }) {
  const [tab, setTab] = React.useState<Tab>("people");
  const [q, setQ] = React.useState("");

  const needle = q.trim().toLowerCase();
  const match = (s: string) => !needle || s.toLowerCase().includes(needle);

  const people = React.useMemo(() => data.people.filter((p) => match(p.name)), [data.people, needle]);
  const exercises = React.useMemo(() => data.exercises.filter((e) => match(e.name)), [data.exercises, needle]);
  const teamList = React.useMemo(() => teams.filter((t) => match(t.name)), [teams, needle]);
  const programs = React.useMemo(() => data.programs.filter((p) => match(p.name)), [data.programs, needle]);

  return (
    <div className="space-y-4">
      {/* Senin için — Dalga 1'deki içgörü motorundan, ek AI maliyeti olmadan */}
      {data.suggestions.length > 0 && (
        <Glass className="relative overflow-hidden p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(80% 70% at 0% 0%, rgba(192,132,252,0.12) 0%, transparent 60%)" }}
          />
          <div className="relative">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#C084FC]">
              <Sparkles size={12} /> Senin için
            </p>
            <ul className="space-y-1.5">
              {data.suggestions.map((s, i) => (
                <motion.li
                  key={s}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                  className="flex items-start gap-2 text-xs leading-relaxed text-fg/90"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#C084FC]" />
                  {s}
                </motion.li>
              ))}
            </ul>
          </div>
        </Glass>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sporcu, hareket, takım ara…"
            aria-label="Keşfet içinde ara"
            className="input w-full !py-2 !pl-9 !text-sm"
          />
        </div>
      </div>

      <Segments value={tab} onChange={setTab} options={TABS} size="sm" className="w-full" />

      {tab === "people" && (
        people.length === 0 ? <Empty text="Eşleşen sporcu yok." /> : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {people.map((p, i) => (
              <PersonCard
                key={p.user_id}
                index={i}
                person={p}
                subtitle={p.followers > 0 ? `${compact(p.followers)} takipçi` : `Seviye ${p.level}`}
              />
            ))}
          </div>
        )
      )}

      {tab === "exercises" && (
        exercises.length === 0 ? <Empty text="Son 14 günde yeterli veri yok." /> : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {exercises.map((e, i) => (
              <motion.div
                key={e.exercise_id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
              >
                {/* Detay rotası `/exercises/[id]` ve `getExerciseById` uuid ile
                    arıyor — slug ile bağlamak 404 veriyordu (üstelik seed'lerde
                    hiçbir egzersizin slug'ı dolu değil, yani her kart kırıktı). */}
                <Link href={`/exercises/${e.exercise_id}`}>
                  <Glass className="flex items-center gap-3 p-3.5 transition-colors hover:border-brand/40">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                      <Dumbbell size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{e.name}</p>
                      <p className="text-[11px] text-fg-muted">
                        {e.athletes} sporcu · {e.sessions} seans
                        {e.total_volume > 0 && ` · ${compact(Math.round(e.total_volume))} kg hacim`}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-md bg-coral/10 px-1.5 py-0.5 text-[10px] font-black text-coral">
                      #{i + 1}
                    </span>
                  </Glass>
                </Link>
              </motion.div>
            ))}
          </div>
        )
      )}

      {tab === "teams" && (
        teamList.length === 0 ? <Empty text="Eşleşen takım yok." /> : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {teamList.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
              >
                <Link href={`/teams/${t.slug}`}>
                  <Glass className={cn("flex items-center gap-3 p-3.5 transition-colors hover:border-brand/40", t.is_member && "border-brand/35")}>
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-lg font-black"
                      style={{ background: `${t.color ?? "#A3E635"}22`, color: t.color ?? "#A3E635" }}
                    >
                      {t.badge ?? t.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {t.name}
                        {t.is_member && <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 text-[9px] font-bold text-brand">Üyesin</span>}
                      </p>
                      <p className="text-[11px] text-fg-muted">
                        {t.member_count} üye · Sv.{t.level} · {compact(t.total_xp)} XP
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-black tabular-nums text-fg-muted">#{t.rank}</span>
                  </Glass>
                </Link>
              </motion.div>
            ))}
          </div>
        )
      )}

      {tab === "programs" && (
        programs.length === 0 ? <Empty text="Yayınlanmış program yok." /> : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {programs.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: Math.min(i * 0.02, 0.2) }}
              >
                <Link href={`/programs/hazir/${p.slug}`}>
                  <Glass className="p-3.5 transition-colors hover:border-brand/40">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand">
                        <CalendarDays size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{p.name}</p>
                        <p className="line-clamp-2 text-[11px] text-fg-muted">
                          {p.short_description ?? `${p.weeks} hafta · haftada ${p.days_per_week} gün`}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <Chip>{LEVEL_LABEL[p.level] ?? p.level}</Chip>
                          <Chip>{p.weeks} hafta</Chip>
                          {p.rating_avg > 0 && (
                            <Chip>
                              <Star size={9} className="fill-current" /> {p.rating_avg.toFixed(1)}
                            </Chip>
                          )}
                          {p.use_count > 0 && <Chip>{compact(p.use_count)} kişi</Chip>}
                        </div>
                      </div>
                    </div>
                  </Glass>
                </Link>
              </motion.div>
            ))}
          </div>
        )
      )}

      {tab === "challenges" && (
        data.challenges.length === 0 ? <Empty text="Bu hafta aktif görev yok." /> : (
          <div className="space-y-2.5">
            {data.challenges.map((c, i) => {
              const pct = Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100));
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(i * 0.03, 0.2) }}
                >
                  <Glass className={cn("p-3.5", c.completed && "border-brand/35")}>
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-lg">
                        {c.icon ?? "🎯"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 text-sm font-bold">
                          {c.title}
                          {c.completed && <span className="rounded-full bg-brand/20 px-1.5 text-[9px] font-bold text-brand">Tamam</span>}
                        </p>
                        {c.description && <p className="text-[11px] text-fg-muted">{c.description}</p>}
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between text-[10px] font-semibold">
                            <span className="text-fg-muted tabular-nums">
                              {compact(Math.round(c.progress))} / {compact(c.target)}
                            </span>
                            <span className="text-brand">+{c.xp_reward} XP</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-ink-soft">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                              className="h-full rounded-full bg-brand"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Glass>
                </motion.div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-white/6 px-1.5 py-0.5 text-[9px] font-bold text-fg-muted">
      {children}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Glass className="p-10 text-center">
      <Flame size={24} className="mx-auto mb-2 text-fg-muted/50" />
      <p className="text-sm text-fg-muted">{text}</p>
    </Glass>
  );
}
