import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { PageHeader } from "@/features/admin/components/layout/page-header";
import { getRewardsAdmin } from "@/features/admin/features/rewards/queries";
import { RewardsAdmin } from "@/features/admin/features/rewards/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ödül Merkezi · Viva Admin" };

export default async function AdminRewardsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const data = await getRewardsAdmin();

  return (
    <div className="space-y-6">
      <PageHeader
        title="🎁 Ödül Merkezi"
        description="Ödülleri yönet, talepleri karara bağla, ekonomiyi izle."
      />
      <RewardsAdmin data={data} />
    </div>
  );
}
