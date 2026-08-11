import {
  LogIn,
  CalendarDays,
  MessageSquare,
  ScanLine,
  Apple,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { formatDateTime } from "./format";
import type { AdminUserActivityItem } from "@/lib/database.types";

const ICONS: Record<AdminUserActivityItem["kind"], LucideIcon> = {
  login: LogIn,
  program: CalendarDays,
  ai_chat: MessageSquare,
  posture: ScanLine,
  meal_plan: Apple,
  workout: Dumbbell,
};

export function UserActivity({ items }: { items: AdminUserActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Aktivite yok"
        description="Bu kullanıcı için henüz kayıtlı aktivite bulunmuyor."
      />
    );
  }
  return (
    <ol className="relative space-y-1 pl-2">
      {items.map((item, i) => {
        const Icon = ICONS[item.kind];
        return (
          <li key={i} className="flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-fg/[0.02]">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-soft text-fg-muted">
              <Icon size={15} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="text-xs text-fg-muted">{formatDateTime(item.created_at)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
