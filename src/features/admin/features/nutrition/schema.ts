import { z } from "zod";
import { MEAL_TYPE_VALUES } from "./constants";

const num = (max = 100000) => z.coerce.number().min(0).max(max);
const numNull = (max = 100000) => z.coerce.number().min(0).max(max).nullable().optional();
const statusEnum = z.enum(["published", "draft"]);

// ---- FOODS -----------------------------------------------------------------
export const foodSchema = z.object({
  name: z.string().trim().min(2, "En az 2 karakter").max(160),
  brand: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  category: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  subcategory: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  barcode: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  external_id: z.string().trim().max(80).nullable().optional().or(z.literal("")),
  external_source: z.string().trim().max(40).nullable().optional().or(z.literal("")),
  image_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  serving_desc: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  serving_grams: numNull(5000),
  glycemic_index: z.coerce.number().int().min(0).max(150).nullable().optional(),
  is_verified: z.boolean().default(false),
  is_turkish: z.boolean().default(true),
  allergens: z.array(z.string().trim()).default([]),
  // 100g başına makro + mikro
  calories: num(2000),
  protein_g: num(200), carbs_g: num(200), fat_g: num(200),
  fiber_g: num(200), sugar_g: num(200),
  sodium_mg: num(20000), potassium_mg: num(20000), cholesterol_mg: num(5000),
  calcium_mg: num(20000), iron_mg: num(1000), magnesium_mg: num(20000),
  phosphorus_mg: num(20000), zinc_mg: num(1000),
  vitamin_a_mcg: num(100000), vitamin_b_mg: num(1000), vitamin_c_mg: num(10000),
  vitamin_d_mcg: num(10000), vitamin_e_mg: num(10000), vitamin_k_mcg: num(10000),
  omega3_g: num(200), omega6_g: num(200), water_g: num(100),
});
export const createFoodSchema = foodSchema;
export const updateFoodSchema = foodSchema.extend({ id: z.string().uuid() });
export const idSchema = z.object({ id: z.string().uuid() });
export const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });
export const importFoodsSchema = z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000) });

// ---- RECIPES ---------------------------------------------------------------
export const recipeSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(200).optional().or(z.literal("")),
  cover_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  video_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  description: z.string().trim().max(4000).nullable().optional().or(z.literal("")),
  instructions: z.array(z.string().trim()).default([]),
  servings: z.coerce.number().int().min(1).max(100),
  prep_minutes: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  cook_minutes: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  calories: num(20000), protein_g: num(2000), carbs_g: num(2000), fat_g: num(2000),
  category: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  tags: z.array(z.string().trim()).default([]),
  status: statusEnum.default("draft"),
});
export const createRecipeSchema = recipeSchema;
export const updateRecipeSchema = recipeSchema.extend({ id: z.string().uuid() });

export const ingredientSchema = z.object({
  recipeId: z.string().uuid(),
  food_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  grams: z.coerce.number().min(0).max(10000),
  note: z.string().trim().max(200).nullable().optional().or(z.literal("")),
});
export const ingredientIdSchema = z.object({ id: z.string().uuid(), recipeId: z.string().uuid() });

// ---- DIET PLANS ------------------------------------------------------------
export const dietSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(200).optional().or(z.literal("")),
  cover_url: z.string().trim().url().nullable().optional().or(z.literal("")),
  description: z.string().trim().max(6000).nullable().optional().or(z.literal("")),
  goal: z.string().trim().max(120).nullable().optional().or(z.literal("")),
  category: z.string().trim().max(60).nullable().optional().or(z.literal("")),
  total_calories: z.coerce.number().int().min(0).max(20000).nullable().optional(),
  protein_g: z.coerce.number().int().min(0).max(2000).nullable().optional(),
  carbs_g: z.coerce.number().int().min(0).max(2000).nullable().optional(),
  fat_g: z.coerce.number().int().min(0).max(2000).nullable().optional(),
  days: z.coerce.number().int().min(1).max(90),
  tags: z.array(z.string().trim()).default([]),
  status: statusEnum.default("draft"),
});
export const createDietSchema = dietSchema;
export const updateDietSchema = dietSchema.extend({ id: z.string().uuid() });

export const dietDaySchema = z.object({ planId: z.string().uuid(), day: z.coerce.number().int().min(1).max(90) });
export const dietDayIdSchema = z.object({ id: z.string().uuid(), planId: z.string().uuid() });

export const mealSchema = z.object({
  dayId: z.string().uuid(), planId: z.string().uuid(),
  meal_type: z.enum(MEAL_TYPE_VALUES as [string, ...string[]]),
  title: z.string().trim().max(120).optional(),
  meal_time: z.string().trim().max(20).optional(),
});
export const mealIdSchema = z.object({ id: z.string().uuid(), planId: z.string().uuid() });

export const mealFoodSchema = z.object({
  mealId: z.string().uuid(), planId: z.string().uuid(),
  food_id: z.string().uuid().nullable().optional(),
  recipe_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(160),
  grams: z.coerce.number().min(0).max(10000),
  calories: num(20000), protein_g: num(2000), carbs_g: num(2000), fat_g: num(2000),
});
export const mealFoodIdSchema = z.object({ id: z.string().uuid(), planId: z.string().uuid() });

export type FoodFormValues = z.input<typeof foodSchema>;
export type RecipeFormValues = z.input<typeof recipeSchema>;
export type DietFormValues = z.input<typeof dietSchema>;
