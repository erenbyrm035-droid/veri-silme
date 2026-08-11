"use client";

import { useState } from "react";
import { Activity, Loader2, Sparkles } from "lucide-react";

interface Metric { got: number; goal: number }
interface Metrics { calories: Metric; protein: Metric; carbs: Metric; fat: Metric; water: Metric; meals: number }

/** Günlük beslenme analizi — bugünkü makrolar vs hedef + AI yorumu. */
export function DailyAnalysis() {
  const [data, setData] = useState<{ metrics: Metrics; findings: string[]; advice: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/daily-analysis", { method: "POST" });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch { /* yoksay */ }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity size={18} className="text-brand" />
        <h3 className="font-semibold">Günlük Analiz</h3>
      </div>
      <p className="text-xs text-fg-muted">Bugün ne kadar yaklaştın? Makrolarını hedefinle karşılaştır, AI yorumu al.</p>

      <button onClick={run} disabled={loading} className="btn-primary w-full">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Analiz ediliyor…</> : <><Sparkles size={16} /> Bugünü Analiz Et</>}
      </button>

      {data && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Bar label="Kalori" got={data.metrics.calories.got} goal={data.metrics.calories.goal} unit="kcal" />
            <Bar label="Protein" got={data.metrics.protein.got} goal={data.metrics.protein.goal} unit="g" />
            <Bar label="Karb" got={data.metrics.carbs.got} goal={data.metrics.carbs.goal} unit="g" />
            <Bar label="Yağ" got={data.metrics.fat.got} goal={data.metrics.fat.goal} unit="g" />
            <Bar label="Su" got={data.metrics.water.got} goal={data.metrics.water.goal} unit="ml" />
          </div>

          {data.findings.length > 0 && (
            <ul className="space-y-1.5">
              {data.findings.map((f, i) => (
                <li key={i} className="flex gap-2 rounded-lg bg-ink-soft px-3 py-2 text-sm">
                  <span className="text-coral">•</span> {f}
                </li>
              ))}
            </ul>
          )}

          {data.advice && (
            <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand"><Sparkles size={12} /> AI Diyetisyen Yorumu</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.advice}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bar({ label, got, goal, unit }: { label: string; got: number; goal: number; unit: string }) {
  const pct = goal ? Math.min(100, Math.round((got / goal) * 100)) : 0;
  const over = goal && got > goal * 1.1;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-fg-muted">{got} / {goal} {unit}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-soft">
        <div className={`h-full rounded-full transition-all ${over ? "bg-coral" : "bg-brand"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
