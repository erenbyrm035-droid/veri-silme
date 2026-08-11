"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/features/admin/components/ui/dialog";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Textarea } from "@/features/admin/components/ui/textarea";
import { Select } from "@/features/admin/components/ui/select";
import { Label } from "@/features/admin/components/ui/label";
import { BLOCK_LABELS, BLOCK_VALUES } from "../constants";
import { addExercise, updateExercise } from "../actions";
import { searchExerciseAction } from "../search-action";
import type { WorkoutProgramExercise, ProgramBlockType } from "@/lib/database.types";

interface FormState {
  exercise_id: string | null;
  exercise_name: string;
  block_type: ProgramBlockType;
  block_group: number;
  sets: string;
  reps: string;
  duration_sec: string;
  rest_sec: string;
  tempo: string;
  rpe: string;
  rir: string;
  note: string;
}

function initial(ex?: WorkoutProgramExercise | null): FormState {
  return {
    exercise_id: ex?.exercise_id ?? null,
    exercise_name: ex?.exercise_name ?? "",
    block_type: ex?.block_type ?? "normal",
    block_group: ex?.block_group ?? 0,
    sets: ex?.sets != null ? String(ex.sets) : "",
    reps: ex?.reps ?? "",
    duration_sec: ex?.duration_sec != null ? String(ex.duration_sec) : "",
    rest_sec: ex?.rest_sec != null ? String(ex.rest_sec) : "",
    tempo: ex?.tempo ?? "",
    rpe: ex?.rpe != null ? String(ex.rpe) : "",
    rir: ex?.rir != null ? String(ex.rir) : "",
    note: ex?.note ?? "",
  };
}

export function ExerciseDialog({
  open, onOpenChange, programId, dayId, exercise,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  programId: string;
  dayId: string;
  exercise?: WorkoutProgramExercise | null;
}) {
  const router = useRouter();
  const isEdit = !!exercise;
  const [form, setForm] = React.useState<FormState>(initial(exercise));
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { if (open) { setForm(initial(exercise)); setResults([]); setError(null); } }, [open, exercise]);

  React.useEffect(() => {
    if (form.exercise_name.trim().length < 2 || form.exercise_id) { setResults([]); return; }
    const id = setTimeout(async () => setResults(await searchExerciseAction(form.exercise_name)), 300);
    return () => clearTimeout(id);
  }, [form.exercise_name, form.exercise_id]);

  const set = (k: keyof FormState, v: string | number | null) => setForm((f) => ({ ...f, [k]: v }));

  function save() {
    setError(null);
    const payload = {
      dayId, programId,
      exercise_id: form.exercise_id,
      exercise_name: form.exercise_name.trim(),
      block_type: form.block_type,
      block_group: form.block_group,
      sets: form.sets ? Number(form.sets) : null,
      reps: form.reps || null,
      duration_sec: form.duration_sec ? Number(form.duration_sec) : null,
      rest_sec: form.rest_sec ? Number(form.rest_sec) : null,
      tempo: form.tempo || null,
      rpe: form.rpe ? Number(form.rpe) : null,
      rir: form.rir ? Number(form.rir) : null,
      note: form.note || null,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateExercise({ ...payload, id: exercise!.id })
        : await addExercise(payload);
      if (!res.ok) return setError(res.error ?? "Kaydedilemedi.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Egzersizi Düzenle" : "Egzersiz Ekle"}</DialogTitle>
          <DialogDescription>Kütüphaneden ara veya elle ad gir; set/tekrar/dinlenme belirle.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Label>Egzersiz Adı</Label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
              <Input
                value={form.exercise_name}
                onChange={(e) => { set("exercise_name", e.target.value); set("exercise_id", null); }}
                placeholder="Bench Press"
                className="pl-9"
              />
            </div>
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink-border bg-ink-card p-1 shadow-xl">
                {results.map((r) => (
                  <button key={r.id} onClick={() => { set("exercise_name", r.name); set("exercise_id", r.id); setResults([]); }}
                    className="block w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-fg/5">{r.name}</button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Blok Tipi</Label>
              <Select value={form.block_type} onChange={(e) => set("block_type", e.target.value)}>
                {BLOCK_VALUES.map((b) => <option key={b} value={b}>{BLOCK_LABELS[b]}</option>)}
              </Select>
            </div>
            <div>
              <Label>Blok Grubu (superset eşleştirme)</Label>
              <Input type="number" value={form.block_group} onChange={(e) => set("block_group", Number(e.target.value))} />
            </div>
            <div><Label>Set</Label><Input type="number" value={form.sets} onChange={(e) => set("sets", e.target.value)} placeholder="4" /></div>
            <div><Label>Tekrar</Label><Input value={form.reps} onChange={(e) => set("reps", e.target.value)} placeholder="8-10" /></div>
            <div><Label>Süre (sn)</Label><Input type="number" value={form.duration_sec} onChange={(e) => set("duration_sec", e.target.value)} placeholder="0" /></div>
            <div><Label>Dinlenme (sn)</Label><Input type="number" value={form.rest_sec} onChange={(e) => set("rest_sec", e.target.value)} placeholder="90" /></div>
            <div><Label>Tempo</Label><Input value={form.tempo} onChange={(e) => set("tempo", e.target.value)} placeholder="2-0-1-0" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>RPE</Label><Input type="number" value={form.rpe} onChange={(e) => set("rpe", e.target.value)} placeholder="8" /></div>
              <div><Label>RIR</Label><Input type="number" value={form.rir} onChange={(e) => set("rir", e.target.value)} placeholder="2" /></div>
            </div>
          </div>
          <div><Label>Not</Label><Textarea value={form.note} onChange={(e) => set("note", e.target.value)} /></div>
          {error && <p className="text-sm text-coral">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Vazgeç</Button>
          <Button onClick={save} disabled={isPending || !form.exercise_name.trim()}>{isPending ? "Kaydediliyor…" : "Kaydet"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
