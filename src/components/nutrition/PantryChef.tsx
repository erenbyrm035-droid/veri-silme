"use client";

import * as React from "react";
import { Refrigerator, Plus, X, ChefHat, Check } from "lucide-react";
import { suggestFromPantry, logRecipe, type PantryMatch } from "@/lib/nutrition/dietitian-actions";

export function PantryChef() {
  const [items, setItems] = React.useState<string[]>([]);
  const [input, setInput] = React.useState("");
  const [matches, setMatches] = React.useState<PantryMatch[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function add() {
    const v = input.trim();
    if (v && !items.includes(v)) setItems((x) => [...x, v]);
    setInput("");
  }
  function find() {
    if (items.length === 0) return;
    setError(null);
    start(async () => {
      const res = await suggestFromPantry(items);
      if (!res.ok) return setError(res.error ?? "Öneri alınamadı.");
      setMatches(res.data ?? []);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-border bg-ink-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Refrigerator size={16} className="text-brand" /> Dolabımdakiler</h3>
        <p className="mt-1 text-xs text-fg-muted">Elindeki malzemeleri ekle; mevcut tariflerden yapabileceklerini ve eksik malzemeleri göstereyim.</p>
        <div className="mt-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
            placeholder="tavuk, pirinç, yoğurt…"
            className="flex-1 rounded-xl border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-brand" />
          <button onClick={add} className="rounded-xl bg-ink-soft px-3 py-2 text-sm font-semibold"><Plus size={16} /></button>
        </div>
        {items.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {items.map((it) => (
              <span key={it} className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-brand">
                {it}<button onClick={() => setItems((x) => x.filter((y) => y !== it))}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <button onClick={find} disabled={pending || items.length === 0} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
          <ChefHat size={15} /> {pending ? "Aranıyor…" : "Tarif Bul"}
        </button>
        {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      </div>

      {matches && matches.length === 0 && (
        <p className="rounded-2xl border border-dashed border-ink-border bg-ink-card p-6 text-center text-sm text-fg-muted">
          Bu malzemelerle eşleşen tarif bulunamadı. Farklı malzemeler dene.
        </p>
      )}
      {matches && matches.map((m) => (
        <div key={m.recipe_id} className="rounded-2xl border border-ink-border bg-ink-card p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{m.title}</h4>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">%{Math.round(m.coverage * 100)} uyum</span>
          </div>
          <p className="mt-2 flex flex-wrap gap-1 text-xs">
            {m.matched.map((x) => <span key={x} className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400"><Check size={10} /> {x}</span>)}
          </p>
          {m.missing.length > 0 && (
            <p className="mt-1.5 text-xs text-fg-muted">Eksik: {m.missing.join(", ")}</p>
          )}
          <button onClick={() => logRecipe(m.recipe_id, m.title, "pantry")} className="mt-2 text-xs font-semibold text-brand">Bunu yapacağım ✓</button>
        </div>
      ))}
    </div>
  );
}
