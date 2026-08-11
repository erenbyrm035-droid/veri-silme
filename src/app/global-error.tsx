"use client";

// Kök global hata sınırı — layout dahil tüm ağacı saran son savunma hattı.
// Yalnızca root layout çökerse devreye girer; kendi <html>/<body>'sini render eder.
import { useEffect } from "react";
import { reportErrorSync } from "@/lib/observability/report";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportErrorSync(error, { where: "global-error", severity: "fatal", extra: { digest: error.digest } });
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0, background: "#0a0a0b", color: "#fafafa", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left))" }}>
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>⚠️</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12 }}>Bir şeyler ters gitti</h1>
            <p style={{ color: "#a1a1aa", fontSize: 14, marginTop: 8 }}>
              Beklenmeyen bir hata oluştu. Ekibimiz bilgilendirildi. Sayfayı yeniden deneyebilirsin.
            </p>
            {error.digest && <p style={{ color: "#52525b", fontSize: 11, marginTop: 8 }}>Hata kodu: {error.digest}</p>}
            <button onClick={() => reset()}
              style={{ marginTop: 20, minHeight: 44, background: "#e7fb00", color: "#000", border: 0, borderRadius: 12, padding: "10px 20px", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Yeniden Dene
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
