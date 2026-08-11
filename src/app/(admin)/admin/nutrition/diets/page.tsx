import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listDiets } from "@/features/admin/features/nutrition/queries";
import { DietsTable } from "@/features/admin/features/nutrition/ui/diets-table";
import { ListToolbar } from "@/features/admin/features/nutrition/ui/shared";
import { DataPagination } from "@/features/admin/components/ui/data-pagination";
import { DIET_CATEGORIES } from "@/features/admin/features/nutrition/constants";
import { Button } from "@/features/admin/components/ui/button";
import type { SortOption } from "@/features/admin/features/nutrition/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diyet Planları · Admin" };

export default async function DietsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const sp = await searchParams;
  const state = { q: sp.q ?? "", category: sp.category ?? "", status: sp.status ?? "", sort: sp.sort ?? "updated_desc" };
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const { rows, total, pageCount, pageSize } = await listDiets({ ...state, sort: state.sort as SortOption, page });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition"><ArrowLeft size={16} /> Nutrition</Link></Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Diyet Planları</h1>
          <p className="mt-1 text-sm text-fg-muted">Toplam {total} plan.</p>
        </div>
        <Button asChild size="sm"><Link href="/admin/nutrition/diets/new"><Plus size={15} /> Yeni Diyet Planı</Link></Button>
      </div>
      <ListToolbar q={state.q} sort={state.sort} placeholder="Diyet planı ara…"
        filters={[
          { key: "category", value: state.category, label: "Kategori (tümü)", options: DIET_CATEGORIES.map((c) => ({ value: c.slug, label: c.name })) },
          { key: "status", value: state.status, label: "Durum (tümü)", options: [{ value: "published", label: "Yayında" }, { value: "draft", label: "Taslak" }] },
        ]} />
      <DietsTable rows={rows} />
      <DataPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} noun="plan" />
    </div>
  );
}
