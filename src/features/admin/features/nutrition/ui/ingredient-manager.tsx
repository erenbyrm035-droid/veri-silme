"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Carrot } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { addIngredient, deleteIngredient } from "../actions";
import { searchFoodsAction } from "../search-action";
import type { RecipeIngredient } from "@/lib/database.types";

export function IngredientManager({ recipeId, ingredients }: { recipeId: string; ingredients: RecipeIngredient[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [foodId, setFoodId] = React.useState<string | null>(null);
  const [grams, setGrams] = React.useState("100");
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (name.trim().length < 2 || foodId) { setResults([]); return; }
    const id = setTimeout(async () => setResults((await searchFoodsAction(name)).map((f) => ({ id: f.id, name: f.name }))), 300);
    return () => clearTimeout(id);
  }, [name, foodId]);

  function add() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await addIngredient({ recipeId, food_id: foodId, name: name.trim(), grams: Number(grams) || 0 });
      if (!res.ok) return setError(res.error ?? "Eklenemedi.");
      setName(""); setFoodId(null); setGrams("100"); setResults([]); router.refresh();
    });
  }
  function remove(id: string) { startTransition(async () => { await deleteIngredient({ id, recipeId }); router.refresh(); }); }

  return (
    <Card className="space-y-4 p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Carrot size={16} className="text-brand" /> Malzemeler</h3>
      <p className="text-xs text-fg-muted">Besin kütüphanesinden seç → makrolar otomatik hesaplanır. Serbest malzeme de eklenebilir.</p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Label>Malzeme</Label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <Input value={name} onChange={(e) => { setName(e.target.value); setFoodId(null); }} placeholder="Tavuk göğsü" className="pl-9" />
          </div>
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-xl border border-ink-border bg-ink-card p-1 shadow-xl">
              {results.map((r) => (
                <button key={r.id} onClick={() => { setName(r.name); setFoodId(r.id); setResults([]); }} className="block w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-fg/5">{r.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="w-24"><Label>Gram</Label><Input type="number" value={grams} onChange={(e) => setGrams(e.target.value)} /></div>
        <Button variant="outline" size="sm" onClick={add} disabled={isPending}><Plus size={15} /> Ekle</Button>
      </div>
      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="space-y-1.5">
        {ingredients.length === 0 && <p className="text-sm text-fg-muted">Henüz malzeme yok.</p>}
        {ingredients.map((ing) => (
          <div key={ing.id} className="flex items-center gap-2 rounded-lg border border-ink-border bg-ink-soft/40 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm">{ing.name}{!ing.food_id && <span className="ml-1 text-xs text-fg-muted">(serbest)</span>}</span>
            <span className="shrink-0 text-xs text-fg-muted">{ing.grams} g</span>
            <button onClick={() => remove(ing.id)} disabled={isPending} className="text-fg-muted hover:text-coral"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
