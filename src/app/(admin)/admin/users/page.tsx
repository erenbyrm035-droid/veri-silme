import { redirect } from "next/navigation";
import { PageHeader } from "@/features/admin/components/layout/page-header";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { listUsers } from "@/features/admin/features/users/queries";
import { UsersToolbar } from "@/features/admin/features/users/ui/users-toolbar";
import { UsersTable } from "@/features/admin/features/users/ui/users-table";
import { UsersPagination } from "@/features/admin/features/users/ui/users-pagination";
import type { UserFilter, UserSort } from "@/features/admin/features/users/constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Kullanıcılar · Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const sp = await searchParams;
  const q = sp.q ?? "";
  const filter = (sp.filter as UserFilter) ?? "all";
  const sort = (sp.sort as UserSort) ?? "newest";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  const { rows, total, pageCount, pageSize } = await listUsers({ q, filter, sort, page });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kullanıcılar"
        description={`Toplam ${total} kullanıcı — ara, filtrele ve yönet.`}
      />
      <UsersToolbar q={q} filter={filter} sort={sort} />
      <UsersTable rows={rows} actorRole={ctx.role} actorId={ctx.id} />
      <UsersPagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} />
    </div>
  );
}
