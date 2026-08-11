import { Pill, Info } from "lucide-react";
import { SUPPLEMENTS } from "@/lib/constants";

/** Genel takviye bilgileri (ürün satmaz, tıbbi tavsiye vermez). */
export function SupplementsInfo() {
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Pill size={18} className="text-brand" /> Takviye Bilgileri
        </h2>
        <p className="mt-1 flex gap-2 text-xs text-fg-muted">
          <Info size={14} className="mt-0.5 shrink-0" />
          Bu bilgiler genel eğitim amaçlıdır. Takviye satışı yapılmaz; kullanmadan
          önce bir sağlık profesyoneline danışman önerilir.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SUPPLEMENTS.map((s) => (
          <div key={s.name} className="card">
            <h3 className="flex items-center gap-2 font-bold">
              <span className="text-xl">{s.emoji}</span> {s.name}
            </h3>
            <p className="mt-2 text-sm text-fg-muted">{s.what}</p>
            <p className="mt-2 text-xs">
              <span className="font-semibold text-fg">Ne zaman:</span>{" "}
              <span className="text-fg-muted">{s.when}</span>
            </p>
            <p className="mt-1 flex gap-1.5 rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-300/90">
              {s.note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
