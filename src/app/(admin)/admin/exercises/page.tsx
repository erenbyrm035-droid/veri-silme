import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listExercises, getFilterOptions } from "@/features/admin/features/exercises/queries";
import { ExercisesToolbar } from "@/features/admin/features/exercises/ui/exercises-toolbar";
import { ExercisesTable } from "@/features/admin/features/exercises/ui/exercises-table";
import { ExercisesHeaderTools } from "@/features/admin/features/exercises/ui/exercises-header-tools";
import { DataPagination } from "@/features/admin/components/ui/data-pagination";
import type { ExerciseSort } from "@/features/admin/features/exercises/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Egzersizler · Admin" };

export default async function AdminExercisesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const sp = await searchParams;
  const state = {
    q: sp.q ?? "",
    category: sp.category ?? "",
    subcategory: sp.subcategory ?? "",
    difficulty: sp.difficulty ?? "",
    equipment: sp.equipment ?? "",
    muscleGroup: sp.muscleGroup ?? "",
    status: sp.status ?? "",
    sort: sp.sort ?? "updated_desc",
  };
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [{ rows, total, pageCount, pageSize }, options] = await Promise.all([
    listExercises({ ...state, sort: state.sort as ExerciseSort, page }),
    getFilterOptions(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Egzersizler</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Toplam {total} egzersiz — ara, filtrele, düzenle ve yönet.
          </p>
        </div>
        <ExercisesHeaderTools />
      </div>

      <ExercisesToolbar
        state={state}
        muscleGroups={options.muscleGroups}
        equipments={options.equipments}
        subcategories={options.subcategories}
      />
      <ExercisesTable rows={rows} />
      <DataPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} noun="egzersiz" />
    </div>
  );
}
