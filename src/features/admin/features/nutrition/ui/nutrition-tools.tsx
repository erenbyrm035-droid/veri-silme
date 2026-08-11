"use client";

import * as React from "react";
import { Calculator, PieChart } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Input } from "@/features/admin/components/ui/input";
import { Label } from "@/features/admin/components/ui/label";
import { Select } from "@/features/admin/components/ui/select";
import {
  bmr, tdee, bmi, bmiCategory, ffmi, bodyFatNavy, idealWeightRange, macrosFromPercent, caloriesFromMacros,
  ACTIVITY_LABELS, type Sex, type ActivityKey,
} from "../calc";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-ink-border bg-ink-soft/40 p-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-fg-muted">{sub}</p>}
    </div>
  );
}

export function NutritionTools() {
  // Calorie calculator
  const [sex, setSex] = React.useState<Sex>("male");
  const [age, setAge] = React.useState("28");
  const [height, setHeight] = React.useState("178");
  const [weight, setWeight] = React.useState("80");
  const [activity, setActivity] = React.useState<ActivityKey>("moderate");
  const [neck, setNeck] = React.useState("38");
  const [waist, setWaist] = React.useState("85");
  const [hip, setHip] = React.useState("95");

  const h = Number(height), w = Number(weight), a = Number(age);
  const bmrVal = bmr(sex, w, h, a);
  const tdeeVal = tdee(bmrVal, activity);
  const bmiVal = bmi(w, h);
  const bf = bodyFatNavy(sex, h, Number(neck), Number(waist), sex === "female" ? Number(hip) : undefined);
  const ffmiVal = bf != null ? ffmi(w, h, bf) : null;
  const ideal = idealWeightRange(h);

  // Macro builder
  const [calories, setCalories] = React.useState(String(tdeeVal));
  const [pPct, setPPct] = React.useState(30);
  const [cPct, setCPct] = React.useState(40);
  const [fPct, setFPct] = React.useState(30);
  React.useEffect(() => { setCalories(String(tdeeVal)); }, [tdeeVal]);

  const totalPct = pPct + cPct + fPct;
  const macros = macrosFromPercent(Number(calories) || 0, { proteinPct: pPct, carbsPct: cPct, fatPct: fPct });
  const macroCalories = caloriesFromMacros(macros.protein_g, macros.carbs_g, macros.fat_g);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Calculator size={16} className="text-brand" /> Kalori & Vücut Hesaplayıcı</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><Label>Cinsiyet</Label><Select value={sex} onChange={(e) => setSex(e.target.value as Sex)}><option value="male">Erkek</option><option value="female">Kadın</option></Select></div>
          <div><Label>Yaş</Label><Input type="number" value={age} onChange={(e) => setAge(e.target.value)} /></div>
          <div><Label>Boy (cm)</Label><Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} /></div>
          <div><Label>Kilo (kg)</Label><Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
          <div className="col-span-2"><Label>Aktivite</Label><Select value={activity} onChange={(e) => setActivity(e.target.value as ActivityKey)}>{(Object.keys(ACTIVITY_LABELS) as ActivityKey[]).map((k) => <option key={k} value={k}>{ACTIVITY_LABELS[k]}</option>)}</Select></div>
          <div><Label>Boyun (cm)</Label><Input type="number" value={neck} onChange={(e) => setNeck(e.target.value)} /></div>
          <div><Label>Bel (cm)</Label><Input type="number" value={waist} onChange={(e) => setWaist(e.target.value)} /></div>
          {sex === "female" && <div><Label>Kalça (cm)</Label><Input type="number" value={hip} onChange={(e) => setHip(e.target.value)} /></div>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="BMR" value={`${bmrVal}`} sub="kcal/gün" />
          <Stat label="TDEE" value={`${tdeeVal}`} sub="kcal/gün" />
          <Stat label="BMI" value={bmiVal} sub={bmiCategory(bmiVal)} />
          <Stat label="Vücut Yağı" value={bf != null ? `%${bf}` : "—"} sub="Navy" />
          <Stat label="FFMI" value={ffmiVal ?? "—"} />
          <Stat label="İdeal Kilo" value={`${ideal.min}-${ideal.max}`} sub="kg" />
        </div>
      </Card>

      <Card className="space-y-4 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><PieChart size={16} className="text-brand" /> Makro Builder</h3>
        <div><Label>Günlük Kalori</Label><Input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} /></div>
        <div className="space-y-3">
          {[
            { label: "Protein", val: pPct, set: setPPct, g: macros.protein_g, color: "bg-brand" },
            { label: "Karbonhidrat", val: cPct, set: setCPct, g: macros.carbs_g, color: "bg-sky-400" },
            { label: "Yağ", val: fPct, set: setFPct, g: macros.fat_g, color: "bg-amber-400" },
          ].map((m) => (
            <div key={m.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{m.label}</span>
                <span className="text-fg-muted">%{m.val} · {m.g} g</span>
              </div>
              <input type="range" min={0} max={100} value={m.val} onChange={(e) => m.set(Number(e.target.value))} className="w-full accent-brand" />
            </div>
          ))}
        </div>
        <div className={`rounded-xl px-3 py-2 text-sm ${totalPct === 100 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
          Toplam: %{totalPct} {totalPct !== 100 && "(100 olmalı)"} · Hesaplanan: {macroCalories} kcal
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Protein" value={`${macros.protein_g} g`} />
          <Stat label="Karbonhidrat" value={`${macros.carbs_g} g`} />
          <Stat label="Yağ" value={`${macros.fat_g} g`} />
        </div>
      </Card>
    </div>
  );
}
