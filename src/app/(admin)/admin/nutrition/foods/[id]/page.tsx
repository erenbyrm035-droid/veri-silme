import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getFood } from "@/features/admin/features/nutrition/queries";
import { FoodForm } from "@/features/admin/features/nutrition/ui/food-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const { id } = await params;
  const food = await getFood(id);
  if (!food) notFound();
  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition/foods"><ArrowLeft size={16} /> Besinler</Link></Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{food.name}</h1>
      </div>
      <FoodForm food={food} />
    </div>
  );
}
