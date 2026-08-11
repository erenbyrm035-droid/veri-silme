"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, GripVertical, Pencil, Trash2, Bed, Settings2 } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Label } from "@/features/admin/components/ui/label";
import { Badge } from "@/features/admin/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/features/admin/components/ui/dialog";
import { ConfirmDialog } from "@/features/admin/features/users/ui/confirm-dialog";
import { BlockBadge } from "./badges";
import { ExerciseDialog } from "./exercise-dialog";
import { deleteExercise, reorderExercises, updateDay, deleteDay } from "../actions";
import type { ProgramDayWithExercises, WorkoutProgramExercise } from "@/lib/database.types";

function summary(ex: WorkoutProgramExercise): string {
  const parts: string[] = [];
  if (ex.sets) parts.push(`${ex.sets} set`);
  if (ex.reps) parts.push(ex.reps);
  if (ex.duration_sec) parts.push(`${ex.duration_sec}sn`);
  if (ex.rest_sec != null) parts.push(`${ex.rest_sec}sn dinlenme`);
  if (ex.rpe) parts.push(`RPE ${ex.rpe}`);
  return parts.join(" · ") || "—";
}

export function DayCard({ programId, day }: { programId: string; day: ProgramDayWithExercises }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [items, setItems] = React.useState(day.exercises);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editEx, setEditEx] = React.useState<WorkoutProgramExercise | null>(null);
  const [dayEdit, setDayEdit] = React.useState(false);
  const [confirmDelDay, setConfirmDelDay] = React.useState(false);
  const dragIndex = React.useRef<number | null>(null);

  React.useEffect(() => setItems(day.exercises), [day.exercises]);

  // Gün meta düzenleme state
  const [title, setTitle] = React.useState(day.title ?? "");
  const [focus, setFocus] = React.useState(day.focus ?? "");
  const [notes, setNotes] = React.useState(day.notes ?? "");
  const [isRest, setIsRest] = React.useState(day.is_rest);

  function onDrop(target: number) {
    const src = dragIndex.current;
    dragIndex.current = null;
    if (src == null || src === target) return;
    const next = [...items];
    const [moved] = next.splice(src, 1);
    next.splice(target, 0, moved);
    setItems(next);
    startTransition(async () => {
      await reorderExercises({ programId, dayId: day.id, orderedIds: next.map((e) => e.id) });
      router.refresh();
    });
  }

  function removeEx(id: string) {
    startTransition(async () => { await deleteExercise({ id, programId }); router.refresh(); });
  }
  function saveDay() {
    startTransition(async () => {
      await updateDay({ id: day.id, programId, title: title || null, focus: focus || null, notes: notes || null, is_rest: isRest });
      setDayEdit(false);
      router.refresh();
    });
  }

  return (
    <Card className={`p-4 ${day.is_rest ? "opacity-80" : ""}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            Gün {day.day}
            {day.is_rest && <Badge variant="outline"><Bed size={11} className="mr-1" /> Dinlenme</Badge>}
          </p>
          {(day.title || day.focus) && (
            <p className="truncate text-xs text-fg-muted">{day.title}{day.title && day.focus ? " · " : ""}{day.focus}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" size="icon" onClick={() => setDayEdit(true)} aria-label="Gün ayarları"><Settings2 size={15} /></Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelDay(true)} aria-label="Günü sil"><Trash2 size={15} /></Button>
        </div>
      </div>

      {!day.is_rest && (
        <>
          <div className="space-y-1.5">
            {items.length === 0 && <p className="py-2 text-xs text-fg-muted">Henüz egzersiz yok.</p>}
            {items.map((ex, i) => (
              <div
                key={ex.id}
                draggable
                onDragStart={() => (dragIndex.current = i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(i)}
                className="flex items-center gap-2 rounded-lg border border-ink-border bg-ink-soft/40 px-2 py-1.5"
              >
                <GripVertical size={14} className="shrink-0 cursor-grab text-fg-muted" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{ex.exercise_name}</p>
                    <BlockBadge type={ex.block_type} />
                  </div>
                  <p className="truncate text-xs text-fg-muted">{summary(ex)}</p>
                </div>
                <button onClick={() => setEditEx(ex)} className="text-fg-muted hover:text-brand" aria-label="Düzenle"><Pencil size={14} /></button>
                <button onClick={() => removeEx(ex.id)} disabled={isPending} className="text-fg-muted hover:text-coral" aria-label="Sil"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setAddOpen(true)}>
            <Plus size={15} /> Egzersiz Ekle
          </Button>
        </>
      )}

      <ExerciseDialog open={addOpen} onOpenChange={setAddOpen} programId={programId} dayId={day.id} />
      <ExerciseDialog open={!!editEx} onOpenChange={(o) => !o && setEditEx(null)} programId={programId} dayId={day.id} exercise={editEx} />

      {/* Gün meta düzenleme */}
      <Dialog open={dayEdit} onOpenChange={setDayEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gün {day.day} Ayarları</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Başlık</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Push" /></div>
            <div><Label>Odak</Label><Input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Göğüs / Omuz / Triceps" /></div>
            <div><Label>Notlar</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isRest} onChange={(e) => setIsRest(e.target.checked)} className="accent-brand" />
              Dinlenme günü
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDayEdit(false)}>Vazgeç</Button>
            <Button onClick={saveDay} disabled={isPending}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDelDay} onOpenChange={setConfirmDelDay}
        title={`Gün ${day.day} silinsin mi?`} description="Bu günün tüm egzersizleri de silinir."
        confirmLabel="Sil" destructive loading={isPending}
        onConfirm={() => startTransition(async () => { await deleteDay({ id: day.id, programId }); setConfirmDelDay(false); router.refresh(); })} />
    </Card>
  );
}
