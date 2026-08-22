import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProgramById } from "@/lib/data/programs";
import { Card } from "@/components/ui/Card";
import { StartDayButton } from "@/components/programs/StartDayButton";
import { ArrowLeft, CalendarDays, Dumbbell } from "lucide-react";
import type { ProgramWeek } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const program = await getProgramById(id, user.id);
  if (!program) notFound();

  const weeks: ProgramWeek[] = program.plan?.weeks ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/programs"
        className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft size={16} /> Programlar
      </Link>

      <header>
        <span className="text-xs font-semibold uppercase tracking-wide text-coral">
          {program.goal}
        </span>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <CalendarDays size={22} className="text-brand" /> {program.title}
        </h1>
      </header>

      {weeks.length === 0 ? (
        <Card className="py-8 text-center text-sm text-fg-muted">
          Bu program için detay bulunamadı.
        </Card>
      ) : (
        <div className="space-y-4">
          {weeks.map((w) => (
            <Card key={w.week} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
                  {w.week}
                </span>
                <div>
                  <p className="font-semibold">{w.week}. Hafta</p>
                  <p className="text-xs text-fg-muted">{w.focus}</p>
                </div>
              </div>

              <div className="space-y-2">
                {w.days.map((d, di) => (
                  <div key={di} className="rounded-xl bg-ink-soft p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Dumbbell size={14} className="text-brand" /> {d.day} · {d.focus}
                    </p>
                    <div className="space-y-1">
                      {d.exercises.map((ex, ei) => (
                        <div
                          key={ei}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>{ex.name}</span>
                          <span className="tabular-nums text-fg-muted">
                            {ex.sets} × {ex.reps}
                          </span>
                        </div>
                      ))}
                    </div>
                    {w.week === 1 && (
                      <div className="mt-3">
                        <StartDayButton day={d} userId={user.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
