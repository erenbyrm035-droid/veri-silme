import {
  Users,
  Crown,
  Dumbbell,
  CalendarDays,
  Film,
  Apple,
  Brain,
  TrendingUp,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Card } from "../ui/card";
import type { AdminStat } from "../../lib/sample-data";

const ICONS: Record<string, LucideIcon> = {
  users: Users,
  crown: Crown,
  dumbbell: Dumbbell,
  calendar: CalendarDays,
  film: Film,
  apple: Apple,
  brain: Brain,
};

export function StatCard({ stat }: { stat: AdminStat }) {
  const Icon = ICONS[stat.icon] ?? Users;
  const up = stat.delta >= 0;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand">
          <Icon size={19} />
        </span>
        {stat.delta !== 0 && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              up ? "bg-emerald-500/15 text-emerald-400" : "bg-coral/15 text-coral"
            }`}
          >
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(stat.delta)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">
        {stat.value.toLocaleString("tr-TR")}
      </p>
      <p className="mt-0.5 text-sm text-fg-muted">{stat.label}</p>
    </Card>
  );
}
