import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, PersonStanding } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listMuscles } from "@/features/admin/features/anatomy";
import { ListToolbar } from "@/features/admin/features/nutrition/ui/shared";
import { DataPagination } from "@/features/admin/components/ui/data-pagination";
import { EmptyState } from "@/features/admin/components/states/empty-state";
import { Badge } from "@/features/admin/components/ui/badge";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Anatomi · Admin" };

export default async function AnatomyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const sp = await searchParams;
  const state = { q: sp.q ?? "", region: sp.region ?? "" };
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const { rows, total, pageCount, pageSize } = await listMuscles({ ...state, page });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Anatomi — Kaslar</h1>
          <p className="mt-1 text-sm text-fg-muted">Toplam {total} kas. Kas kütüphanesini yönet.</p>
        </div>
        <Button asChild size="sm"><Link href="/admin/anatomy/new"><Plus size={15} /> Yeni Kas</Link></Button>
      </div>
      <ListToolbar q={state.q} sort="" placeholder="Kas adı, latince veya grup ara…"
        filters={[{ key: "region", value: state.region, label: "Bölge (tümü)", options: [{ value: "front", label: "Ön" }, { value: "back", label: "Arka" }] }]} />
      {rows.length === 0 ? (
        <EmptyState icon={PersonStanding} title="Kas bulunamadı" description="Yeni bir kas ekleyebilirsiniz." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-ink-border text-left text-xs text-fg-muted">
              <th className="px-4 py-3 font-medium">Kas</th><th className="px-2 py-3 font-medium">Grup</th>
              <th className="px-2 py-3 font-medium">Bölge</th><th className="px-2 py-3 font-medium">Fonksiyon</th><th className="px-2 py-3 font-medium">Innervasyon</th>
            </tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-ink-border/60 transition-colors last:border-0 hover:bg-fg/[0.02]">
                  <td className="px-4 py-2.5"><Link href={`/admin/anatomy/${m.id}`} className="group block min-w-0"><p className="truncate font-medium group-hover:text-brand">{m.name_tr}</p><p className="truncate text-xs text-fg-muted italic">{m.latin_name ?? "—"}</p></Link></td>
                  <td className="px-2 py-2.5 text-fg-muted">{m.muscle_group}</td>
                  <td className="px-2 py-2.5"><Badge variant="secondary">{m.region === "front" ? "Ön" : "Arka"}</Badge></td>
                  <td className="px-2 py-2.5 text-fg-muted"><span className="line-clamp-1">{m.functions.join(", ") || "—"}</span></td>
                  <td className="px-2 py-2.5 text-fg-muted">{m.innervation ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <DataPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} noun="kas" />
    </div>
  );
}
