import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  Food, AdminFoodRow, Recipe, RecipeIngredient, DietPlan,
  DietDayWithMeals, MealFood, MealRow, DietDay,
} from "@/lib/database.types";
import { PAGE_SIZE, type SortOption } from "./constants";

function sanitize(q: string): string { return q.replace(/[,()*%]/g, " ").trim(); }

function applySort(query: any, sort?: SortOption) { // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (sort) {
    case "name_asc": return query.order("name", { ascending: true });
    case "name_desc": return query.order("name", { ascending: false });
    case "calorie_desc": return query.order("calories", { ascending: false });
    case "calorie_asc": return query.order("calories", { ascending: true });
    default: return query.order("updated_at", { ascending: false });
  }
}

export interface PageResult<T> { rows: T[]; total: number; page: number; pageCount: number; pageSize: number; }

// ---- FOODS -----------------------------------------------------------------
const FOOD_COLS = "id,name,brand,category,subcategory,image_url,barcode,serving_grams,calories,protein_g,carbs_g,fat_g,is_verified,external_source,updated_at";

export interface ListFoodsParams { q?: string; category?: string; brand?: string; minCalorie?: string; maxCalorie?: string; sort?: SortOption; page?: number; }
export async function listFoods(p: ListFoodsParams): Promise<PageResult<AdminFoodRow>> {
  const supabase = createAdminClient();
  const page = Math.max(1, p.page ?? 1);
  const from = (page - 1) * PAGE_SIZE, to = from + PAGE_SIZE - 1;
  let query = supabase.from("foods").select(FOOD_COLS, { count: "exact" });
  if (p.category) query = query.eq("category", p.category);
  if (p.brand) query = query.eq("brand", p.brand);
  if (p.minCalorie) query = query.gte("calories", Number(p.minCalorie));
  if (p.maxCalorie) query = query.lte("calories", Number(p.maxCalorie));
  const term = p.q ? sanitize(p.q) : "";
  if (term) query = query.or([`name.ilike.%${term}%`, `brand.ilike.%${term}%`, `barcode.ilike.%${term}%`].join(","));
  query = applySort(query, p.sort).range(from, to);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { rows: (data ?? []) as AdminFoodRow[], total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), pageSize: PAGE_SIZE };
}
export async function getFood(id: string): Promise<Food | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("foods").select("*").eq("id", id).maybeSingle();
  return (data as Food) ?? null;
}
export async function getFoodBrands(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("foods").select("brand").not("brand", "is", null).limit(5000);
  const brands = (data ?? []).map((r: { brand: string | null }) => r.brand).filter((b: string | null): b is string => !!b);
  return [...new Set<string>(brands)].sort((a, b) => a.localeCompare(b, "tr")).slice(0, 300);
}

// ---- RECIPES ---------------------------------------------------------------
export interface ListRecipesParams { q?: string; category?: string; status?: string; sort?: SortOption; page?: number; }
export async function listRecipes(p: ListRecipesParams): Promise<PageResult<Recipe>> {
  const supabase = createAdminClient();
  const page = Math.max(1, p.page ?? 1);
  const from = (page - 1) * PAGE_SIZE, to = from + PAGE_SIZE - 1;
  let query = supabase.from("recipes").select("*", { count: "exact" });
  if (p.category) query = query.eq("category", p.category);
  if (p.status) query = query.eq("status", p.status);
  const term = p.q ? sanitize(p.q) : "";
  if (term) query = query.ilike("name", `%${term}%`);
  query = applySort(query, p.sort).range(from, to);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { rows: (data ?? []) as Recipe[], total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), pageSize: PAGE_SIZE };
}
export async function getRecipe(id: string): Promise<Recipe | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("recipes").select("*").eq("id", id).maybeSingle();
  return (data as Recipe) ?? null;
}
export async function getRecipeIngredients(id: string): Promise<RecipeIngredient[]> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("recipe_ingredients").select("*").eq("recipe_id", id).order("sort_order");
  return (data ?? []) as RecipeIngredient[];
}

// ---- DIET PLANS ------------------------------------------------------------
export interface ListDietsParams { q?: string; category?: string; status?: string; sort?: SortOption; page?: number; }
export async function listDiets(p: ListDietsParams): Promise<PageResult<DietPlan>> {
  const supabase = createAdminClient();
  const page = Math.max(1, p.page ?? 1);
  const from = (page - 1) * PAGE_SIZE, to = from + PAGE_SIZE - 1;
  let query = supabase.from("diet_plans").select("*", { count: "exact" });
  if (p.category) query = query.eq("category", p.category);
  if (p.status) query = query.eq("status", p.status);
  const term = p.q ? sanitize(p.q) : "";
  if (term) query = query.or([`name.ilike.%${term}%`, `goal.ilike.%${term}%`].join(","));
  query = applySort(query, p.sort).range(from, to);
  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  const total = count ?? 0;
  return { rows: (data ?? []) as DietPlan[], total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)), pageSize: PAGE_SIZE };
}
export async function getDiet(id: string): Promise<DietPlan | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("diet_plans").select("*").eq("id", id).maybeSingle();
  return (data as DietPlan) ?? null;
}
export async function getDietTree(id: string): Promise<DietDayWithMeals[]> {
  const supabase = createAdminClient();
  const { data: days } = await supabase.from("diet_days").select("*").eq("plan_id", id).order("day");
  const dayRows = (days ?? []) as DietDay[];
  if (dayRows.length === 0) return [];
  const { data: meals } = await supabase.from("meals").select("*").in("day_id", dayRows.map((d) => d.id)).order("sort_order");
  const mealRows = (meals ?? []) as MealRow[];
  let foods: MealFood[] = [];
  if (mealRows.length > 0) {
    const { data: mf } = await supabase.from("meal_foods").select("*").in("meal_id", mealRows.map((m) => m.id)).order("sort_order");
    foods = (mf ?? []) as MealFood[];
  }
  const foodsByMeal = new Map<string, MealFood[]>();
  foods.forEach((f) => { const l = foodsByMeal.get(f.meal_id) ?? []; l.push(f); foodsByMeal.set(f.meal_id, l); });
  const mealsByDay = new Map<string, (MealRow & { foods: MealFood[] })[]>();
  mealRows.forEach((m) => { const l = mealsByDay.get(m.day_id) ?? []; l.push({ ...m, foods: foodsByMeal.get(m.id) ?? [] }); mealsByDay.set(m.day_id, l); });
  return dayRows.map((d) => ({ ...d, meals: mealsByDay.get(d.id) ?? [] }));
}

// ---- SEARCH (builder/ingredient picker) ------------------------------------
export async function searchFoods(q: string): Promise<Pick<Food, "id" | "name" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "serving_grams">[]> {
  const supabase = createAdminClient();
  let query = supabase.from("foods").select("id, name, calories, protein_g, carbs_g, fat_g, serving_grams").order("name").limit(20);
  const term = sanitize(q);
  if (term) query = query.ilike("name", `%${term}%`);
  const { data } = await query;
  return (data ?? []) as never;
}
export async function searchRecipes(q: string): Promise<Pick<Recipe, "id" | "name" | "calories" | "protein_g" | "carbs_g" | "fat_g" | "servings">[]> {
  const supabase = createAdminClient();
  let query = supabase.from("recipes").select("id, name, calories, protein_g, carbs_g, fat_g, servings").order("name").limit(20);
  const term = sanitize(q);
  if (term) query = query.ilike("name", `%${term}%`);
  const { data } = await query;
  return (data ?? []) as never;
}

// ---- ANALYTICS + OVERVIEW --------------------------------------------------
export interface NutritionOverview {
  totalFoods: number;
  totalRecipes: number;
  totalDiets: number;
  avgCalories: number;
  macroSplit: { protein_g: number; carbs_g: number; fat_g: number };
  topFoods: { name: string; count: number }[];
  topRecipes: { name: string; favorite_count: number }[];
  topDiets: { name: string; use_count: number }[];
}
export async function getNutritionOverview(): Promise<NutritionOverview> {
  const supabase = createAdminClient();
  const [foods, recipes, diets, logs, topRecipes, topDiets] = await Promise.all([
    supabase.from("foods").select("id", { count: "exact", head: true }),
    supabase.from("recipes").select("id", { count: "exact", head: true }),
    supabase.from("diet_plans").select("id", { count: "exact", head: true }),
    supabase.from("nutrition_logs").select("food_name, calories, protein_g, carbs_g, fat_g").order("created_at", { ascending: false }).limit(5000),
    supabase.from("recipes").select("name, favorite_count").order("favorite_count", { ascending: false }).limit(5),
    supabase.from("diet_plans").select("name, use_count").order("use_count", { ascending: false }).limit(5),
  ]);
  const logRows = (logs.data ?? []) as { food_name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[];
  const counts = new Map<string, number>();
  let cal = 0, pr = 0, ca = 0, fa = 0;
  logRows.forEach((r) => {
    counts.set(r.food_name, (counts.get(r.food_name) ?? 0) + 1);
    cal += Number(r.calories); pr += Number(r.protein_g); ca += Number(r.carbs_g); fa += Number(r.fat_g);
  });
  const n = logRows.length || 1;
  return {
    totalFoods: foods.count ?? 0,
    totalRecipes: recipes.count ?? 0,
    totalDiets: diets.count ?? 0,
    avgCalories: Math.round(cal / n),
    macroSplit: { protein_g: Math.round(pr / n), carbs_g: Math.round(ca / n), fat_g: Math.round(fa / n) },
    topFoods: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    topRecipes: (topRecipes.data ?? []) as { name: string; favorite_count: number }[],
    topDiets: (topDiets.data ?? []) as { name: string; use_count: number }[],
  };
}
