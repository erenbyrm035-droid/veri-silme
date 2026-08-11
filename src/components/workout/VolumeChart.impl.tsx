"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { WeekVolume } from "@/lib/data/workouts";
import { formatNumber } from "@/lib/utils";

/** Haftalık antrenman hacmi (tonaj) grafiği. */
export function VolumeChart({ data }: { data: WeekVolume[] }) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-fg-muted">
        Hacim grafiği için birkaç antrenman daha kaydet.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
        <XAxis dataKey="label" stroke="rgb(var(--muted))" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="rgb(var(--muted))" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: "rgb(var(--brand) / 0.08)" }}
          contentStyle={{
            background: "rgb(var(--surface))",
            border: "1px solid rgb(var(--border))",
            borderRadius: 12,
            color: "rgb(var(--text))",
            fontSize: 12,
          }}
          formatter={(v: number, _n, p) => [
            `${formatNumber(v)} kg · ${(p?.payload as WeekVolume).sets} set`,
            "Hacim",
          ]}
        />
        <Bar dataKey="volume" fill="rgb(var(--brand))" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
