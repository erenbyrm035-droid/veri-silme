"use client";

import dynamic from "next/dynamic";
import type { PostureAnalysis } from "@/lib/database.types";

/** Recharts tembel yükleme sarmalayıcısı — bkz. `charts/TrendChart.tsx`. */
const Impl = dynamic(() => import("./ScoreTrends.impl").then((m) => m.ScoreTrends), {
  ssr: false,
  loading: () => <div className="h-[220px] animate-pulse rounded-xl bg-ink-soft/60" />,
});

export function ScoreTrends(props: { analyses: PostureAnalysis[] }) {
  return <Impl {...props} />;
}
