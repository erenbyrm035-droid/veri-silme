"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/features/admin/components/ui/dialog";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { addMealFood } from "../actions";
import { searchFoodsAction, searchRecipesAction } from "../search-action";

export function MealFoodDialog({ open, onOpenChange, mealId, planId }: { open: boolean; onOpenChange: (o: boolean) => void; mealId: string; planId: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"food" | "recipe">("food");
  const [name, setName] = React.useState("");
  const [refId, setRefId] = React.useState<string | null>(null);
  const [grams, setGrams] = React.useState("100");
  const [base, setBase] = React.useState({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, per: 100 }); // per 100g (food) or per serving (recipe)
  const [results, setResults] = React.useState<{ id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; base: number }[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { if (open) { setName(""); setRefId(null); setGrams("100"); setResults([]); setError(null); setBase({ calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, per: 100 }); } }, [open, mode]);

  React.useEffect(() => {
    if (name.trim().length < 2 || refId) { setResults([]); return; }
    const id = setTimeout(async () => {
      if (mode === "food") {
        const r = await searchFoodsAction(name);
        setResults(r.map((f) => ({ id: f.id, name: f.name, calories: Number(f.calories), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), base: 100 })));
      } else {
        const r = await searchRecipesAction(name);
        setResults(r.map((f) => ({ id: f.id, name: f.name, calories: Number(f.calories), protein_g: Number(f.protein_g), carbs_g: Number(f.carbs_g), fat_g: Number(f.fat_g), base: 1 })));
      }
    }, 300);
    return () => clearTimeout(id);
  }, [name, refId, mode]);

  // Miktara göre makro hesapla: food → grams/100; recipe → porsiyon (grams alanı porsiyon sayısı gibi kullanılır)
  const factor = mode === "food" ? (Number(grams) || 0) / (base.per || 100) : Number(grams) || 0;
  const computed = {
    calories: Math.round(base.calories * factor),
    protein_g: Math.round(base.protein_g * factor * 10) / 10,
    carbs_g: Math.round(base.carbs_g * factor * 10) / 10,
    fat_g: Math.round(base.fat_g * factor * 10) / 10,
  };

  function pick(r: { id: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; base: number }) {
    setName(r.name); setRefId(r.id); setResults([]);
    setBase({ calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, per: r.base });
    if (mode === "recipe") setGrams("1");
  }

  function save() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addMealFood({
        mealId, planId,
        food_id: mode === "food" ? refId : null,
        recipe_id: mode === "recipe" ? refId : null,
        name: name.trim(), grams: Number(grams) || 0,
        calories: computed.calories, protein_g: computed.protein_g, carbs_g: computed.carbs_g, fat_g: computed.fat_g,
      });
      if (!res.ok) return setError(res.error ?? "Eklenemedi.");
      onOpenChange(false); router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Öğüne Besin/Tarif Ekle</DialogTitle>
          <DialogDescription>Kütüphaneden seç → makrolar miktara göre otomatik hesaplanır.</DialogDescription>
        </DialogHeader>
        <div className="mb-2 inline-flex rounded-xl border border-ink-border bg-ink-soft p-1">
          <button onClick={() => setMode("food")} className={`rounded-lg px-3 py-1 text-sm ${mode === "food" ? "bg-ink-card font-medium" : "text-fg-muted"}`}>Besin</button>
          <button onClick={() => setMode("recipe")} className={`rounded-lg px-3 py-1 text-sm ${mode === "recipe" ? "bg-ink-card font-medium" : "text-fg-muted"}`}>Tarif</button>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Label>{mode === "food" ? "Besin" : "Tarif"}</Label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
              <Input value={name} onChange={(e) => { setName(e.target.value); setRefId(null); }} placeholder="Ara veya serbest yaz" className="pl-9" />
            </div>
            {results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink-border bg-ink-card p-1 shadow-xl">
                {results.map((r) => <button key={r.id} onClick={() => pick(r)} className="block w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-fg/5">{r.name}</button>)}
              </div>
            )}
          </div>
          <div><Label>{mode === "food" ? "Miktar (g)" : "Porsiyon"}</Label><Input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} /></div>
          <div className="rounded-xl bg-ink-soft/50 px-3 py-2 text-sm text-fg-muted">
            {computed.calories} kcal · P {computed.protein_g} · K {computed.carbs_g} · Y {computed.fat_g}
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Vazgeç</Button>
          <Button onClick={save} disabled={isPending || !name.trim()}>{isPending ? "Ekleniyor…" : "Ekle"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
