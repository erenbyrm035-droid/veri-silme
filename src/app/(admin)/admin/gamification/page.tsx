import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getGamAdminData } from "@/features/admin/features/gamification/queries";
import { GamificationAdmin } from "@/features/admin/features/gamification/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gamification · Admin" };

export default async function AdminGamificationPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");

  const data = await getGamAdminData();
  return <GamificationAdmin data={data} />;
}
