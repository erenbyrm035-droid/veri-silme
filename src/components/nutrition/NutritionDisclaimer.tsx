import { ShieldCheck } from "lucide-react";
import { NUTRITION_DISCLAIMER } from "@/lib/constants";

/** Beslenme modülü güvenlik uyarısı (yeniden kullanılabilir). */
export function NutritionDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200/90">
      <ShieldCheck size={18} className="mt-0.5 shrink-0" />
      <p className={compact ? "text-[11px] leading-relaxed" : "text-xs leading-relaxed"}>
        {NUTRITION_DISCLAIMER}
      </p>
    </div>
  );
}
