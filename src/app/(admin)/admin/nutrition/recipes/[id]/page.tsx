import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAdminContext } from "@/features/admin/features/users/guard";
import { getRecipe, getRecipeIngredients } from "@/features/admin/features/nutrition/queries";
import { RecipeForm } from "@/features/admin/features/nutrition/ui/recipe-form";
import { IngredientManager } from "@/features/admin/features/nutrition/ui/ingredient-manager";
import { ContentStatusBadge } from "@/features/admin/features/nutrition/ui/shared";
import { Button } from "@/features/admin/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/dashboard");
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();
  const ingredients = await getRecipeIngredients(id);
  const macrosLocked = ingredients.some((i) => i.food_id);

  return (
    <div className="space-y-5">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/admin/nutrition/recipes"><ArrowLeft size={16} /> Tarifler</Link></Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{recipe.name}</h1>
          <ContentStatusBadge status={recipe.status} />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><RecipeForm recipe={recipe} macrosLocked={macrosLocked} /></div>
        <IngredientManager recipeId={id} ingredients={ingredients} />
      </div>
    </div>
  );
}
