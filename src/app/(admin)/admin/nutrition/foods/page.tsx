import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listFoods, getFoodBrands } from "@/features/admin/features/nutrition/queries";
import { FoodsTable } from "@/features/admin/features/nutrition/ui/foods-table";
import { FoodsHeaderTools } from "@/features/admin/features/nutrition/ui/foods-header-tools";
import { ListToolbar } from "@/features/admin/features/nutrition/ui/shared";
import { DataPagination } from "@/features/admin/components/ui/data-pagination";
import { FOOD_CATEGORIES } from "@/features/admin/features/nutrition/constants";
import { Button } from "@/features/admin/components/ui/button";
import type { SortOption } from "@/features/admin/features/nutrition/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Besinler · Admin" };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const sp = await searchParams;
  const state = { q: sp.q ?? "", category: sp.category ?? "", brand: sp.brand ?? "", sort: sp.sort ?? "updated_desc" };
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [{ rows, total, pageCount, pageSize }, brands] = await Promise.all([
    listFoods({ ...state, sort: state.sort as SortOption, page }),
    getFoodBrands(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition"><ArrowLeft size={16} /> Nutrition</Link></Button>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Besin Veritabanı</h1>
          <p className="mt-1 text-sm text-fg-muted">Toplam {total} besin — 100 g başına değerler.</p>
        </div>
        <FoodsHeaderTools />
      </div>
      <ListToolbar q={state.q} sort={state.sort} placeholder="Besin, marka veya barkod ara…"
        filters={[
          { key: "category", value: state.category, label: "Kategori (tümü)", options: FOOD_CATEGORIES.map((c) => ({ value: c.slug, label: c.name })) },
          { key: "brand", value: state.brand, label: "Marka (tümü)", options: brands.map((b) => ({ value: b, label: b })) },
        ]} />
      <FoodsTable rows={rows} />
      <DataPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} noun="besin" />
    </div>
  );
}
