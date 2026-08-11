import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { PageHeader } from "@/features/admin/components/layout/page-header";
import { getAiCenterData } from "@/features/admin/features/ai-center/queries";
import { AiCenterAdmin } from "@/features/admin/features/ai-center/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "AI Yönetim Merkezi · Viva Admin" };

export default async function AdminAiCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const sp = await searchParams;
  const days = Math.min(90, Math.max(1, Number(sp.days) || 7));
  const data = await getAiCenterData(days);

  return (
    <div className="space-y-6">
      <PageHeader
        title="🧭 AI Yönetim Merkezi"
        description="Uzman ajanları yönet, promptları sürümle, maliyeti ve başarıyı izle."
      />
      <AiCenterAdmin data={data} />
    </div>
  );
}
