"use client";

import { useState, useRef, useEffect } from "react";
import { ShoppingCart, Check, Download, Plus, X, Loader2 } from "lucide-react";
import { saveShoppingList, type ShoppingGroup } from "@/lib/nutrition/dietitian-actions";
import type { ShoppingList } from "@/lib/database.types";

const CAT_EMOJI: Record<string, string> = {
  Et: "🥩", "Et & Tavuk": "🍗", Sebze: "🥦", Sebzeler: "🥦", Meyve: "🍎", Meyveler: "🍎",
  "Süt Ürünleri": "🥛", Bakliyat: "🫘", Baklagiller: "🫘", Tahıllar: "🌾",
  Atıştırmalıklar: "🥜", Kuruyemiş: "🥜", Balık: "🐟", İçecek: "🥤", Diğer: "🛒",
};
const CATEGORIES = ["Et & Tavuk", "Balık", "Sebzeler", "Meyveler", "Süt Ürünleri", "Baklagiller", "Tahıllar", "Kuruyemiş", "İçecek", "Diğer"];

/** Kategori bazlı alışveriş listesi — ekle/çıkar + işaretle + otomatik kayıt. */
export function ShoppingListView({ list }: { list: ShoppingList | null }) {
  const [groups, setGroups] = useState<ShoppingGroup[]>(() => normalize(list?.items ?? []));
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [newItem, setNewItem] = useState("");
  const [newCat, setNewCat] = useState(CATEGORIES[0]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const firstRender = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Değişiklikleri otomatik kaydet (debounce).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const res = await saveShoppingList(groups);
      setSaving(false);
      if (res.ok) setSavedAt(new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }));
    }, 700);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [groups]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function addItem() {
    const item = newItem.trim();
    if (!item) return;
    setGroups((gs) => {
      const copy = gs.map((g) => ({ ...g, items: [...g.items] }));
      const grp = copy.find((g) => g.category === newCat);
      if (grp) { if (!grp.items.some((i) => i.toLowerCase() === item.toLowerCase())) grp.items.push(item); }
      else copy.push({ category: newCat, items: [item] });
      return copy;
    });
    setNewItem("");
  }

  function removeItem(cat: string, item: string) {
    setGroups((gs) => gs
      .map((g) => (g.category === cat ? { ...g, items: g.items.filter((i) => i !== item) } : g))
      .filter((g) => g.items.length > 0));
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  function downloadPdf() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Alışveriş Listesi</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:22px}h2{font-size:14px;text-transform:uppercase;color:#666;margin:16px 0 6px}li{margin:3px 0}small{color:#999}</style></head>
      <body><h1>🛒 Viva — Alışveriş Listesi</h1><small>${new Date().toLocaleDateString("tr-TR")}</small>
      ${groups.map((g) => `<h2>${g.category}</h2><ul>${g.items.map((i) => `<li>☐ ${i}</li>`).join("")}</ul>`).join("")}
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShoppingCart size={18} /> Alışveriş Listesi
          <span className="text-sm font-normal text-fg-muted">({checked.size}/{total})</span>
        </h2>
        <div className="flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin text-fg-muted" />
            : savedAt && <span className="text-[11px] text-fg-muted">Kaydedildi {savedAt}</span>}
          {total > 0 && (
            <button onClick={downloadPdf} className="inline-flex items-center gap-1.5 rounded-lg bg-ink-soft px-3 py-1.5 text-sm font-semibold text-fg">
              <Download size={14} /> PDF
            </button>
          )}
        </div>
      </div>

      {/* Ekleme satırı */}
      <div className="flex gap-2">
        <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
          className="input shrink-0 !w-auto text-sm">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="Ürün ekle (ör. 2 kg tavuk göğsü)" className="input flex-1 text-sm" />
        <button onClick={addItem} className="btn-primary aspect-square !px-0 w-10 shrink-0"><Plus size={16} /></button>
      </div>

      {total === 0 ? (
        <p className="rounded-xl bg-ink-soft px-4 py-8 text-center text-sm text-fg-muted">
          Liste boş. Yukarıdan ürün ekle veya öğün planı oluşturduğunda otomatik dolar.
        </p>
      ) : (
        groups.map((g) => (
          <div key={g.category}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">
              {CAT_EMOJI[g.category] ?? "🛒"} {g.category}
            </h3>
            <div className="space-y-1.5">
              {g.items.map((item) => {
                const key = `${g.category}-${item}`;
                const on = checked.has(key);
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg bg-ink-soft px-3 py-2 text-sm">
                    <button onClick={() => toggle(key)} className="flex flex-1 items-center gap-2.5 text-left">
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-brand bg-brand text-black" : "border-ink-border"}`}>
                        {on && <Check size={13} />}
                      </span>
                      <span className={on ? "text-fg-muted line-through" : ""}>{item}</span>
                    </button>
                    <button onClick={() => removeItem(g.category, item)} className="shrink-0 text-fg-muted hover:text-coral" aria-label="Kaldır">
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/** Ham items'ı ShoppingGroup[] biçimine normalize eder (eski/yeni format uyumu). */
function normalize(items: unknown): ShoppingGroup[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((g) => {
      const grp = g as { category?: string; items?: unknown };
      return { category: String(grp.category ?? "Diğer"), items: Array.isArray(grp.items) ? grp.items.map(String) : [] };
    })
    .filter((g) => g.items.length > 0);
}
