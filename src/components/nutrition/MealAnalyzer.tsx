"use client";

import * as React from "react";
import { Sparkles, Send, TrendingUp, Lightbulb } from "lucide-react";
import { analyzeMealText } from "@/lib/nutrition/dietitian-actions";
import type { MealAnalysis } from "@/lib/database.types";
import { NutritionDisclaimer } from "./NutritionDisclaimer";

const EXAMPLES = ["Kahvaltıda simit ve çay", "Öğlen tavuk pilav", "2 yumurta ve yoğurt"];

export function MealAnalyzer() {
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<MealAnalysis | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  function analyze(input?: string) {
    const value = (input ?? text).trim();
    if (value.length < 2) return;
    setError(null);
    start(async () => {
      const res = await analyzeMealText(value);
      if (!res.ok) return setError(res.error ?? "Analiz yapılamadı.");
      setResult(res.data ?? null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-border bg-ink-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-brand" /> Akıllı Öğün Analizi</h3>
        <p className="mt-1 text-xs text-fg-muted">Ne yediğini yaz; makroları, protein ve besin dengesini analiz edip daha iyi alternatifler önereyim.</p>
        <div className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="Örn: kahvaltıda simit yedim"
            className="flex-1 rounded-xl border border-ink-border bg-ink-soft px-3 py-2 text-sm outline-none focus:border-brand" />
          <button onClick={() => analyze()} disabled={pending} className="inline-flex items-center gap-1 rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-black disabled:opacity-50">
            <Send size={15} /> Analiz
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => { setText(e); analyze(e); }} className="rounded-full bg-ink-soft px-2.5 py-1 text-xs text-fg-muted hover:text-fg">{e}</button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm text-coral">{error}</p>}
      </div>

      {result && (
        <div className="space-y-3 rounded-2xl border border-ink-border bg-ink-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">&quot;{result.input_text}&quot;</span>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand">Skor {result.score}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[["Kalori", Math.round(result.calories), "kcal"], ["Protein", Math.round(result.protein_g), "g"], ["Karb", Math.round(result.carbs_g), "g"], ["Yağ", Math.round(result.fat_g), "g"]].map(([l, v, u]) => (
              <div key={l as string} className="rounded-xl bg-ink-soft p-2">
                <p className="text-base font-bold">{v as number}</p>
                <p className="text-[11px] text-fg-muted">{l as string} ({u as string})</p>
              </div>
            ))}
          </div>
          {result.items.length > 0 && (
            <p className="text-xs text-fg-muted">Eşleşen: {result.items.map((i) => i.name).join(", ")}</p>
          )}
          {result.assessment && (
            <p className="flex items-start gap-2 rounded-xl bg-ink-soft p-3 text-sm">
              <TrendingUp size={15} className="mt-0.5 shrink-0 text-brand" /> {result.assessment}
            </p>
          )}
          {result.alternatives.length > 0 && (
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand"><Lightbulb size={13} /> Daha iyi alternatifler</p>
              <ul className="space-y-1 text-sm">
                {result.alternatives.map((a, i) => <li key={i} className="flex gap-1.5"><span className="text-brand">•</span> {a}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      <NutritionDisclaimer />
    </div>
  );
}
