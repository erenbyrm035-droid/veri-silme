import { AlertTriangle, ShieldAlert, Info } from "lucide-react";
import type { RiskLevel } from "@/lib/database.types";

/**
 * Klinik uyarı — uygulamanın tıbbi teşhis koymadığını belirtir.
 * Yüksek riskli analizlerde sağlık profesyoneline başvuru önerisi vurgulanır.
 */
export function ClinicalWarning({ risk }: { risk?: RiskLevel | null }) {
  if (risk === "high") {
    return (
      <div className="rounded-2xl border border-coral/30 bg-coral/10 p-4">
        <div className="flex gap-3">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-coral" />
          <div className="text-sm">
            <p className="font-semibold text-coral">Yüksek risk tespit edildi — bir sağlık profesyoneline danışın</p>
            <p className="mt-1 text-fg-muted">
              Bu analiz <strong>tıbbi teşhis değildir</strong>. Yüksek riskli bulgular için bir hekim,
              fizyoterapist veya uzmana başvurmanız önerilir. Ağrı, uyuşma veya kısıtlılık varsa
              egzersizleri uzman onayı olmadan uygulamayın.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-soft/50 p-4">
      <div className="flex gap-3">
        {risk === "moderate" ? <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" /> : <Info size={20} className="mt-0.5 shrink-0 text-fg-muted" />}
        <p className="text-sm text-fg-muted">
          Bu analiz yalnızca <strong>egzersiz ve postür farkındalığı</strong> amaçlıdır ve tıbbi teşhis
          yerine geçmez. Süregelen ağrı veya şüphe durumunda bir sağlık profesyoneline danışın.
        </p>
      </div>
    </div>
  );
}
