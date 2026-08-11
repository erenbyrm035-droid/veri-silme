"use client";

import { StatCard } from "./stat-card";
import { ChartPlaceholder } from "./chart-placeholder";
import type { AdminDashboardData } from "../../lib/sample-data";

/** Admin dashboard — sunucudan gelen GERÇEK metriklerle. */
export function DashboardView({ data }: { data: AdminDashboardData }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {data.stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartPlaceholder title="Günlük Kayıt" data={data.charts.dailyUsers} />
        <ChartPlaceholder title="Haftalık Kayıt" data={data.charts.weeklyUsers} color="#38bdf8" />
        <ChartPlaceholder title="Aylık Kayıt" data={data.charts.monthlyUsers} color="#a78bfa" />
        <ChartPlaceholder title="Premium Büyüme" data={data.charts.premiumGrowth} color="#34d399" />
      </div>
    </div>
  );
}
