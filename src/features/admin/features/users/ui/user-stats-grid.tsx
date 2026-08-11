import {
  LogIn,
  Dumbbell,
  CheckCircle2,
  CalendarDays,
  Heart,
  MessageSquare,
  ScanLine,
  Apple,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { AdminUserStats } from "@/lib/database.types";

const ITEMS: { key: keyof AdminUserStats; label: string; icon: LucideIcon }[] = [
  { key: "totalLogins", label: "Toplam Giriş", icon: LogIn },
  { key: "totalWorkouts", label: "Toplam Antrenman", icon: Dumbbell },
  { key: "completedWorkouts", label: "Tamamlanan Antrenman", icon: CheckCircle2 },
  { key: "totalPrograms", label: "Oluşturulan Program", icon: CalendarDays },
  { key: "favoriteExercises", label: "Favori Egzersiz", icon: Heart },
  { key: "aiConversations", label: "AI Sohbeti", icon: MessageSquare },
  { key: "postureAnalyses", label: "Postür Analizi", icon: ScanLine },
  { key: "mealPlans", label: "Diyet Planı", icon: Apple },
];

export function UserStatsGrid({ stats }: { stats: AdminUserStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {ITEMS.map(({ key, label, icon: Icon }) => (
        <Card key={key} className="p-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-soft text-brand">
            <Icon size={18} />
          </span>
          <p className="mt-3 text-2xl font-bold tracking-tight">{formatNumber(stats[key])}</p>
          <p className="mt-0.5 text-xs text-fg-muted">{label}</p>
        </Card>
      ))}
    </div>
  );
}
