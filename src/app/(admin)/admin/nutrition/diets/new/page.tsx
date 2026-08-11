import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { DietForm } from "@/features/admin/features/nutrition/ui/diet-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni Diyet Planı · Admin" };

export default async function NewDietPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition/diets"><ArrowLeft size={16} /> Diyet Planları</Link></Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Yeni Diyet Planı</h1>
        <p className="mt-1 text-sm text-fg-muted">Kaydettikten sonra gün ve öğünleri (builder) düzenleyebilirsin.</p>
      </div>
      <DietForm />
    </div>
  );
}
