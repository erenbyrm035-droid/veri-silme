"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, X, Utensils } from "lucide-react";

interface FoodHit {
  id: string; name: string; brand: string | null; category: string | null;
  calories: number; protein_g: number; carbs_g: number; fat_g: number;
  serving_grams: number | null; serving_desc: string | null;
}
interface Row { food: FoodHit; grams: number }

/**
 * Yemek Oluşturucu — bulanık arama ile besin ekle, gram gir, makrolar otomatik
 * toplansın. "100 g tavuk + 200 g pilav + 1 kase yoğurt" senaryosu.
 */
export function MealBuilder() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [ms, setMs] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits([]); setMs(null); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(q)}&limit=12`);
        const data = await res.json();
        setHits(data.results ?? []);
        setMs(data.ms ?? null);
      } catch { setHits([]); }
      setSearching(false);
    }, 180);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  function addFood(f: FoodHit) {
    setRows((r) => [...r, { food: f, grams: f.serving_grams ?? 100 }]);
    setQ(""); setHits([]);
  }
  function setGrams(i: number, g: number) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, grams: Math.max(0, g) } : row)));
  }
  function remove(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }

  const totals = rows.reduce((t, { food, grams }) => {
    const k = grams / 100;
    return {
      cal: t.cal + food.calories * k, p: t.p + food.protein_g * k,
      c: t.c + food.carbs_g * k, f: t.f + food.fat_g * k,
    };
  }, { cal: 0, p: 0, c: 0, f: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Utensils size={18} className="text-brand" />
        <h3 className="font-semibold">Yemek Oluşturucu</h3>
      </div>

      {/* Arama */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-ink-border bg-ink-soft px-3">
          <Search size={16} className="text-fg-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Besin ara (ör. tvk, pilav, whey)…"
            className="w-full bg-transparent py-2.5 text-sm outline-none" />
          {ms != null && <span className="shrink-0 text-[11px] text-fg-muted">{ms}ms</span>}
        </div>
        {hits.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-ink-border bg-ink-card shadow-xl">
            {hits.map((f) => (
              <button key={f.id} onClick={() => addFood(f)}
                className="flex w-full items-center justify-between gap-2 border-b border-ink-border/50 px-3 py-2 text-left last:border-0 hover:bg-ink-soft">
                <div className="min-w-0">
                  <p className="truncate text-sm">{f.name}{f.brand ? <span className="text-fg-muted"> · {f.brand}</span> : ""}</p>
                  <p className="text-[11px] text-fg-muted">{Math.round(f.calories)} kcal · P{f.protein_g} K{f.carbs_g} Y{f.fat_g} / 100g</p>
                </div>
                <Plus size={16} className="shrink-0 text-brand" />
              </button>
            ))}
          </div>
        )}
        {searching && q.length >= 2 && hits.length === 0 && (
          <p className="mt-1 px-1 text-xs text-fg-muted">Aranıyor…</p>
        )}
      </div>

      {/* Eklenen besinler */}
      {rows.length > 0 ? (
        <div className="space-y-2">
          {rows.map((row, i) => {
            const k = row.grams / 100;
            return (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-ink-border bg-ink-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{row.food.name}</p>
                  <p className="text-[11px] text-fg-muted">{Math.round(row.food.calories * k)} kcal · P{Math.round(row.food.protein_g * k)} K{Math.round(row.food.carbs_g * k)} Y{Math.round(row.food.fat_g * k)}</p>
                </div>
                <input type="number" value={row.grams} onChange={(e) => setGrams(i, Number(e.target.value))}
                  className="w-16 rounded-lg border border-ink-border bg-ink-soft px-2 py-1 text-right text-sm" />
                <span className="text-xs text-fg-muted">g</span>
                <button onClick={() => remove(i)} className="text-fg-muted hover:text-coral" aria-label="Kaldır"><X size={16} /></button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-ink-soft px-4 py-6 text-center text-sm text-fg-muted">
          Besin arayıp ekle; toplam makrolar burada otomatik hesaplanır.
        </p>
      )}

      {/* Toplam */}
      {rows.length > 0 && (
        <div className="grid grid-cols-4 gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3 text-center">
          <Stat label="Kalori" value={`${Math.round(totals.cal)}`} unit="kcal" />
          <Stat label="Protein" value={`${Math.round(totals.p)}`} unit="g" />
          <Stat label="Karb" value={`${Math.round(totals.c)}`} unit="g" />
          <Stat label="Yağ" value={`${Math.round(totals.f)}`} unit="g" />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <p className="text-lg font-bold text-brand">{value}</p>
      <p className="text-[11px] text-fg-muted">{label} ({unit})</p>
    </div>
  );
}
