"use client";

import * as React from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { motion } from "framer-motion";
import { Zap, Flame, Dumbbell, Clock, Activity, Users, Footprints, Percent } from "lucide-react";
import { Glass, StatTile, Segments, compact } from "./shared";
import type { TeamPulse, TeamSeriesPoint } from "@/lib/social/types";
import type { TeamStats as TeamStatsT } from "@/lib/teams/types";

type Metric = "xp" | "workouts" | "minutes" | "active_users";

const METRICS: { value: Metric; label: string }[] = [
  { value: "xp", label: "XP" },
  { value: "workouts", label: "Antrenman" },
  { value: "minutes", label: "Süre" },
  { value: "active_users", label: "Aktif üye" },
];

const METRIC_SUFFIX: Record<Metric, string> = { xp: " XP", workouts: "", minutes: " dk", active_users: " kişi" };

export function TeamStatsPanel({
  stats, pulse, series, memberCount,
}: { stats: TeamStatsT; pulse: TeamPulse; series: TeamSeriesPoint[]; memberCount: number }) {
  const [metric, setMetric] = React.useState<Metric>("xp");

  const data = React.useMemo(
    () => series.map((p) => ({
      ...p,
      label: new Date(p.d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
    })),
    [series]
  );

  const total30 = React.useMemo(
    () => series.reduce((s, p) => s + (p[metric] as number), 0),
    [series, metric]
  );
  const prev15 = React.useMemo(() => {
    if (series.length < 4) return null;
    const half = Math.floor(series.length / 2);
    const a = series.slice(0, half).reduce((s, p) => s + (p[metric] as number), 0);
    const b = series.slice(half).reduce((s, p) => s + (p[metric] as number), 0);
    if (a === 0) return b > 0 ? 100 : 0;
    return Math.round(((b - a) / a) * 100);
  }, [series, metric]);

  const weekBars = React.useMemo(() => data.slice(-7), [data]);
  const hasData = series.some((p) => p.xp > 0 || p.workouts > 0);

  return (
    <div className="space-y-3">
      {/* Özet kutucukları */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Toplam XP" value={compact(stats.total_xp)} icon={<Zap size={11} />} />
        <StatTile label="Bu hafta" value={compact(stats.weekly_xp)} icon={<Flame size={11} />} />
        <StatTile label="Antrenman" value={compact(stats.workouts)} icon={<Dumbbell size={11} />} />
        <StatTile label="Süre" value={`${compact(stats.minutes)} dk`} icon={<Clock size={11} />} />
        <StatTile label="Kalori" value={compact(stats.calories)} hint="toplam kayıt" />
        <StatTile label="Adım" value={compact(stats.steps)} icon={<Footprints size={11} />} hint="günlük ort." />
        <StatTile
          label="Bugün aktif"
          value={`${pulse.active_today}/${memberCount}`}
          icon={<Activity size={11} />}
          hint={`${pulse.online_now} çevrimiçi`}
        />
        <StatTile
          label="Katılım"
          value={`%${pulse.participation_pct}`}
          icon={<Percent size={11} />}
          hint="son 7 gün"
        />
      </div>

      {/* Gelişim grafiği */}
      <Glass className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">Son 30 gün</p>
            <p className="text-[11px] text-fg-muted">
              Toplam {compact(total30)}
              {METRIC_SUFFIX[metric]}
              {prev15 !== null && (
                <span className={prev15 >= 0 ? " text-brand" : " text-coral"}>
                  {" "}· {prev15 >= 0 ? "▲" : "▼"} %{Math.abs(prev15)}
                </span>
              )}
            </p>
          </div>
          <Segments value={metric} onChange={setMetric} options={METRICS} size="sm" />
        </div>

        {!hasData ? (
          <EmptyChart />
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="teamArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(163,230,53)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="rgb(163,230,53)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(data.length / 5) - 1)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) => compact(v)}
                />
                <Tooltip content={<ChartTip suffix={METRIC_SUFFIX[metric]} />} cursor={{ stroke: "rgba(163,230,53,0.35)" }} />
                <Area
                  type="monotone"
                  dataKey={metric}
                  stroke="rgb(163,230,53)"
                  strokeWidth={2}
                  fill="url(#teamArea)"
                  animationDuration={800}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Glass>

      {/* Haftalık aktif üye dağılımı */}
      <Glass className="p-4">
        <p className="text-sm font-bold">Son 7 gün · aktif üye</p>
        <p className="mb-3 text-[11px] text-fg-muted">
          Her gün antrenman yapan üye sayısı ({memberCount} üye içinden)
        </p>
        {!hasData ? (
          <EmptyChart compact />
        ) : (
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekBars} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.45)" }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip suffix=" kişi" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                <Bar dataKey="active_users" fill="rgb(163,230,53)" radius={[5, 5, 0, 0]} animationDuration={700} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Glass>
    </div>
  );
}

function ChartTip({
  active, payload, label, suffix,
}: { active?: boolean; payload?: { value: number }[]; label?: string; suffix: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/12 bg-ink-card/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur">
      <p className="font-semibold">{label}</p>
      <p className="tabular-nums text-brand">
        {payload[0].value.toLocaleString("tr-TR")}{suffix}
      </p>
    </div>
  );
}

function EmptyChart({ compact: small }: { compact?: boolean } = {}) {
  return (
    <div className={small ? "h-36" : "h-52"}>
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-ink-soft/30 text-center">
        <Users size={22} className="mb-2 text-fg-muted/50" />
        <p className="text-xs font-semibold">Henüz veri yok</p>
        <p className="mt-0.5 max-w-[220px] text-[11px] text-fg-muted">
          Takım üyeleri antrenman kaydettikçe grafikler burada canlanacak.
        </p>
        <motion.div
          aria-hidden
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="mt-3 h-px w-24 origin-left bg-gradient-to-r from-brand/60 to-transparent"
        />
      </div>
    </div>
  );
}
