import { Users, CheckCircle2, XCircle, Heart, Star, TrendingUp } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { formatNumber } from "@/lib/utils";
import type { WorkoutProgram } from "@/lib/database.types";
import type { RatingWithUser, FavoriteWithUser } from "../queries";

function fmt(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function ProgramStats({
  program, progress, ratings, favorites,
}: {
  program: WorkoutProgram;
  progress: { total: number; active: number; completed: number; abandoned: number };
  ratings: RatingWithUser[];
  favorites: FavoriteWithUser[];
}) {
  const cards = [
    { label: "Kullanan Kişi", value: progress.total, icon: Users },
    { label: "Tamamlama Oranı", value: `${program.completion_rate}%`, icon: TrendingUp },
    { label: "Tamamlayan", value: progress.completed, icon: CheckCircle2 },
    { label: "Bırakan", value: progress.abandoned, icon: XCircle },
    { label: "Favori", value: program.favorite_count, icon: Heart },
    { label: "Ortalama Puan", value: program.rating_count > 0 ? `${program.rating_avg} (${program.rating_count})` : "—", icon: Star },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-soft text-brand"><c.icon size={18} /></span>
            <p className="mt-3 text-2xl font-bold tracking-tight">{typeof c.value === "number" ? formatNumber(c.value) : c.value}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{c.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Star size={16} className="text-brand" /> Puanlar & Yorumlar</h3>
          <div className="mt-3 space-y-2">
            {ratings.length === 0 ? <p className="text-sm text-fg-muted">Henüz puan verilmemiş.</p> : ratings.map((r) => (
              <div key={r.id} className="rounded-xl border border-ink-border bg-ink-soft/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{r.user_name ?? "Kullanıcı"}</span>
                  <span className="inline-flex items-center gap-1 text-amber-400">
                    {"★".repeat(r.rating)}<span className="text-fg-muted">{"☆".repeat(5 - r.rating)}</span>
                  </span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-fg-muted">{r.comment}</p>}
                <p className="mt-1 text-xs text-fg-muted">{fmt(r.created_at)}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Heart size={16} className="text-brand" /> Favorileyen Kullanıcılar</h3>
          <div className="mt-3 space-y-1.5">
            {favorites.length === 0 ? (
              <EmptyState title="Favori yok" description="Bu programı henüz kimse favorilemedi." className="py-8" />
            ) : favorites.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-ink-border px-3 py-2">
                <span className="text-sm">{f.user_name ?? "Kullanıcı"}</span>
                <span className="text-xs text-fg-muted">{fmt(f.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
