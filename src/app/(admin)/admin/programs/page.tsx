import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listPrograms, getFilterCategories } from "@/features/admin/features/programs/queries";
import { ProgramsToolbar } from "@/features/admin/features/programs/ui/programs-toolbar";
import { ProgramsTable } from "@/features/admin/features/programs/ui/programs-table";
import { ProgramsHeaderTools } from "@/features/admin/features/programs/ui/programs-header-tools";
import { DataPagination } from "@/features/admin/components/ui/data-pagination";
import type { ProgramSort } from "@/features/admin/features/programs/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programlar · Admin" };

export default async function AdminProgramsPage({
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
    level: sp.level ?? "",
    gender: sp.gender ?? "",
    environment: sp.environment ?? "",
    status: sp.status ?? "",
    sort: sp.sort ?? "updated_desc",
  };
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const [{ rows, total, pageCount, pageSize }, categories] = await Promise.all([
    listPrograms({ ...state, sort: state.sort as ProgramSort, page }),
    getFilterCategories(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programlar</h1>
          <p className="mt-1 text-sm text-fg-muted">Toplam {total} program — oluştur, düzenle ve yönet.</p>
        </div>
        <ProgramsHeaderTools />
      </div>
      <ProgramsToolbar state={state} categories={categories} />
      <ProgramsTable rows={rows} categories={categories} />
      <DataPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} noun="program" />
    </div>
  );
}
