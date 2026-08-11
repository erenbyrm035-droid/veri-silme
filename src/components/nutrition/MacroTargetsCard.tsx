import { Flame, Droplets } from "lucide-react";
import type { MacroTargets } from "@/lib/database.types";

const MACROS: { key: keyof MacroTargets; label: string; unit: string; color: string }[] = [
  { key: "protein_g", label: "Protein", unit: "g", color: "#e7fb00" },
  { key: "carbs_g", label: "Karbonhidrat", unit: "g", color: "#38bdf8" },
  { key: "fat_g", label: "Yağ", unit: "g", color: "#fb7185" },
  { key: "fiber_g", label: "Lif", unit: "g", color: "#34d399" },
  { key: "sugar_g", label: "Şeker (max)", unit: "g", color: "#f59e0b" },
  { key: "sodium_mg", label: "Sodyum (max)", unit: "mg", color: "#a78bfa" },
  { key: "potassium_mg", label: "Potasyum", unit: "mg", color: "#f472b6" },
];

/** Hesaplanan günlük makro + mikro hedeflerini gösterir. */
export function MacroTargetsCard({ targets }: { targets: MacroTargets }) {
  return (
    <div className="card space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">
        Günlük Beslenme Hedeflerin
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-brand/10 p-4">
          <span className="flex items-center gap-1.5 text-xs text-brand">
            <Flame size={14} /> Kalori
          </span>
          <p className="mt-1 text-2xl font-bold text-brand">{targets.calories}</p>
          <span className="text-xs text-fg-muted">kcal / gün</span>
        </div>
        <div className="rounded-xl bg-sky-500/10 p-4">
          <span className="flex items-center gap-1.5 text-xs text-sky-400">
            <Droplets size={14} /> Su
          </span>
          <p className="mt-1 text-2xl font-bold text-sky-400">
            {(targets.water_ml / 1000).toFixed(1)}
          </p>
          <span className="text-xs text-fg-muted">litre / gün</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
        {MACROS.map((m) => (
          <div key={m.key} className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.color }} />
              {m.label}
            </span>
            <span className="text-sm font-semibold">
              {targets[m.key]} {m.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
