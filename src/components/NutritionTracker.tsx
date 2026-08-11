"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncMyGamification } from "@/lib/gamification/actions";
import type { Food, NutritionLog, MealType } from "@/lib/database.types";
import { scaleMacros } from "@/lib/nutrition";
import { MEAL_OPTIONS, MEAL_LABELS } from "@/lib/constants";
import { toPercent, formatNumber, formatShortDate } from "@/lib/utils";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Plus, Search, Trash2, Flame, Beef, Droplet, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function NutritionTracker({
  userId,
  foods,
  initialLogs,
  calorieGoal,
  proteinGoal,
  waterGoalMl,
  initialWaterMl,
}: {
  userId: string;
  foods: Food[];
  initialLogs: NutritionLog[];
  calorieGoal: number;
  proteinGoal: number;
  waterGoalMl: number;
  initialWaterMl: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [logs, setLogs] = useState<NutritionLog[]>(initialLogs);
  const [waterMl, setWaterMl] = useState(initialWaterMl);
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState<MealType>("breakfast");
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");

  async function loadForDate(d: string) {
    setDate(d);
    const [{ data: l }, { data: w }] = await Promise.all([
      supabase
        .from("nutrition_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("log_date", d)
        .order("created_at", { ascending: true }),
      supabase.from("water_logs").select("amount_ml").eq("user_id", userId).eq("log_date", d),
    ]);
    setLogs((l as NutritionLog[]) ?? []);
    setWaterMl((w ?? []).reduce((s, x) => s + Number(x.amount_ml), 0));
  }

  async function addWater(amount: number) {
    await supabase.from("water_logs").insert({
      user_id: userId,
      amount_ml: amount,
      log_date: date,
    });
    setWaterMl((m) => m + amount);
    router.refresh();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods.slice(0, 8);
    return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, foods]);

  const totals = useMemo(
    () => ({
      calories: logs.reduce((s, l) => s + Number(l.calories), 0),
      protein: logs.reduce((s, l) => s + Number(l.protein_g), 0),
      carbs: logs.reduce((s, l) => s + Number(l.carbs_g), 0),
      fat: logs.reduce((s, l) => s + Number(l.fat_g), 0),
    }),
    [logs]
  );

  async function addLog() {
    if (!selected) return;
    const g = parseFloat(grams) || 100;
    const macros = scaleMacros(
      {
        calories: selected.calories,
        protein_g: selected.protein_g,
        carbs_g: selected.carbs_g,
        fat_g: selected.fat_g,
      },
      g
    );

    const { data, error } = await supabase
      .from("nutrition_logs")
      .insert({
        user_id: userId,
        food_id: selected.id,
        food_name: selected.name,
        meal,
        log_date: date,
        grams: g,
        ...macros,
      })
      .select("*")
      .single();

    if (!error && data) {
      setLogs((l) => [...l, data as NutritionLog]);
      setSelected(null);
      setQuery("");
      setGrams("100");
      void syncMyGamification(); // protein/kalori hedefi tuttuğunda XP güncellensin
      router.refresh();
    }
  }

  async function removeLog(id: string) {
    setLogs((l) => l.filter((x) => x.id !== id));
    await supabase.from("nutrition_logs").delete().eq("id", id);
    router.refresh();
  }

  const byMeal = MEAL_OPTIONS.map((m) => ({
    ...m,
    items: logs.filter((l) => l.meal === m.value),
  }));

  const macroKcal = {
    protein: totals.protein * 4,
    carbs: totals.carbs * 4,
    fat: totals.fat * 9,
  };
  const macroTotal = macroKcal.protein + macroKcal.carbs + macroKcal.fat || 1;
  const remaining = Math.max(0, Math.round(calorieGoal - totals.calories));

  return (
    <div className="space-y-6">
      {/* Gün navigasyonu */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => loadForDate(addDays(date, -1))}
          className="grid h-9 w-9 place-items-center rounded-xl border border-ink-border text-fg-muted hover:text-fg"
          aria-label="Önceki gün"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold">
          {date === today ? "Bugün" : formatShortDate(date)}
        </span>
        <button
          onClick={() => date < today && loadForDate(addDays(date, 1))}
          disabled={date >= today}
          className="grid h-9 w-9 place-items-center rounded-xl border border-ink-border text-fg-muted hover:text-fg disabled:opacity-40"
          aria-label="Sonraki gün"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Özet */}
      <div className="card flex items-center justify-around">
        <ProgressRing value={toPercent(totals.calories, calorieGoal)} size={96}>
          <div className="text-center">
            <Flame size={16} className="mx-auto text-brand" />
            <div className="text-sm font-bold">{formatNumber(totals.calories)}</div>
            <div className="text-[11px] text-fg-muted">
              / {formatNumber(calorieGoal)}
            </div>
          </div>
        </ProgressRing>
        <ProgressRing
          value={toPercent(totals.protein, proteinGoal)}
          size={96}
          color="#f472b6"
        >
          <div className="text-center">
            <Beef size={16} className="mx-auto text-pink-400" />
            <div className="text-sm font-bold">
              {formatNumber(totals.protein)}g
            </div>
            <div className="text-[11px] text-fg-muted">
              / {formatNumber(proteinGoal)}g
            </div>
          </div>
        </ProgressRing>
        <div className="text-center">
          <p className="text-2xl font-bold text-brand tabular-nums">
            {formatNumber(remaining)}
          </p>
          <p className="text-xs text-fg-muted">kalori kaldı</p>
        </div>
      </div>

      {/* Makro dağılımı */}
      <div className="card">
        <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-ink-soft">
          <div style={{ width: `${(macroKcal.protein / macroTotal) * 100}%` }} className="bg-pink-400" />
          <div style={{ width: `${(macroKcal.carbs / macroTotal) * 100}%` }} className="bg-sky-400" />
          <div style={{ width: `${(macroKcal.fat / macroTotal) * 100}%` }} className="bg-amber-400" />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-pink-400">Protein {formatNumber(totals.protein)}g</span>
          <span className="text-sky-400">Karb {formatNumber(totals.carbs)}g</span>
          <span className="text-amber-400">Yağ {formatNumber(totals.fat)}g</span>
        </div>
      </div>

      {/* Su takibi */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-400">
            <Droplet size={20} />
          </span>
          <div>
            <p className="font-semibold tabular-nums">
              {(waterMl / 1000).toFixed(1)}L
              <span className="text-sm font-normal text-fg-muted">
                {" "}/ {(waterGoalMl / 1000).toFixed(1)}L
              </span>
            </p>
            <p className="text-xs text-fg-muted">Su tüketimi</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => addWater(250)} className="btn-ghost px-3 py-1.5 text-xs">
            <Plus size={14} /> 250
          </button>
          <button onClick={() => addWater(500)} className="btn-ghost px-3 py-1.5 text-xs">
            <Plus size={14} /> 500ml
          </button>
        </div>
      </div>

      {/* Öğün ekleme */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
          Öğün Ekle
        </h2>

        <div className="flex flex-wrap gap-2">
          {MEAL_OPTIONS.map((m) => (
            <button
              key={m.value}
              onClick={() => setMeal(m.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                meal === m.value
                  ? "bg-brand text-black"
                  : "border border-ink-border bg-ink-soft text-fg-muted"
              )}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
          />
          <input
            className="input pl-9"
            placeholder="Yiyecek ara (tavuk, pilav, yumurta...)"
            value={selected ? selected.name : query}
            onChange={(e) => {
              setSelected(null);
              setQuery(e.target.value);
            }}
          />
        </div>

        {!selected && query && (
          <div className="space-y-1">
            {filtered.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                className="flex w-full items-center justify-between rounded-xl bg-ink-soft px-3 py-2.5 text-left transition-colors hover:bg-fg/5"
              >
                <span className="text-sm">{f.name}</span>
                <span className="text-xs text-fg-muted">
                  {f.calories} kcal · {f.protein_g}g P / 100g
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="py-2 text-center text-xs text-fg-muted">
                Sonuç bulunamadı.
              </p>
            )}
          </div>
        )}

        {selected && (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="label">Miktar (gram)</label>
              <input
                type="number"
                className="input"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
              />
            </div>
            <button onClick={addLog} className="btn-primary">
              <Plus size={18} /> Ekle
            </button>
          </div>
        )}
      </div>

      {/* Öğün listesi */}
      <div className="space-y-4">
        {byMeal.map(
          (m) =>
            m.items.length > 0 && (
              <div key={m.value} className="card">
                <h3 className="mb-3 font-semibold">
                  {m.emoji} {MEAL_LABELS[m.value]}
                </h3>
                <div className="space-y-2">
                  {m.items.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between rounded-xl bg-ink-soft px-3 py-2.5"
                    >
                      <div>
                        <p className="text-sm">{l.food_name}</p>
                        <p className="text-xs text-fg-muted">
                          {formatNumber(Number(l.grams))}g ·{" "}
                          {formatNumber(Number(l.calories))} kcal ·{" "}
                          {formatNumber(Number(l.protein_g))}g protein
                        </p>
                      </div>
                      <button
                        onClick={() => removeLog(l.id)}
                        className="grid h-8 w-8 place-items-center rounded-lg bg-fg/5 text-fg-muted transition-colors hover:text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
        )}
      </div>
    </div>
  );
}
