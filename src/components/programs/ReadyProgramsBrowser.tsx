"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Clock, CalendarDays, Flame, Dumbbell, Home, Star, CheckCircle2 } from "lucide-react";
import type { ReadyProgram, ProgramCategory } from "@/lib/data/ready-programs";

const LEVEL_LABEL: Record<string, string> = { beginner: "Başlangıç", intermediate: "Orta", advanced: "İleri" };
const ENV_LABEL: Record<string, string> = { home: "Ev", gym: "Salon", both: "Ev/Salon" };
const CAT_EMOJI: Record<string, string> = {
  pilates: "🧘‍♀️", yoga: "🧘", mobility: "🤸", flexibility: "🙆", wellness: "🌿",
  functional: "⚡", hiit: "🔥", calisthenics: "💪", strength: "🏋️", muscle_gain: "💪",
  weight_loss: "⚖️", fat_burn: "🔥", crossfit: "🏋️", powerlifting: "🏋️", bodybuilding: "💪",
};

export function ReadyProgramsBrowser({
  programs, categories, progress,
}: {
  programs: ReadyProgram[];
  categories: ProgramCategory[];
  progress: Record<string, { status: string; progress_pct: number }>;
}) {
  const [cat, setCat] = useState<string>("all");

  // Sadece programlarda geçen kategorileri göster.
  const used = useMemo(() => new Set(programs.map((p) => p.category).filter(Boolean) as string[]), [programs]);
  const chips = useMemo(
    () => [{ slug: "all", name: "Tümü" }, ...categories.filter((c) => used.has(c.slug))],
    [categories, used]
  );

  const list = cat === "all" ? programs : programs.filter((p) => p.category === cat);

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <button
            key={c.slug}
            onClick={() => setCat(c.slug)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              cat === c.slug ? "bg-brand text-black" : "bg-ink-soft text-fg-muted hover:text-fg"
            )}
          >
            {c.slug !== "all" && <span className="mr-1">{CAT_EMOJI[c.slug] ?? "•"}</span>}
            {c.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => {
          const prog = progress[p.id];
          return (
            <Link key={p.id} href={`/programs/hazir/${p.slug}`}
              className="group flex flex-col rounded-2xl border border-ink-border bg-ink-card p-4 transition-colors hover:border-brand/50">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand/12 text-2xl">
                  {CAT_EMOJI[p.category ?? ""] ?? "🏋️"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold leading-tight">{p.name}</p>
                    {prog?.status === "active" && (
                      <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand">Aktif</span>
                    )}
                    {prog?.status === "completed" && <CheckCircle2 size={15} className="shrink-0 text-brand" />}
                  </div>
                  {p.short_description && <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{p.short_description}</p>}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-muted">
                <span className="flex items-center gap-1"><CalendarDays size={12} /> {p.weeks} hafta · {p.days_per_week} gün</span>
                {p.est_minutes ? <span className="flex items-center gap-1"><Clock size={12} /> {p.est_minutes} dk</span> : null}
                {p.calories ? <span className="flex items-center gap-1"><Flame size={12} /> ~{p.calories} kcal</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-ink-soft px-2 py-0.5 text-[10px] font-medium">{LEVEL_LABEL[p.level] ?? p.level}</span>
                <span className="flex items-center gap-1 rounded-md bg-ink-soft px-2 py-0.5 text-[10px] font-medium">
                  {p.environment === "gym" ? <Dumbbell size={10} /> : <Home size={10} />} {ENV_LABEL[p.environment] ?? p.environment}
                </span>
                {p.rating_count > 0 && (
                  <span className="flex items-center gap-1 rounded-md bg-ink-soft px-2 py-0.5 text-[10px] font-medium">
                    <Star size={10} className="text-brand" /> {p.rating_avg.toFixed(1)}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {list.length === 0 && <p className="py-10 text-center text-sm text-fg-muted">Bu kategoride program bulunamadı.</p>}
    </div>
  );
}
