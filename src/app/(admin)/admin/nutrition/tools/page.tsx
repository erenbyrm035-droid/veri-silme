import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { NutritionTools } from "@/features/admin/features/nutrition/ui/nutrition-tools";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Beslenme Araçları · Admin" };

export default async function NutritionToolsPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition"><ArrowLeft size={16} /> Nutrition</Link></Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Kalori & Makro Araçları</h1>
        <p className="mt-1 text-sm text-fg-muted">BMR / TDEE / BMI / FFMI / vücut yağı / ideal kilo + yüzde bazlı makro builder.</p>
      </div>
      <NutritionTools />
    </div>
  );
}
