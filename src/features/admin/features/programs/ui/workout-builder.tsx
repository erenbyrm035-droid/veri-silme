"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, CalendarDays } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { DayCard } from "./day-card";
import { addDay } from "../actions";
import type { ProgramDayWithExercises } from "@/lib/database.types";

export function WorkoutBuilder({
  programId, weeks, daysPerWeek, tree,
}: {
  programId: string;
  weeks: number;
  daysPerWeek: number;
  tree: ProgramDayWithExercises[];
}) {
  const router = useRouter();
  const [week, setWeek] = React.useState(1);
  const [isPending, startTransition] = React.useTransition();

  const weekDays = tree.filter((d) => d.week === week).sort((a, b) => a.day - b.day);
  const maxDay = Math.max(daysPerWeek, ...weekDays.map((d) => d.day), 0);
  const slots = Array.from({ length: maxDay }, (_, i) => i + 1);

  function createDay(day: number, isRest = false) {
    startTransition(async () => {
      await addDay({ programId, week, day, is_rest: isRest });
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-brand" />
        <h3 className="text-sm font-semibold">Program Takvimi & Workout Builder</h3>
      </div>

      {/* Hafta seçici */}
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: weeks }, (_, i) => i + 1).map((w) => {
          const has = tree.some((d) => d.week === w);
          return (
            <button key={w} onClick={() => setWeek(w)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                w === week ? "bg-brand text-black" : has ? "bg-ink-soft text-fg" : "bg-ink-soft/50 text-fg-muted"
              }`}>
              Hafta {w}
            </button>
          );
        })}
      </div>

      {/* Günler */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {slots.map((dayNum) => {
          const existing = weekDays.find((d) => d.day === dayNum);
          if (existing) return <DayCard key={existing.id} programId={programId} day={existing} />;
          return (
            <div key={dayNum} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink-border bg-ink-card/40 p-6 text-center">
              <p className="text-sm font-medium text-fg-muted">Gün {dayNum}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => createDay(dayNum)}><Plus size={14} /> Antrenman</Button>
                <Button size="sm" variant="ghost" disabled={isPending} onClick={() => createDay(dayNum, true)}>Dinlenme</Button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-center rounded-2xl border border-dashed border-ink-border bg-ink-card/40 p-6">
          <Button size="sm" variant="ghost" disabled={isPending} onClick={() => createDay(maxDay + 1)}>
            <Plus size={14} /> Gün Ekle
          </Button>
        </div>
      </div>
    </Card>
  );
}
