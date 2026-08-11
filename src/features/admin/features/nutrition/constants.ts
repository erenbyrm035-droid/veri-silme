import type { NutritionMealType } from "@/lib/database.types";

export const PAGE_SIZE = 20;

export const FOOD_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "meat", name: "Et & Tavuk" }, { slug: "fish", name: "Balık & Deniz" },
  { slug: "dairy", name: "Süt Ürünleri" }, { slug: "vegetables", name: "Sebzeler" },
  { slug: "fruits", name: "Meyveler" }, { slug: "grains", name: "Tahıllar" },
  { slug: "legumes", name: "Baklagiller" }, { slug: "nuts", name: "Kuruyemiş" },
  { slug: "oils", name: "Yağlar" }, { slug: "beverages", name: "İçecekler" },
  { slug: "snacks", name: "Atıştırmalık" }, { slug: "bakery", name: "Fırın" },
  { slug: "supplements", name: "Takviyeler" }, { slug: "fastfood", name: "Fast Food" },
  { slug: "other", name: "Diğer" },
];
export const FOOD_CATEGORY_NAME = new Map(FOOD_CATEGORIES.map((c) => [c.slug, c.name]));

export const MEAL_TYPES: { value: NutritionMealType; label: string }[] = [
  { value: "breakfast", label: "Kahvaltı" },
  { value: "snack", label: "Ara Öğün" },
  { value: "lunch", label: "Öğle" },
  { value: "pre_workout", label: "Antrenman Öncesi" },
  { value: "post_workout", label: "Antrenman Sonrası" },
  { value: "dinner", label: "Akşam" },
  { value: "supper", label: "Gece" },
];
export const MEAL_TYPE_LABEL = new Map(MEAL_TYPES.map((m) => [m.value, m.label]));
export const MEAL_TYPE_VALUES = MEAL_TYPES.map((m) => m.value);

export const DIET_CATEGORIES: { slug: string; name: string }[] = [
  { slug: "muscle_gain", name: "Kas Kazanma" }, { slug: "fat_burn", name: "Yağ Yakımı" },
  { slug: "weight_gain", name: "Kilo Alma" }, { slug: "weight_loss", name: "Kilo Verme" },
  { slug: "maintenance", name: "Maintenance" }, { slug: "vegan", name: "Vegan" },
  { slug: "vegetarian", name: "Vejetaryen" }, { slug: "keto", name: "Ketojenik" },
  { slug: "low_carb", name: "Low Carb" }, { slug: "mediterranean", name: "Mediterranean" },
  { slug: "gluten_free", name: "Glutensiz" }, { slug: "lactose_free", name: "Laktozsuz" },
];
export const DIET_CATEGORY_NAME = new Map(DIET_CATEGORIES.map((c) => [c.slug, c.name]));

export const COMMON_ALLERGENS = [
  "Gluten", "Laktoz", "Yumurta", "Fıstık", "Kuruyemiş", "Soya", "Balık",
  "Kabuklu Deniz Ürünü", "Susam", "Hardal",
];

export type SortOption = "updated_desc" | "name_asc" | "name_desc" | "calorie_desc" | "calorie_asc";
export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "updated_desc", label: "Son güncellenen" },
  { value: "name_asc", label: "İsim A-Z" },
  { value: "name_desc", label: "İsim Z-A" },
  { value: "calorie_desc", label: "Kalori (çok→az)" },
  { value: "calorie_asc", label: "Kalori (az→çok)" },
];

export function slugify(input: string): string {
  const map: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
  return input.split("").map((ch) => map[ch] ?? ch).join("").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
