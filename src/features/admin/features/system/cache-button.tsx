"use client";

import * as React from "react";
import { RefreshCw, Check, Loader2 } from "lucide-react";
import { Card } from "@/features/admin/components/ui/card";
import { Button } from "@/features/admin/components/ui/button";
import { clearCatalogCache } from "./actions";

/**
 * Katalog önbelleğini elle temizler.
 *
 * Veritabanı doğrudan değiştiğinde (SQL Editor'den migration, toplu
 * güncelleme) uygulama bunu bilemez ve 1 saat bayat/boş veri gösterir.
 * Bu düğme o beklemeyi ortadan kaldırır.
 */
export function ClearCacheCard() {
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  const [hata, setHata] = React.useState<string | null>(null);

  async function temizle() {
    setBusy(true);
    setHata(null);
    const res = await clearCatalogCache();
    setBusy(false);
    if (res.ok) {
      setOk(true);
      setTimeout(() => setOk(false), 4000);
    } else {
      setHata(res.error ?? "Temizlenemedi.");
    }
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <RefreshCw size={16} className="text-brand" /> Katalog Önbelleğini Temizle
        </h3>
        <p className="mt-1 text-xs text-fg-muted">
          Egzersiz, kas ve program listeleri performans için 1 saat önbellekte tutulur.
          Veritabanını doğrudan değiştirdiysen (SQL Editor, migration) değişiklikleri
          hemen görmek için buna bas.
        </p>
        {ok && <p className="mt-1 text-xs text-emerald-400">Önbellek temizlendi — sayfaları yenile.</p>}
        {hata && <p className="mt-1 text-xs text-coral">{hata}</p>}
      </div>
      <Button size="sm" onClick={temizle} disabled={busy}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : ok ? <Check size={15} /> : <RefreshCw size={15} />}
        Temizle
      </Button>
    </Card>
  );
}
