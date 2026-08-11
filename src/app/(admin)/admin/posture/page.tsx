import { redirect } from "next/navigation";
import { ScanLine, Activity, AlertTriangle, MapPin, TrendingDown } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listAnalyses, getAnalytics } from "@/features/admin/features/posture/queries";
import { PostureToolbar } from "@/features/admin/features/posture/ui/toolbar";
import { PostureTable } from "@/features/admin/features/posture/ui/table";
import { DataPagination } from "@/features/admin/components/ui/data-pagination";
import { Card } from "@/features/admin/components/ui/card";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Postür Analizleri · Admin" };

export default async function AdminPosturePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const sp = await searchParams;
  const state = { q: sp.q ?? "", risk: sp.risk ?? "" };
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [{ rows, total, pageCount, pageSize }, a] = await Promise.all([
    listAnalyses({ ...state, page }),
    getAnalytics(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Postür Analizleri</h1>
        <p className="mt-1 text-sm text-fg-muted">Tüm kullanıcı analizleri, risk dağılımı ve istatistikler.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Toplam Analiz", value: a.total, icon: ScanLine },
          { label: "Ortalama Score", value: a.avgScore, icon: Activity },
          { label: "Yüksek Riskli", value: a.riskCounts.high, icon: AlertTriangle },
          { label: "Ülke Sayısı", value: a.countries.length, icon: MapPin },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-soft text-brand"><c.icon size={18} /></span>
            <p className="mt-3 text-2xl font-bold tracking-tight">{formatNumber(c.value)}</p>
            <p className="mt-0.5 text-xs text-fg-muted">{c.label}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={16} className="text-brand" /> En Sık Bozukluklar</h3>
          <ol className="mt-3 space-y-1.5">
            {a.topProblems.length === 0 ? <p className="text-sm text-fg-muted">Veri yok.</p> : a.topProblems.map((p, i) => (
              <li key={i} className="flex justify-between text-sm"><span className="truncate">{i + 1}. {p.label}</span><span className="text-fg-muted">{p.count}×</span></li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><TrendingDown size={16} className="text-brand" /> En Riskli Bölgeler</h3>
          <ol className="mt-3 space-y-1.5">
            {a.riskyRegions.length === 0 ? <p className="text-sm text-fg-muted">Veri yok.</p> : a.riskyRegions.map((r, i) => (
              <li key={i} className="flex justify-between text-sm"><span className="truncate">{i + 1}. {r.label}</span><span className="text-fg-muted">ort. {r.avgScore}</span></li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-brand" /> Ülke Dağılımı</h3>
          <ol className="mt-3 space-y-1.5">
            {a.countries.length === 0 ? <p className="text-sm text-fg-muted">Ülke verisi yok.</p> : a.countries.map((c, i) => (
              <li key={i} className="flex justify-between text-sm"><span className="truncate">{c.country}</span><span className="text-fg-muted">{c.count}</span></li>
            ))}
          </ol>
        </Card>
      </div>

      <PostureToolbar q={state.q} risk={state.risk} />
      <PostureTable rows={rows} />
      <DataPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} noun="analiz" />
    </div>
  );
}
