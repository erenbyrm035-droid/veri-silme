"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, UtensilsCrossed, CalendarDays } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Select } from "@/features/admin/components/ui/select";
import { Badge } from "@/features/admin/components/ui/badge";
import { MealFoodDialog } from "./meal-food-dialog";
import { MEAL_TYPES, MEAL_TYPE_LABEL } from "../constants";
import { addDietDay, deleteDietDay, addMeal, deleteMeal, deleteMealFood } from "../actions";
import type { DietDayWithMeals, NutritionMealType, MealWithFoods } from "@/lib/database.types";

function mealTotals(m: MealWithFoods) {
  return m.foods.reduce((a, f) => ({ cal: a.cal + Number(f.calories), p: a.p + Number(f.protein_g), c: a.c + Number(f.carbs_g), y: a.y + Number(f.fat_g) }), { cal: 0, p: 0, c: 0, y: 0 });
}

function MealCard({ planId, meal }: { planId: string; meal: MealWithFoods }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [addOpen, setAddOpen] = React.useState(false);
  const t = mealTotals(meal);
  return (
    <div className="rounded-xl border border-ink-border bg-ink-soft/40 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="default">{MEAL_TYPE_LABEL.get(meal.meal_type)}</Badge>
          {meal.title && <span className="text-sm font-medium">{meal.title}</span>}
          {meal.meal_time && <span className="text-xs text-fg-muted">{meal.meal_time}</span>}
        </div>
        <button onClick={() => startTransition(async () => { await deleteMeal({ id: meal.id, planId }); router.refresh(); })} className="text-fg-muted hover:text-coral"><Trash2 size={14} /></button>
      </div>
      <div className="space-y-1">
        {meal.foods.length === 0 && <p className="text-xs text-fg-muted">Besin yok.</p>}
        {meal.foods.map((f) => (
          <div key={f.id} className="flex items-center gap-2 text-sm">
            <UtensilsCrossed size={12} className="shrink-0 text-fg-muted" />
            <span className="min-w-0 flex-1 truncate">{f.name} <span className="text-xs text-fg-muted">{f.grams}{f.recipe_id ? " porsiyon" : "g"}</span></span>
            <span className="shrink-0 text-xs text-fg-muted">{Math.round(Number(f.calories))} kcal</span>
            <button onClick={() => startTransition(async () => { await deleteMealFood({ id: f.id, planId }); router.refresh(); })} className="text-fg-muted hover:text-coral"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-fg-muted">{Math.round(t.cal)} kcal · P{Math.round(t.p)} K{Math.round(t.c)} Y{Math.round(t.y)}</span>
        <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> Besin</Button>
      </div>
      <MealFoodDialog open={addOpen} onOpenChange={setAddOpen} mealId={meal.id} planId={planId} />
    </div>
  );
}

function DayColumn({ planId, day }: { planId: string; day: DietDayWithMeals }) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [mealType, setMealType] = React.useState<NutritionMealType>("breakfast");
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={15} /> Gün {day.day}</p>
        <button onClick={() => startTransition(async () => { await deleteDietDay({ id: day.id, planId }); router.refresh(); })} className="text-fg-muted hover:text-coral"><Trash2 size={15} /></button>
      </div>
      <div className="space-y-2">
        {day.meals.length === 0 && <p className="text-xs text-fg-muted">Öğün yok.</p>}
        {day.meals.map((m) => <MealCard key={m.id} planId={planId} meal={m} />)}
      </div>
      <div className="mt-3 flex gap-2">
        <Select value={mealType} onChange={(e) => setMealType(e.target.value as NutritionMealType)} aria-label="Öğün tipi">
          {MEAL_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </Select>
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => startTransition(async () => { await addMeal({ dayId: day.id, planId, meal_type: mealType }); router.refresh(); })}><Plus size={14} /> Öğün</Button>
      </div>
    </Card>
  );
}

export function DietBuilder({ planId, days, tree }: { planId: string; days: number; tree: DietDayWithMeals[] }) {
  const router = useRouter();
  const [day, setDay] = React.useState(1);
  const [isPending, startTransition] = React.useTransition();
  const maxDay = Math.max(days, ...tree.map((d) => d.day), 0);
  const current = tree.find((d) => d.day === day);

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><UtensilsCrossed size={16} className="text-brand" /> Diyet Takvimi — Günler & Öğünler</h3>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => {
          const has = tree.some((x) => x.day === d);
          return <button key={d} onClick={() => setDay(d)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${d === day ? "bg-brand text-black" : has ? "bg-ink-soft text-fg" : "bg-ink-soft/50 text-fg-muted"}`}>Gün {d}</button>;
        })}
      </div>
      {current ? (
        <DayColumn planId={planId} day={current} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink-border bg-ink-card/40 p-8 text-center">
          <p className="text-sm text-fg-muted">Gün {day} henüz oluşturulmadı.</p>
          <Button size="sm" variant="outline" disabled={isPending} onClick={() => startTransition(async () => { await addDietDay({ planId, day }); router.refresh(); })}><Plus size={14} /> Gün {day}&apos;i Oluştur</Button>
        </div>
      )}
    </Card>
  );
}
