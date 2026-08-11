import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, CalendarDays, Flame, Dumbbell, Home, ChevronRight, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getReadyProgram, getMyProgramProgress } from "@/lib/data/ready-programs";
import { ReadyProgramStart } from "@/components/programs/ReadyProgramStart";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = { beginner: "Başlangıç", intermediate: "Orta", advanced: "İleri" };
const ENV_LABEL: Record<string, string> = { home: "Ev", gym: "Salon", both: "Ev/Salon" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getReadyProgram(slug);
  return { title: data ? `${data.program.name} · Viva` : "Program · Viva" };
}

export default async function ReadyProgramDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getReadyProgram(slug);
  if (!data) notFound();
  const { program: p, days } = data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const progress = user ? await getMyProgramProgress(user.id) : {};
  const active = progress[p.id]?.status === "active";

  return (
    <div className="space-y-5">
      <Link href="/programs/hazir" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft size={16} /> Hazır Programlar
      </Link>

      <header className="space-y-3">
        <h1 className="text-xl font-bold sm:text-2xl">{p.name}</h1>
        {p.short_description && <p className="text-sm text-fg-muted">{p.short_description}</p>}

        <div className="flex flex-wrap gap-2">
          <Meta icon={<CalendarDays size={13} />} text={`${p.weeks} hafta · ${p.days_per_week} gün/hafta`} />
          {p.est_minutes ? <Meta icon={<Clock size={13} />} text={`${p.est_minutes} dk/gün`} /> : null}
          {p.calories ? <Meta icon={<Flame size={13} />} text={`~${p.calories} kcal`} /> : null}
          <Meta icon={p.environment === "gym" ? <Dumbbell size={13} /> : <Home size={13} />} text={ENV_LABEL[p.environment] ?? p.environment} />
          <Meta text={LEVEL_LABEL[p.level] ?? p.level} />
        </div>
      </header>

      <ReadyProgramStart programId={p.id} slug={p.slug} active={active} />

      {p.description && (
        <div className="rounded-2xl border border-ink-border bg-ink-card p-4">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.description}</p>
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fg-muted">Haftalık Plan</h2>
        {days.map((d) => (
          <div key={d.id} className="overflow-hidden rounded-2xl border border-ink-border bg-ink-card">
            <div className="flex items-center justify-between border-b border-ink-border px-4 py-3">
              <div>
                <p className="font-bold">{d.day}. Gün{d.title ? ` · ${d.title}` : ""}</p>
                {d.focus && <p className="text-xs text-fg-muted">{d.focus}</p>}
              </div>
              <span className="text-[11px] text-fg-muted">{d.exercises.length} hareket</span>
            </div>
            <ul className="divide-y divide-ink-border">
              {d.exercises.map((ex, i) => {
                const inner = (
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ex.exercise_name}</p>
                      <p className="text-[11px] text-fg-muted">
                        {ex.sets ? `${ex.sets} set` : ""}{ex.sets && ex.reps ? " × " : ""}{ex.reps ?? ""}
                        {ex.rest_sec ? ` · ${ex.rest_sec} sn dinlenme` : ""}
                      </p>
                    </div>
                    {ex.exercise_id && <ChevronRight size={16} className="shrink-0 text-fg-muted" />}
                  </div>
                );
                return (
                  <li key={i}>
                    {ex.exercise_id ? (
                      <Link href={`/exercises/${ex.exercise_id}`} className="block transition-colors hover:bg-ink-soft">{inner}</Link>
                    ) : inner}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <div className="flex items-start gap-2 rounded-xl bg-ink-soft px-4 py-3 text-xs text-fg-muted">
        <Info size={15} className="mt-0.5 shrink-0" />
        <p>Bu haftalık planı programın süresi ({p.weeks} hafta) boyunca tekrarla. Her hafta tekrar, süre veya ağırlığı kademeli artırarak ilerle.</p>
      </div>
    </div>
  );
}

function Meta({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1 rounded-lg bg-ink-soft px-2.5 py-1 text-[11px] font-medium text-fg-muted">
      {icon} {text}
    </span>
  );
}
