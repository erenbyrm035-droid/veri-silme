import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listExerciseMedia, getMediaStats, type MediaFilter } from "@/features/admin/features/exercise-media/queries";
import { ExerciseMediaAdmin } from "@/features/admin/features/exercise-media/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Egzersiz Medya · Admin" };

export default async function ExerciseMediaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const sp = await searchParams;
  const q = sp.q ?? "";
  const filter = (sp.filter as MediaFilter) ?? "all";
  const page = Number(sp.page ?? "1") || 1;

  const [list, stats] = await Promise.all([
    listExerciseMedia({ q, filter, page }),
    getMediaStats(),
  ]);

  return (
    <ExerciseMediaAdmin
      rows={list.rows} total={list.total} page={list.page} pageCount={list.pageCount}
      stats={stats} q={q} filter={filter}
    />
  );
}
