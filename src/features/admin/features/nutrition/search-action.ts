"use server";

import { requireAdmin } from "@/features/admin/features/users/guard";
import { searchFoods, searchRecipes } from "./queries";

export async function searchFoodsAction(q: string) {
  await requireAdmin();
  if (!q || q.trim().length < 2) return [];
  return searchFoods(q);
}
export async function searchRecipesAction(q: string) {
  await requireAdmin();
  if (!q || q.trim().length < 2) return [];
  return searchRecipes(q);
}
