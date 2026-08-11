"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { PostureAnalysis } from "@/lib/database.types";
import { formatShortDate } from "@/lib/utils";

const SERIES = [
  { key: "posture", label: "Postür", color: "#e7fb00" },
  { key: "mobility", label: "Mobilite", color: "#38bdf8" },
  { key: "symmetry", label: "Simetri", color: "#fb7185" },
  { key: "recovery", label: "Toparlanma", color: "#34d399" },
] as const;

/** Haftalık analizlerin 4 skorunu zaman içinde karşılaştıran çizgi grafik. */
export function ScoreTrends({ analyses }: { analyses: PostureAnalysis[] }) {
  // Eskiden yeniye sırala (grafik soldan sağa artan zaman).
  const data = analyses
    .slice()
    .reverse()
    .map((a) => ({
      label: formatShortDate(a.created_at),
      posture: a.posture_score,
      mobility: a.mobility_score,
      symmetry: a.symmetry_score,
      recovery: a.recovery_score,
    }));

  if (data.length < 2) {
    return (
      <div className="card">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Skor Gelişimi
        </h2>
        <p className="py-6 text-center text-xs text-fg-muted">
          Grafik için en az 2 analiz gerekli. Her hafta tekrar analiz yaparak
          gelişimini izle.
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Skor Gelişimi
        </h2>
        <div className="flex flex-wrap gap-3">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-fg-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="rgb(var(--muted))"
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="rgb(var(--muted))"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            width={34}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--surface))",
              border: "1px solid rgb(var(--border))",
              borderRadius: 10,
              color: "rgb(var(--text))",
              fontSize: 12,
            }}
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: s.color }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
