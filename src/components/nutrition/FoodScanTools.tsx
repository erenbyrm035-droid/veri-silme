"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { uploadToStorage } from "@/lib/storage/upload";
import { ScanBarcode, Camera, Loader2, Sparkles, Check, Plus } from "lucide-react";

interface Recognized {
  name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number;
  portion?: string; confidence?: number;
}
function currentMeal(): string {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 18) return "snack";
  return "dinner";
}

/**
 * Barkod arama + yemek fotoğrafı analizi araçları.
 * Altyapı hazır; gerçek barkod API'si ve AI görüntü tanıma bağlandığında
 * bu bileşen değişmeden çalışır.
 */
export function FoodScanTools({ userId }: { userId: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <BarcodeCard />
      <MealPhotoCard userId={userId} />
    </div>
  );
}

function BarcodeCard() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    if (!code.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/nutrition/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode: code.trim() }),
      });
      const json = await res.json();
      setMsg(json.found ? `Bulundu: ${json.food.name}` : json.message);
    } catch {
      setMsg("Bir hata oluştu.");
    }
    setLoading(false);
  }

  return (
    <div className="card">
      <h3 className="flex items-center gap-2 font-bold">
        <ScanBarcode size={18} className="text-brand" /> Barkod ile Ara
      </h3>
      <p className="mt-1 text-xs text-fg-muted">
        Ürün barkodunu gir; veritabanında ara. Kamera ile tarama yakında.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          placeholder="Örn. 8690..."
          className="input flex-1"
        />
        <button onClick={lookup} disabled={loading} className="btn-ghost shrink-0">
          {loading ? <Loader2 size={16} className="animate-spin" /> : "Ara"}
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-fg-muted">{msg}</p>}
    </div>
  );
}

function MealPhotoCard({ userId }: { userId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<Recognized | null>(null);
  const [added, setAdded] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setResult(null);
    setAdded(false);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const up = await uploadToStorage(supabase, {
        bucket: "meal-photos", path, file, upsert: true,
        contentType: file.type || undefined, ownerFolder: true,
      });
      if (!up.ok) throw new Error(up.error ?? "Fotoğraf yüklenemedi.");
      const res = await fetch("/api/ai/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const json = await res.json();
      if (json.recognized) setResult(json.recognized as Recognized);
      setMsg(json.message ?? "Fotoğraf kaydedildi.");
    } catch {
      setMsg("Yükleme başarısız.");
    }
    setBusy(false);
    e.target.value = "";
  }

  async function addToLog() {
    if (!result) return;
    const { error } = await supabase.from("nutrition_logs").insert({
      user_id: userId,
      food_name: result.name,
      meal: currentMeal(),
      log_date: new Date().toISOString().slice(0, 10),
      grams: 0,
      calories: result.calories,
      protein_g: result.protein_g,
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
    });
    if (!error) { setAdded(true); router.refresh(); }
    else setMsg("Öğün eklenemedi.");
  }

  return (
    <div className="card">
      <h3 className="flex items-center gap-2 font-bold">
        <Camera size={18} className="text-brand" /> Yemek Fotoğrafı
        <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-semibold text-brand">
          <Sparkles size={9} className="mr-0.5 inline" /> AI
        </span>
      </h3>
      <p className="mt-1 text-xs text-fg-muted">
        Yemeğinin fotoğrafını yükle; AI tabağı tanıyıp kalori + makro + porsiyon tahmini yapsın.
      </p>
      <label className="btn-ghost mt-3 w-full cursor-pointer justify-center">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
        {busy ? "Analiz ediliyor…" : "Fotoğraf Yükle"}
        <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
      </label>

      {result && (
        <div className="mt-3 space-y-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">{result.name}</p>
            {result.confidence != null && (
              <span className="text-[11px] text-fg-muted">%{Math.round(result.confidence * 100)} güven</span>
            )}
          </div>
          {result.portion && <p className="text-[11px] text-fg-muted">{result.portion}</p>}
          <div className="grid grid-cols-4 gap-1 text-center">
            <Macro v={result.calories} l="kcal" />
            <Macro v={result.protein_g} l="P (g)" />
            <Macro v={result.carbs_g} l="K (g)" />
            <Macro v={result.fat_g} l="Y (g)" />
          </div>
          <button onClick={addToLog} disabled={added}
            className="btn-primary mt-1 w-full !py-2 text-sm">
            {added ? <><Check size={15} /> Eklendi</> : <><Plus size={15} /> Öğüne Ekle</>}
          </button>
          <p className="text-[11px] text-fg-muted">Değerler AI tahminidir; gerekirse düzenle.</p>
        </div>
      )}
      {msg && !result && <p className="mt-2 text-xs text-fg-muted">{msg}</p>}
    </div>
  );
}

function Macro({ v, l }: { v: number; l: string }) {
  return (
    <div>
      <p className="text-sm font-bold text-brand">{Math.round(v)}</p>
      <p className="text-[11px] text-fg-muted">{l}</p>
    </div>
  );
}
