import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import {
  getUserById,
  getUserStats,
  getUserNotes,
  getUserActivity,
} from "@/features/admin/features/users/queries";
import { canActOnTarget } from "@/features/admin/features/users/permissions";
import { UserDetailHeader } from "@/features/admin/features/users/ui/user-detail-header";
import { UserStatsGrid } from "@/features/admin/features/users/ui/user-stats-grid";
import { UserDetailTabs } from "@/features/admin/features/users/ui/user-detail-tabs";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const { id } = await params;
  const user = await getUserById(id);
  if (!user) notFound();

  const [stats, notes, activity] = await Promise.all([
    getUserStats(id),
    getUserNotes(id),
    getUserActivity(id),
  ]);

  const target = { id: user.id, admin_role: user.admin_role };
  const perms = {
    canPremium: canActOnTarget(ctx.role, ctx.id, target, "premium"),
    canRole: canActOnTarget(ctx.role, ctx.id, target, "role"),
    canBan: canActOnTarget(ctx.role, ctx.id, target, "ban"),
    canDelete: canActOnTarget(ctx.role, ctx.id, target, "delete"),
  };

  return (
    <div className="space-y-5">
      <UserDetailHeader user={user} />
      <UserStatsGrid stats={stats} />
      <UserDetailTabs user={user} notes={notes} activity={activity} perms={perms} />
    </div>
  );
}
