"use client";

import dynamic from "next/dynamic";
import type { WeekVolume } from "@/lib/data/workouts";

/** Recharts tembel yükleme sarmalayıcısı — bkz. `charts/TrendChart.tsx`. */
const Impl = dynamic(() => import("./VolumeChart.impl").then((m) => m.VolumeChart), {
  ssr: false,
  loading: () => <div className="h-[220px] animate-pulse rounded-xl bg-ink-soft/60" />,
});

export function VolumeChart(props: { data: WeekVolume[] }) {
  return <Impl {...props} />;
}
