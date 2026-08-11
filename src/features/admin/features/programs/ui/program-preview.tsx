import { Star, Clock, Flame, CalendarDays, Dumbbell } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { CoverThumb } from "./cover-thumb";
import { LevelBadge, GenderBadge, EnvBadge, BlockBadge } from "./badges";
import { CATEGORY_FALLBACK } from "../constants";
import type { WorkoutProgram, ProgramDayWithExercises } from "@/lib/database.types";

const CATEGORY_NAME = new Map(CATEGORY_FALLBACK.map((c) => [c.slug, c.name]));

/** Kullanıcının göreceği program ekranının admin önizlemesi. */
export function ProgramPreview({ program, tree }: { program: WorkoutProgram; tree: ProgramDayWithExercises[] }) {
  const weeks = [...new Set(tree.map((d) => d.week))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row">
          <CoverThumb url={program.cover_url} size={120} className="!h-32 !w-32 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">{program.name}</h2>
              <LevelBadge level={program.level} />
              <GenderBadge gender={program.gender} />
              <EnvBadge environment={program.environment} />
            </div>
            {program.short_description && <p className="mt-2 text-sm text-fg-muted">{program.short_description}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-fg-muted">
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {program.weeks} hafta · {program.days_per_week} gün</span>
              {program.est_minutes && <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {program.est_minutes} dk</span>}
              {program.calories && <span className="inline-flex items-center gap-1.5"><Flame size={14} /> {program.calories} kcal</span>}
              {program.rating_count > 0 && <span className="inline-flex items-center gap-1.5"><Star size={14} className="fill-amber-400 text-amber-400" /> {program.rating_avg} ({program.rating_count})</span>}
              {program.category && <span>{CATEGORY_NAME.get(program.category) ?? program.category}</span>}
            </div>
            {program.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {program.tags.map((t) => <span key={t} className="rounded-lg bg-ink-soft px-2 py-0.5 text-xs text-fg-muted">{t}</span>)}
              </div>
            )}
          </div>
        </div>
        {program.description && <div className="border-t border-ink-border px-5 py-4 text-sm text-fg-muted whitespace-pre-wrap">{program.description}</div>}
      </Card>

      {tree.length === 0 ? (
        <p className="text-sm text-fg-muted">Bu programda henüz gün/egzersiz yok.</p>
      ) : (
        weeks.map((w) => (
          <div key={w}>
            <h3 className="mb-2 text-sm font-bold">Hafta {w}</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tree.filter((d) => d.week === w).sort((a, b) => a.day - b.day).map((d) => (
                <Card key={d.id} className="p-4">
                  <p className="text-sm font-semibold">Gün {d.day}{d.title ? ` · ${d.title}` : ""}</p>
                  {d.focus && <p className="text-xs text-fg-muted">{d.focus}</p>}
                  {d.is_rest ? (
                    <p className="mt-2 text-sm text-fg-muted">Dinlenme günü</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {d.exercises.map((ex) => (
                        <li key={ex.id} className="flex items-center gap-2 text-sm">
                          <Dumbbell size={13} className="shrink-0 text-fg-muted" />
                          <span className="min-w-0 flex-1 truncate">{ex.exercise_name}</span>
                          <BlockBadge type={ex.block_type} />
                          <span className="shrink-0 text-xs text-fg-muted">{ex.sets ?? "-"}×{ex.reps ?? "-"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
