import { ArrowDownUp, Flame, Minus, Zap } from "lucide-react";
import type { PostureMuscleAnalysis } from "@/lib/database.types";

/** Akıllı öneri motoru — kas dengesizliği (kısa/zayıf/aşırı aktif/inhibe). */
export function MuscleAnalysisCard({ analysis }: { analysis: PostureMuscleAnalysis }) {
  const groups = [
    { key: "short", label: "Kısa / Gergin", icon: ArrowDownUp, items: analysis.short, color: "text-amber-400" },
    { key: "overactive", label: "Aşırı Aktif", icon: Flame, items: analysis.overactive, color: "text-coral" },
    { key: "weak", label: "Zayıf", icon: Minus, items: analysis.weak, color: "text-sky-400" },
    { key: "inhibited", label: "İnhibe (Baskılanmış)", icon: Zap, items: analysis.inhibited, color: "text-brand" },
  ] as const;

  const empty = groups.every((g) => g.items.length === 0);
  if (empty) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.key} className="rounded-2xl border border-ink-border bg-ink-card p-4">
          <h4 className={`flex items-center gap-2 text-sm font-semibold ${g.color}`}>
            <g.icon size={16} /> {g.label}
          </h4>
          {g.items.length === 0 ? (
            <p className="mt-2 text-xs text-fg-muted">—</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.items.map((m) => <span key={m} className="rounded-lg bg-ink-soft px-2 py-0.5 text-xs">{m}</span>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
