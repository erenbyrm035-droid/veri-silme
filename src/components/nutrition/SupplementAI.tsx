"use client";

import { useState } from "react";
import { Pill, Loader2, Sparkles, ShieldAlert } from "lucide-react";

interface Suggestion { name: string; why: string; dose: string }

/** Supplement AI — hedefe göre takviye önerisi (ilaç önermez). */
export function SupplementAI() {
  const [data, setData] = useState<{ suggestions: Suggestion[]; note: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/supplement", { method: "POST" });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* yoksay */ }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Pill size={18} className="text-brand" />
        <h3 className="font-semibold">Supplement Önerisi</h3>
      </div>
      <p className="text-xs text-fg-muted">Hedefine göre takviye önerisi. İlaç/tedavi önerisi değildir; almadan önce uzmana danış.</p>

      <button onClick={run} disabled={loading} className="btn-primary w-full">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Hazırlanıyor…</> : <><Sparkles size={16} /> Bana Öneri Ver</>}
      </button>

      {data && (
        <div className="space-y-3">
          {data.suggestions.map((s, i) => (
            <div key={i} className="rounded-xl border border-ink-border bg-ink-card p-3">
              <p className="font-semibold text-brand">{s.name}</p>
              <p className="mt-0.5 text-sm text-fg-muted">{s.why}</p>
              <p className="mt-1 text-xs"><span className="font-semibold">Kullanım:</span> {s.dose}</p>
            </div>
          ))}
          {data.note && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-500/90">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" /> {data.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
