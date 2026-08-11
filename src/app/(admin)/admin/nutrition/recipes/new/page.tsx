import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { RecipeForm } from "@/features/admin/features/nutrition/ui/recipe-form";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Yeni Tarif · Admin" };

export default async function NewRecipePage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition/recipes"><ArrowLeft size={16} /> Tarifler</Link></Button>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Yeni Tarif</h1>
        <p className="mt-1 text-sm text-fg-muted">Kaydettikten sonra malzeme ekleyip makroları otomatik hesaplatabilirsin.</p>
      </div>
      <RecipeForm />
    </div>
  );
}
