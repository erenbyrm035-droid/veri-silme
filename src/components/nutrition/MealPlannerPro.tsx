"use client";

import { useState } from "react";
import { CalendarDays, Sparkles, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Meal { slot: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }
interface DayPlan { day: number; meals: Meal[] }

/** 7 / 14 / 30 günlük kişiselleştirilmiş beslenme planı üretici. */
export function MealPlannerPro() {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [plan, setPlan] = useState<DayPlan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number>(1);

  async function generate() {
    setLoading(true); setError(null); setPlan(null);
    try {
      const res = await fetch("/api/ai/meal-planner", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Plan oluşturulamadı."); return; }
      setPlan(data.plan ?? []);
      setOpen(1);
    } catch { setError("Plan oluşturulamadı. Lütfen tekrar dene."); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-brand" />
        <h3 className="font-semibold">Çok Günlü Beslenme Planı</h3>
      </div>
      <p className="text-xs text-fg-muted">Profiline ve hedef makrolarına göre kişisel plan. Alerji ve sevmediğin besinler dikkate alınır.</p>

      <div className="flex gap-2">
        {([7, 14, 30] as const).map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={cn("flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors",
              days === d ? "border-brand bg-brand/10 text-brand" : "border-ink-border text-fg-muted")}>
            {d} Gün
          </button>
        ))}
      </div>

      <button onClick={generate} disabled={loading} className="btn-primary w-full">
        {loading ? <><Loader2 size={16} className="animate-spin" /> Plan oluşturuluyor…</> : <><Sparkles size={16} /> {days} Günlük Plan Oluştur</>}
      </button>

      {error && (
        <div className="space-y-2 rounded-xl bg-coral/10 px-4 py-3">
          <p className="text-sm text-coral">{error}</p>
          {error.includes("Premium") && <a href="/premium" className="btn-primary w-full">Premium&apos;a Yükselt</a>}
        </div>
      )}

      {plan && (
        <div className="space-y-2">
          {plan.map((d) => {
            const total = d.meals.reduce((t, m) => ({ c: t.c + m.calories, p: t.p + m.protein_g }), { c: 0, p: 0 });
            const isOpen = open === d.day;
            return (
              <div key={d.day} className="overflow-hidden rounded-xl border border-ink-border bg-ink-card">
                <button onClick={() => setOpen(isOpen ? -1 : d.day)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left">
                  <div>
                    <p className="text-sm font-semibold">Gün {d.day}</p>
                    <p className="text-[11px] text-fg-muted">{total.c} kcal · {total.p}g protein · {d.meals.length} öğün</p>
                  </div>
                  <ChevronDown size={16} className={cn("text-fg-muted transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="space-y-1.5 border-t border-ink-border px-4 py-3">
                    {d.meals.map((m, i) => (
                      <div key={i} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">{m.slot}</p>
                          <p className="text-sm">{m.name}</p>
                        </div>
                        <p className="shrink-0 text-right text-[11px] text-fg-muted">{m.calories} kcal<br />P{m.protein_g} K{m.carbs_g} Y{m.fat_g}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
