"use client";

import dynamic from "next/dynamic";
import type { TeamPulse, TeamSeriesPoint } from "@/lib/social/types";
import type { TeamStats as TeamStatsT } from "@/lib/teams/types";

/**
 * Recharts tembel yükleme sarmalayıcısı — bkz. `charts/TrendChart.tsx`.
 * İstatistik takım hub'ında bir SEKME; açılmadan grafiği indirmeye gerek yok.
 */
const Impl = dynamic(() => import("./TeamStats.impl").then((m) => m.TeamStatsPanel), {
  ssr: false,
  loading: () => (
    <div className="space-y-2.5">
      <div className="h-24 animate-pulse rounded-2xl bg-ink-soft/60" />
      <div className="h-64 animate-pulse rounded-2xl bg-ink-soft/60" />
    </div>
  ),
});

export function TeamStatsPanel(props: {
  stats: TeamStatsT;
  pulse: TeamPulse;
  series: TeamSeriesPoint[];
  memberCount: number;
}) {
  return <Impl {...props} />;
}
