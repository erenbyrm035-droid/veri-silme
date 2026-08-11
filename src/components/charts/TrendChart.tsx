"use client";

import dynamic from "next/dynamic";

/**
 * Recharts tembel yükleme sarmalayıcısı.
 *
 * Recharts (~150-200 kB gzip) altı dosyada statik olarak içe aktarılıyordu ve
 * grafiği hiç görmeyen kullanıcılara bile iniyordu. Gerçek uygulama
 * `TrendChart.impl.tsx` içinde; buradan yalnızca görünür olduğunda yüklenir.
 *
 * `ssr: false` — grafikler sunucuda anlamlı çıktı vermiyor (ölçüm gerektiriyor)
 * ve bu dosya bir Client Component olduğu için Next 15'te izinli.
 */
const Impl = dynamic(() => import("./TrendChart.impl").then((m) => m.TrendChart), {
  ssr: false,
  loading: () => <div className="h-[120px] animate-pulse rounded-xl bg-ink-soft/60" />,
});

export function TrendChart(props: {
  data: { label: string; value: number }[];
  unit?: string;
  color?: string;
}) {
  return <Impl {...props} />;
}
