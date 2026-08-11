"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Save } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Select } from "@/features/admin/components/ui/select";
import { Badge } from "@/features/admin/components/ui/badge";
import { setExerciseMuscles } from "../actions";
import type { ExerciseMuscleLink, MuscleRole } from "@/lib/database.types";

interface MuscleOption {
  id: string;
  slug: string;
  name_tr: string;
  region: string;
  muscle_group: string;
}
interface Selected {
  muscle_id: string | null;
  muscle_name: string;
  role: MuscleRole;
}

const REGION_COLOR: Record<string, string> = {
  front: "bg-brand/15 text-brand",
  back: "bg-sky-500/15 text-sky-400",
};

export function MuscleSelector({
  exerciseId,
  initial,
  muscles,
}: {
  exerciseId: string;
  initial: ExerciseMuscleLink[];
  muscles: MuscleOption[];
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<Selected[]>(
    initial.map((m) => ({ muscle_id: m.muscle_id, muscle_name: m.muscle_name ?? "", role: m.role }))
  );
  const [pick, setPick] = React.useState("");
  const [role, setRole] = React.useState<MuscleRole>("primary");
  const [isPending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);

  function add() {
    if (!pick) return;
    const m = muscles.find((x) => x.id === pick);
    if (!m) return;
    if (items.some((i) => i.muscle_id === m.id && i.role === role)) return;
    setItems([...items, { muscle_id: m.id, muscle_name: m.name_tr, role }]);
    setPick("");
    setSaved(false);
  }
  function remove(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await setExerciseMuscles({
        exerciseId,
        muscles: items.map((i) => ({ muscle_id: i.muscle_id, muscle_name: i.muscle_name, role: i.role })),
      });
      setSaved(true);
      router.refresh();
    });
  }

  const groups = muscles.reduce<Record<string, MuscleOption[]>>((acc, m) => {
    (acc[m.muscle_group] ??= []).push(m);
    return acc;
  }, {});

  const primary = items.filter((i) => i.role === "primary");
  const secondary = items.filter((i) => i.role === "secondary");

  function renderChips(list: Selected[]) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {list.length === 0 && <span className="text-xs text-fg-muted">Seçilmedi</span>}
        {list.map((i) => {
          const region = muscles.find((m) => m.id === i.muscle_id)?.region ?? "front";
          const idx = items.indexOf(i);
          return (
            <span key={`${i.muscle_id}-${i.role}`} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${REGION_COLOR[region] ?? "bg-ink-soft"}`}>
              {i.muscle_name}
              <button onClick={() => remove(idx)} className="opacity-70 hover:opacity-100"><X size={12} /></button>
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Kas Haritası / Seçici</h3>
        <Button size="sm" onClick={save} disabled={isPending}>
          <Save size={15} /> {isPending ? "Kaydediliyor…" : saved ? "Kaydedildi" : "Kaydet"}
        </Button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-fg-muted">Ana Kaslar</p>
        {renderChips(primary)}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-fg-muted">İkincil Kaslar</p>
        {renderChips(secondary)}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-ink-border pt-4">
        <div className="min-w-[180px] flex-1">
          <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Kas seç">
            <option value="">Kas seç…</option>
            {Object.entries(groups).map(([g, list]) => (
              <optgroup key={g} label={g}>
                {list.map((m) => <option key={m.id} value={m.id}>{m.name_tr}</option>)}
              </optgroup>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select value={role} onChange={(e) => setRole(e.target.value as MuscleRole)} aria-label="Rol">
            <option value="primary">Ana</option>
            <option value="secondary">İkincil</option>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={add}><Plus size={15} /> Ekle</Button>
      </div>
      {muscles.length === 0 && (
        <Badge variant="warning">Kas kütüphanesi boş — muscles tablosu seed edilmeli.</Badge>
      )}
    </Card>
  );
}
