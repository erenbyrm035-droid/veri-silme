import { cn } from "@/lib/utils";
import { Card } from "./Card";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  className?: string;
}

/** İlerleme / özet kartı. */
export function StatCard({
  label,
  value,
  unit,
  hint,
  icon,
  accent,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">
          {label}
        </span>
        {icon && <span className="text-fg-muted">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-2xl font-bold tracking-tight",
            accent ? "text-brand" : "text-fg"
          )}
        >
          {value}
        </span>
        {unit && <span className="text-sm text-fg-muted">{unit}</span>}
      </div>
      {hint && <span className="text-xs text-fg-muted">{hint}</span>}
    </Card>
  );
}
