"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Store, Plus, Check, Loader2, ArrowLeft } from "lucide-react";

interface MenuItem {
  id: string; restaurant: string; item_name: string; category: string | null;
  calories: number; protein_g: number; carbs_g: number; fat_g: number; serving_desc: string | null;
}
function currentMeal(): string {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}
const LOGO: Record<string, string> = {
  "Burger King": "🍔", "McDonald's": "🍟", KFC: "🍗", Popeyes: "🍗", "Tavuk Dünyası": "🐔",
  "HD İskender": "🥙", "Köfteci Yusuf": "🧆", "Domino's": "🍕", "Little Caesars": "🍕",
  Subway: "🥪", Starbucks: "☕", "Simit Sarayı": "🥯",
};

/** Restoran Modu — restoran seç, menüden ürünleri öğüne ekle (yaklaşık değerler). */
export function RestaurantMode() {
  const supabase = createClient();
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/nutrition/restaurants").then((r) => r.json()).then((d) => setRestaurants(d.restaurants ?? [])).catch(() => {});
  }, []);

  async function openMenu(name: string) {
    setSelected(name); setLoading(true); setMenu([]);
    try {
      const res = await fetch(`/api/nutrition/restaurants?name=${encodeURIComponent(name)}`);
      const d = await res.json();
      setMenu(d.menu ?? []);
    } catch { setMenu([]); }
    setLoading(false);
  }

  async function addItem(m: MenuItem) {
    const { error } = await supabase.from("nutrition_logs").insert({
      user_id: (await supabase.auth.getUser()).data.user?.id,
      food_name: `${m.item_name} (${m.restaurant})`,
      meal: currentMeal(),
      log_date: new Date().toISOString().slice(0, 10),
      grams: 0,
      calories: m.calories, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g,
    });
    if (!error) { setAdded((s) => new Set(s).add(m.id)); router.refresh(); }
  }

  if (restaurants.length === 0) {
    return (
      <div className="card py-10 text-center text-sm text-fg-muted">
        <Store size={28} className="mx-auto mb-2 text-fg-muted" />
        Restoran menüleri yükleniyor… Görünmüyorsa <code>nutrition_pro_kurulum.sql</code>&apos;i Supabase&apos;de çalıştır.
      </div>
    );
  }

  // Restoran listesi
  if (!selected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Store size={18} className="text-brand" />
          <h3 className="font-semibold">Restoran Modu</h3>
        </div>
        <p className="text-xs text-fg-muted">Dışarıda mı yiyorsun? Restoranı seç, menüden ürünü öğününe ekle. Değerler yaklaşıktır.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {restaurants.map((r) => (
            <button key={r} onClick={() => openMenu(r)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-ink-border bg-ink-card px-3 py-4 transition-colors hover:border-brand/50">
              <span className="text-2xl">{LOGO[r] ?? "🍽️"}</span>
              <span className="text-center text-xs font-medium leading-tight">{r}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Seçili restoran menüsü
  return (
    <div className="space-y-3">
      <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft size={15} /> Restoranlar
      </button>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{LOGO[selected] ?? "🍽️"}</span>
        <h3 className="font-semibold">{selected}</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-fg-muted" /></div>
      ) : (
        <div className="space-y-1.5">
          {menu.map((m) => {
            const on = added.has(m.id);
            return (
              <div key={m.id} className="flex items-center gap-2 rounded-xl border border-ink-border bg-ink-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.item_name}</p>
                  <p className="text-[11px] text-fg-muted">
                    {Math.round(m.calories)} kcal · P{m.protein_g} K{m.carbs_g} Y{m.fat_g}{m.serving_desc ? ` · ${m.serving_desc}` : ""}
                  </p>
                </div>
                <button onClick={() => addItem(m)} disabled={on}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${on ? "bg-emerald-500/15 text-emerald-400" : "bg-brand text-black"}`}>
                  {on ? <Check size={14} /> : <Plus size={14} />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
