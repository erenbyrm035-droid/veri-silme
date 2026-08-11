"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/** Küçük alan grafiği (kilo/hacim trendi için). */
export function TrendChart({
  data,
  unit = "",
  color = "#d6f84c",
}: {
  data: { label: string; value: number }[];
  unit?: string;
  color?: string;
}) {
  if (data.length < 2) {
    return (
      <p className="py-6 text-center text-xs text-fg-muted">
        Grafik için en az 2 kayıt gerekli.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" stroke="rgb(var(--muted))" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis stroke="rgb(var(--muted))" fontSize={10} tickLine={false} axisLine={false} domain={["dataMin - 1", "dataMax + 1"]} width={34} />
        <Tooltip
          contentStyle={{
            background: "rgb(var(--surface))",
            border: "1px solid rgb(var(--border))",
            borderRadius: 10,
            color: "rgb(var(--text))",
            fontSize: 12,
          }}
          formatter={(v: number) => [`${v} ${unit}`, ""]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill="url(#trendfill)"
          dot={{ r: 2.5, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
