"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import type { ChartPoint } from "../../lib/sample-data";

/** Placeholder alan grafiği (örnek veri; gerçek analytics sonraki sprintte). */
export function ChartPlaceholder({
  title,
  data,
  color = "#e7fb00",
}: {
  title: string;
  data: ChartPoint[];
  color?: string;
}) {
  const id = `grad-${title.replace(/\s+/g, "")}`;
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" className="text-[10px]">
          örnek veri
        </Badge>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
          <XAxis dataKey="label" stroke="rgb(var(--muted))" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="rgb(var(--muted))" fontSize={10} tickLine={false} axisLine={false} width={34} />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--surface))",
              border: "1px solid rgb(var(--border))",
              borderRadius: 10,
              color: "rgb(var(--text))",
              fontSize: 12,
            }}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
