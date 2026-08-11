"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Link2, Search } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Select } from "@/features/admin/components/ui/select";
import { Input } from "@/features/admin/components/ui/input";
import { Badge } from "@/features/admin/components/ui/badge";
import { RELATION_LABELS, RELATION_VALUES } from "../constants";
import { addRelation, removeRelation } from "../actions";
import { searchExercisesAction } from "../search-action";
import type { ExerciseRelationType } from "@/lib/database.types";
import type { RelationWithTarget } from "../queries";

export function RelationManager({
  exerciseId,
  relations,
}: {
  exerciseId: string;
  relations: RelationWithTarget[];
}) {
  const router = useRouter();
  const [relation, setRelation] = React.useState<ExerciseRelationType>("alternative");
  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; name: string; slug: string | null }[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return; }
    const id = setTimeout(async () => {
      const r = await searchExercisesAction(term, exerciseId);
      setResults(r);
    }, 300);
    return () => clearTimeout(id);
  }, [term, exerciseId]);

  function add(relatedId: string) {
    setError(null);
    startTransition(async () => {
      const res = await addRelation({ exerciseId, relatedId, relation });
      if (!res.ok) return setError(res.error ?? "Eklenemedi.");
      setTerm("");
      setResults([]);
      router.refresh();
    });
  }
  function remove(id: string) {
    startTransition(async () => {
      await removeRelation({ id, exerciseId });
      router.refresh();
    });
  }

  const grouped = RELATION_VALUES.map((rel) => ({
    rel,
    items: relations.filter((r) => r.relation === rel),
  })).filter((g) => g.items.length > 0);

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Link2 size={16} className="text-brand" /> İlişkili Egzersizler
      </h3>
      <p className="text-xs text-fg-muted">
        Öneri sistemi için: alternatif, daha kolay/zor, aynı kas/patern/ekipman.
      </p>

      <div className="flex flex-wrap gap-2">
        <div className="w-44">
          <Select value={relation} onChange={(e) => setRelation(e.target.value as ExerciseRelationType)}>
            {RELATION_VALUES.map((r) => <option key={r} value={r}>{RELATION_LABELS[r]}</option>)}
          </Select>
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Egzersiz ara…" className="pl-9" />
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-ink-border bg-ink-card p-1 shadow-xl">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => add(r.id)}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-fg/5"
                >
                  <Plus size={14} className="text-fg-muted" /> {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="space-y-3">
        {grouped.length === 0 && <p className="text-sm text-fg-muted">Henüz ilişki eklenmemiş.</p>}
        {grouped.map((g) => (
          <div key={g.rel}>
            <p className="mb-1.5 text-xs font-semibold text-fg-muted">
              {RELATION_LABELS[g.rel]} <Badge variant="secondary">{g.items.length}</Badge>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((it) => (
                <span key={it.id} className="inline-flex items-center gap-1 rounded-lg bg-ink-soft px-2 py-1 text-xs font-medium">
                  {it.related_name}
                  <button onClick={() => remove(it.id)} className="text-fg-muted hover:text-coral"><X size={12} /></button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
