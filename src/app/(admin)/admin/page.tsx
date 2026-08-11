import { PageHeader } from "@/features/admin/components/layout/page-header";
import { DashboardView } from "@/features/admin/components/dashboard/dashboard-view";
import { getDashboardData } from "@/features/admin/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const data = await getDashboardData();
  return (
    <div>
      <PageHeader title="Dashboard" description="Platform genel bakışı — gerçek metrikler." />
      <DashboardView data={data} />
    </div>
  );
}
