"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/features/admin/features/users/guard";
import { slugify } from "./constants";
import {
  createFoodSchema, updateFoodSchema, idSchema, bulkIdsSchema, importFoodsSchema,
  createRecipeSchema, updateRecipeSchema, ingredientSchema, ingredientIdSchema,
  createDietSchema, updateDietSchema, dietDaySchema, dietDayIdSchema,
  mealSchema, mealIdSchema, mealFoodSchema, mealFoodIdSchema,
} from "./schema";

export interface ActionResult<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (error: string): ActionResult<never> => ({ ok: false, error });
const empty = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v ?? null);

function rev(paths: string[]) { paths.forEach((p) => revalidatePath(p)); }

async function uniqueSlug(supabase: ReturnType<typeof createAdminClient>, table: string, slug: string, ignoreId?: string): Promise<string> {
  let cand = slug || "kayit";
  for (let i = 0; i < 50; i++) {
    let q = supabase.from(table).select("id").eq("slug", cand).limit(1);
    if (ignoreId) q = q.neq("id", ignoreId);
    const { data } = await q;
    if (!data || data.length === 0) return cand;
    cand = `${slug}-${i + 2}`;
  }
  return `${slug}-${Date.now().toString(36)}`;
}

// ============================================================ FOODS
function foodToRow(v: z.output<typeof createFoodSchema>) {
  return {
    name: v.name.trim(), brand: empty(v.brand), category: empty(v.category), subcategory: empty(v.subcategory),
    barcode: empty(v.barcode), external_id: empty(v.external_id), external_source: empty(v.external_source),
    image_url: empty(v.image_url), serving_desc: empty(v.serving_desc) ?? "100 g", serving_grams: v.serving_grams ?? 100,
    glycemic_index: v.glycemic_index ?? null, is_verified: v.is_verified ?? false, is_turkish: v.is_turkish ?? true,
    allergens: v.allergens ?? [],
    calories: v.calories, protein_g: v.protein_g, carbs_g: v.carbs_g, fat_g: v.fat_g,
    fiber_g: v.fiber_g, sugar_g: v.sugar_g, sodium_mg: v.sodium_mg, potassium_mg: v.potassium_mg,
    cholesterol_mg: v.cholesterol_mg, calcium_mg: v.calcium_mg, iron_mg: v.iron_mg, magnesium_mg: v.magnesium_mg,
    phosphorus_mg: v.phosphorus_mg, zinc_mg: v.zinc_mg, vitamin_a_mcg: v.vitamin_a_mcg, vitamin_b_mg: v.vitamin_b_mg,
    vitamin_c_mg: v.vitamin_c_mg, vitamin_d_mcg: v.vitamin_d_mcg, vitamin_e_mg: v.vitamin_e_mg, vitamin_k_mcg: v.vitamin_k_mcg,
    omega3_g: v.omega3_g, omega6_g: v.omega6_g, water_g: v.water_g, source: "admin",
  };
}
export async function createFood(input: z.input<typeof createFoodSchema>): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();
  const parsed = createFoodSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("foods").insert(foodToRow(parsed.data)).select("id").single();
  if (error) return fail(error.message);
  rev(["/admin/nutrition/foods"]);
  return { ok: true, data: { id: data.id as string } };
}
export async function updateFood(input: z.input<typeof updateFoodSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = updateFoodSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { error } = await supabase.from("foods").update(foodToRow(parsed.data)).eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/foods", `/admin/nutrition/foods/${parsed.data.id}`]);
  return { ok: true };
}
export async function deleteFood(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("foods").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/foods"]);
  return { ok: true };
}
export async function bulkDeleteFoods(input: z.infer<typeof bulkIdsSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = bulkIdsSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("foods").delete().in("id", parsed.data.ids);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/foods"]);
  return { ok: true };
}
export async function exportFoods(format: "csv" | "json"): Promise<ActionResult<{ content: string; filename: string; mime: string }>> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data } = await supabase.from("foods").select("*").order("name").limit(10000);
  const rows = (data ?? []) as Record<string, unknown>[];
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") return { ok: true, data: { content: JSON.stringify(rows, null, 2), filename: `besinler-${stamp}.json`, mime: "application/json" } };
  const cols = ["name", "brand", "category", "barcode", "serving_grams", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg", "external_source", "external_id"];
  const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  return { ok: true, data: { content: csv, filename: `besinler-${stamp}.csv`, mime: "text/csv;charset=utf-8" } };
}
/** Toplu içe aktar — TÜRKOMP vb. dış kaynaklar için external_id ile upsert. */
export async function importFoods(input: z.infer<typeof importFoodsSchema>): Promise<ActionResult<{ inserted: number; updated: number; failed: number }>> {
  await requireAdmin();
  const parsed = importFoodsSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz içe aktarma verisi.");
  const supabase = createAdminClient();
  let inserted = 0, updated = 0, failed = 0;
  for (const raw of parsed.data.rows) {
    const candidate = createFoodSchema.safeParse({
      name: String(raw.name ?? ""), brand: raw.brand ?? "", category: raw.category ?? "",
      barcode: raw.barcode ?? "", external_id: raw.external_id ?? "", external_source: raw.external_source ?? "",
      serving_grams: raw.serving_grams != null ? Number(raw.serving_grams) : 100,
      allergens: Array.isArray(raw.allergens) ? raw.allergens : typeof raw.allergens === "string" ? String(raw.allergens).split(/[|,]/).map((s) => s.trim()).filter(Boolean) : [],
      calories: Number(raw.calories ?? 0), protein_g: Number(raw.protein_g ?? 0), carbs_g: Number(raw.carbs_g ?? 0), fat_g: Number(raw.fat_g ?? 0),
      fiber_g: Number(raw.fiber_g ?? 0), sugar_g: Number(raw.sugar_g ?? 0), sodium_mg: Number(raw.sodium_mg ?? 0), potassium_mg: Number(raw.potassium_mg ?? 0),
      cholesterol_mg: Number(raw.cholesterol_mg ?? 0), calcium_mg: Number(raw.calcium_mg ?? 0), iron_mg: Number(raw.iron_mg ?? 0),
      magnesium_mg: Number(raw.magnesium_mg ?? 0), phosphorus_mg: Number(raw.phosphorus_mg ?? 0), zinc_mg: Number(raw.zinc_mg ?? 0),
      vitamin_a_mcg: Number(raw.vitamin_a_mcg ?? 0), vitamin_b_mg: Number(raw.vitamin_b_mg ?? 0), vitamin_c_mg: Number(raw.vitamin_c_mg ?? 0),
      vitamin_d_mcg: Number(raw.vitamin_d_mcg ?? 0), vitamin_e_mg: Number(raw.vitamin_e_mg ?? 0), vitamin_k_mcg: Number(raw.vitamin_k_mcg ?? 0),
      omega3_g: Number(raw.omega3_g ?? 0), omega6_g: Number(raw.omega6_g ?? 0), water_g: Number(raw.water_g ?? 0),
    });
    if (!candidate.success || !candidate.data.name) { failed++; continue; }
    const row = { ...foodToRow(candidate.data), source: candidate.data.external_source ? candidate.data.external_source : "import" };
    // external_id varsa upsert (dış kaynak güncellemesi), yoksa insert.
    if (candidate.data.external_id && candidate.data.external_source) {
      const { data: existing } = await supabase.from("foods").select("id").eq("external_source", candidate.data.external_source).eq("external_id", candidate.data.external_id).maybeSingle();
      if (existing) { const { error } = await supabase.from("foods").update(row).eq("id", existing.id); error ? failed++ : updated++; continue; }
    }
    const { error } = await supabase.from("foods").insert(row);
    error ? failed++ : inserted++;
  }
  rev(["/admin/nutrition/foods"]);
  return { ok: true, data: { inserted, updated, failed } };
}

// ============================================================ RECIPES
function recipeToRow(v: z.output<typeof createRecipeSchema>) {
  return {
    name: v.name.trim(), slug: v.slug && v.slug.trim() ? slugify(v.slug) : slugify(v.name),
    cover_url: empty(v.cover_url), video_url: empty(v.video_url), description: empty(v.description),
    instructions: v.instructions ?? [], servings: v.servings, prep_minutes: v.prep_minutes ?? null, cook_minutes: v.cook_minutes ?? null,
    calories: v.calories, protein_g: v.protein_g, carbs_g: v.carbs_g, fat_g: v.fat_g,
    category: empty(v.category), tags: v.tags ?? [], status: v.status ?? "draft",
  };
}
export async function createRecipe(input: z.input<typeof createRecipeSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdmin();
  const parsed = createRecipeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const row = recipeToRow(parsed.data);
  row.slug = await uniqueSlug(supabase, "recipes", row.slug);
  const { data, error } = await supabase.from("recipes").insert({ ...row, created_by: ctx.id, updated_by: ctx.id }).select("id").single();
  if (error) return fail(error.message);
  rev(["/admin/nutrition/recipes"]);
  return { ok: true, data: { id: data.id as string } };
}
export async function updateRecipe(input: z.input<typeof updateRecipeSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = updateRecipeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const row = recipeToRow(parsed.data);
  row.slug = await uniqueSlug(supabase, "recipes", row.slug, parsed.data.id);
  const { error } = await supabase.from("recipes").update({ ...row, updated_by: ctx.id }).eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/recipes", `/admin/nutrition/recipes/${parsed.data.id}`]);
  return { ok: true };
}
export async function deleteRecipe(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("recipes").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/recipes"]);
  return { ok: true };
}
export async function setRecipeStatus(input: { id: string; status: "published" | "draft" }): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("recipes").update({ status: input.status }).eq("id", input.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/recipes", `/admin/nutrition/recipes/${input.id}`]);
  return { ok: true };
}
/** Malzemelerden tarif makrolarını yeniden hesaplar (porsiyon başına). */
async function recomputeRecipeMacros(supabase: ReturnType<typeof createAdminClient>, recipeId: string) {
  const { data: ings } = await supabase.from("recipe_ingredients").select("food_id, grams").eq("recipe_id", recipeId);
  const { data: recipe } = await supabase.from("recipes").select("servings").eq("id", recipeId).maybeSingle();
  const servings = Math.max(1, (recipe?.servings as number) ?? 1);
  let cal = 0, pr = 0, ca = 0, fa = 0;
  for (const ing of (ings ?? []) as { food_id: string | null; grams: number }[]) {
    if (!ing.food_id) continue;
    const { data: food } = await supabase.from("foods").select("calories, protein_g, carbs_g, fat_g").eq("id", ing.food_id).maybeSingle();
    if (!food) continue;
    const f = Number(ing.grams) / 100;
    cal += Number(food.calories) * f; pr += Number(food.protein_g) * f; ca += Number(food.carbs_g) * f; fa += Number(food.fat_g) * f;
  }
  await supabase.from("recipes").update({
    calories: Math.round(cal / servings), protein_g: Math.round((pr / servings) * 10) / 10,
    carbs_g: Math.round((ca / servings) * 10) / 10, fat_g: Math.round((fa / servings) * 10) / 10,
  }).eq("id", recipeId);
}
export async function addIngredient(input: z.input<typeof ingredientSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ingredientSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { data: cnt } = await supabase.from("recipe_ingredients").select("id").eq("recipe_id", parsed.data.recipeId);
  const { error } = await supabase.from("recipe_ingredients").insert({
    recipe_id: parsed.data.recipeId, food_id: parsed.data.food_id ?? null, name: parsed.data.name.trim(),
    grams: parsed.data.grams, note: empty(parsed.data.note), sort_order: cnt?.length ?? 0,
  });
  if (error) return fail(error.message);
  await recomputeRecipeMacros(supabase, parsed.data.recipeId);
  rev([`/admin/nutrition/recipes/${parsed.data.recipeId}`, "/admin/nutrition/recipes"]);
  return { ok: true };
}
export async function deleteIngredient(input: z.infer<typeof ingredientIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = ingredientIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("recipe_ingredients").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  await recomputeRecipeMacros(supabase, parsed.data.recipeId);
  rev([`/admin/nutrition/recipes/${parsed.data.recipeId}`]);
  return { ok: true };
}

// ============================================================ DIET PLANS
function dietToRow(v: z.output<typeof createDietSchema>) {
  return {
    name: v.name.trim(), slug: v.slug && v.slug.trim() ? slugify(v.slug) : slugify(v.name),
    cover_url: empty(v.cover_url), description: empty(v.description), goal: empty(v.goal), category: empty(v.category),
    total_calories: v.total_calories ?? null, protein_g: v.protein_g ?? null, carbs_g: v.carbs_g ?? null, fat_g: v.fat_g ?? null,
    days: v.days, tags: v.tags ?? [], status: v.status ?? "draft",
  };
}
export async function createDiet(input: z.input<typeof createDietSchema>): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireAdmin();
  const parsed = createDietSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const row = dietToRow(parsed.data);
  row.slug = await uniqueSlug(supabase, "diet_plans", row.slug);
  const { data, error } = await supabase.from("diet_plans").insert({ ...row, created_by: ctx.id, updated_by: ctx.id }).select("id").single();
  if (error) return fail(error.message);
  rev(["/admin/nutrition/diets"]);
  return { ok: true, data: { id: data.id as string } };
}
export async function updateDiet(input: z.input<typeof updateDietSchema>): Promise<ActionResult> {
  const ctx = await requireAdmin();
  const parsed = updateDietSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const row = dietToRow(parsed.data);
  row.slug = await uniqueSlug(supabase, "diet_plans", row.slug, parsed.data.id);
  const { error } = await supabase.from("diet_plans").update({ ...row, updated_by: ctx.id }).eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/diets", `/admin/nutrition/diets/${parsed.data.id}`]);
  return { ok: true };
}
export async function deleteDiet(input: z.infer<typeof idSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("diet_plans").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/diets"]);
  return { ok: true };
}
export async function setDietStatus(input: { id: string; status: "published" | "draft" }): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("diet_plans").update({ status: input.status }).eq("id", input.id);
  if (error) return fail(error.message);
  rev(["/admin/nutrition/diets", `/admin/nutrition/diets/${input.id}`]);
  return { ok: true };
}
export async function addDietDay(input: z.input<typeof dietDaySchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = dietDaySchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("diet_days").upsert({ plan_id: parsed.data.planId, day: parsed.data.day, sort_order: parsed.data.day }, { onConflict: "plan_id,day" });
  if (error) return fail(error.message);
  rev([`/admin/nutrition/diets/${parsed.data.planId}`]);
  return { ok: true };
}
export async function deleteDietDay(input: z.infer<typeof dietDayIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = dietDayIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("diet_days").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev([`/admin/nutrition/diets/${parsed.data.planId}`]);
  return { ok: true };
}
export async function addMeal(input: z.input<typeof mealSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mealSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { data: cnt } = await supabase.from("meals").select("id").eq("day_id", parsed.data.dayId);
  const { error } = await supabase.from("meals").insert({
    day_id: parsed.data.dayId, meal_type: parsed.data.meal_type, title: parsed.data.title ?? null,
    meal_time: parsed.data.meal_time ?? null, sort_order: cnt?.length ?? 0,
  });
  if (error) return fail(error.message);
  rev([`/admin/nutrition/diets/${parsed.data.planId}`]);
  return { ok: true };
}
export async function deleteMeal(input: z.infer<typeof mealIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mealIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("meals").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev([`/admin/nutrition/diets/${parsed.data.planId}`]);
  return { ok: true };
}
export async function addMealFood(input: z.input<typeof mealFoodSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mealFoodSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const supabase = createAdminClient();
  const { data: cnt } = await supabase.from("meal_foods").select("id").eq("meal_id", parsed.data.mealId);
  const { error } = await supabase.from("meal_foods").insert({
    meal_id: parsed.data.mealId, food_id: parsed.data.food_id ?? null, recipe_id: parsed.data.recipe_id ?? null,
    name: parsed.data.name.trim(), grams: parsed.data.grams,
    calories: parsed.data.calories, protein_g: parsed.data.protein_g, carbs_g: parsed.data.carbs_g, fat_g: parsed.data.fat_g,
    sort_order: cnt?.length ?? 0,
  });
  if (error) return fail(error.message);
  rev([`/admin/nutrition/diets/${parsed.data.planId}`]);
  return { ok: true };
}
export async function deleteMealFood(input: z.infer<typeof mealFoodIdSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = mealFoodIdSchema.safeParse(input);
  if (!parsed.success) return fail("Geçersiz istek.");
  const supabase = createAdminClient();
  const { error } = await supabase.from("meal_foods").delete().eq("id", parsed.data.id);
  if (error) return fail(error.message);
  rev([`/admin/nutrition/diets/${parsed.data.planId}`]);
  return { ok: true };
}
