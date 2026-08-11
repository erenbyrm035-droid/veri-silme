import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { FoodForm } from "@/features/admin/features/nutrition/ui/food-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni Besin · Admin" };

export default async function NewFoodPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition/foods"><ArrowLeft size={16} /> Besinler</Link></Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Yeni Besin</h1>
      </div>
      <FoodForm />
    </div>
  );
}
