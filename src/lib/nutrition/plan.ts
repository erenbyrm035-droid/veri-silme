// ============================================================================
// Öğün planı + alışveriş listesi üreticisi (deterministik fallback).
// AI anahtarı varsa API bunu zenginleştirir; yoksa bu şablon kullanılır.
// Türk mutfağı odaklı öğün şablonları.
// ============================================================================
import type {
  MacroTargets,
  MealSlot,
  MealPlanItem,
  MealPlanData,
  ShoppingCategoryGroup,
} from "@/lib/database.types";

interface MealTemplate {
  title: string;
  recipe: string;
  prep_minutes: number;
  cost_tl: number;
  // makro dağılım ağırlığı (protein/carb/fat vurgusu)
  protein_bias: number;
  ingredients: { name: string; category: string }[];
  veg: boolean;
  vegan: boolean;
}

// Öğün başına kalori payı
const SLOT_SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  snack1: 0.1,
  lunch: 0.3,
  snack2: 0.1,
  dinner: 0.2,
  supper: 0.05,
};

const TEMPLATES: Record<MealSlot, MealTemplate[]> = {
  breakfast: [
    {
      title: "Menemen + Tam Buğday Ekmek",
      recipe: "Domates, biber ve yumurtayla menemen; yanında tam buğday ekmek ve beyaz peynir.",
      prep_minutes: 15, cost_tl: 45, protein_bias: 1.1, veg: true, vegan: false,
      ingredients: [
        { name: "Yumurta", category: "Süt Ürünleri" },
        { name: "Domates", category: "Sebze" },
        { name: "Yeşil biber", category: "Sebze" },
        { name: "Beyaz peynir", category: "Süt Ürünleri" },
        { name: "Tam buğday ekmek", category: "Tahıllar" },
      ],
    },
    {
      title: "Yulaf Ezmesi + Muz + Ceviz",
      recipe: "Süt/su ile pişmiş yulaf, üzerine muz dilimleri ve ceviz.",
      prep_minutes: 10, cost_tl: 35, protein_bias: 0.9, veg: true, vegan: true,
      ingredients: [
        { name: "Yulaf", category: "Tahıllar" },
        { name: "Muz", category: "Meyve" },
        { name: "Ceviz", category: "Atıştırmalıklar" },
        { name: "Süt", category: "Süt Ürünleri" },
      ],
    },
    {
      title: "Peynirli Yumurta + Zeytin",
      recipe: "2-3 yumurtalı omlet, lor peyniri, zeytin ve domates-salatalık.",
      prep_minutes: 12, cost_tl: 40, protein_bias: 1.2, veg: true, vegan: false,
      ingredients: [
        { name: "Yumurta", category: "Süt Ürünleri" },
        { name: "Lor peyniri", category: "Süt Ürünleri" },
        { name: "Zeytin", category: "Atıştırmalıklar" },
        { name: "Salatalık", category: "Sebze" },
      ],
    },
  ],
  snack1: [
    {
      title: "Yoğurt + Meyve",
      recipe: "Sade yoğurt üzerine mevsim meyvesi ve tarçın.",
      prep_minutes: 3, cost_tl: 20, protein_bias: 1.1, veg: true, vegan: false,
      ingredients: [
        { name: "Yoğurt", category: "Süt Ürünleri" },
        { name: "Elma", category: "Meyve" },
      ],
    },
    {
      title: "Kefir + Badem",
      recipe: "Bir bardak kefir ve bir avuç badem.",
      prep_minutes: 2, cost_tl: 22, protein_bias: 1.0, veg: true, vegan: false,
      ingredients: [
        { name: "Kefir", category: "Süt Ürünleri" },
        { name: "Badem", category: "Atıştırmalıklar" },
      ],
    },
  ],
  lunch: [
    {
      title: "Izgara Tavuk + Bulgur Pilavı + Salata",
      recipe: "Izgara tavuk göğsü, bulgur pilavı ve bol yeşillikli mevsim salata.",
      prep_minutes: 25, cost_tl: 70, protein_bias: 1.3, veg: false, vegan: false,
      ingredients: [
        { name: "Tavuk göğsü", category: "Et" },
        { name: "Bulgur", category: "Tahıllar" },
        { name: "Marul", category: "Sebze" },
        { name: "Domates", category: "Sebze" },
      ],
    },
    {
      title: "Mercimek Çorbası + Tavuklu Wrap",
      recipe: "Kırmızı mercimek çorbası ve tam buğday lavaşta tavuklu wrap.",
      prep_minutes: 30, cost_tl: 60, protein_bias: 1.2, veg: false, vegan: false,
      ingredients: [
        { name: "Kırmızı mercimek", category: "Bakliyat" },
        { name: "Tavuk göğsü", category: "Et" },
        { name: "Lavaş", category: "Tahıllar" },
      ],
    },
    {
      title: "Nohut Yemeği + Pirinç + Cacık",
      recipe: "Zeytinyağlı nohut, pirinç pilavı ve cacık.",
      prep_minutes: 35, cost_tl: 50, protein_bias: 1.0, veg: true, vegan: false,
      ingredients: [
        { name: "Nohut", category: "Bakliyat" },
        { name: "Pirinç", category: "Tahıllar" },
        { name: "Yoğurt", category: "Süt Ürünleri" },
        { name: "Salatalık", category: "Sebze" },
      ],
    },
  ],
  snack2: [
    {
      title: "Protein Shake + Muz",
      recipe: "1 ölçek protein tozu, süt/su ve bir muz.",
      prep_minutes: 3, cost_tl: 30, protein_bias: 1.4, veg: true, vegan: false,
      ingredients: [
        { name: "Protein tozu", category: "Atıştırmalıklar" },
        { name: "Muz", category: "Meyve" },
        { name: "Süt", category: "Süt Ürünleri" },
      ],
    },
    {
      title: "Ayran + Kuruyemiş",
      recipe: "Bir bardak ayran ve karışık kuruyemiş.",
      prep_minutes: 2, cost_tl: 18, protein_bias: 0.9, veg: true, vegan: false,
      ingredients: [
        { name: "Ayran", category: "Süt Ürünleri" },
        { name: "Fındık", category: "Atıştırmalıklar" },
      ],
    },
  ],
  dinner: [
    {
      title: "Fırında Somon + Sebze + Kinoa",
      recipe: "Fırınlanmış somon, buharda sebze ve kinoa.",
      prep_minutes: 30, cost_tl: 120, protein_bias: 1.3, veg: false, vegan: false,
      ingredients: [
        { name: "Somon", category: "Et" },
        { name: "Brokoli", category: "Sebze" },
        { name: "Kinoa", category: "Tahıllar" },
      ],
    },
    {
      title: "Köfte + Közlenmiş Sebze",
      recipe: "Izgara köfte, közlenmiş biber-patlıcan ve yoğurt.",
      prep_minutes: 30, cost_tl: 90, protein_bias: 1.2, veg: false, vegan: false,
      ingredients: [
        { name: "Kıyma", category: "Et" },
        { name: "Patlıcan", category: "Sebze" },
        { name: "Biber", category: "Sebze" },
        { name: "Yoğurt", category: "Süt Ürünleri" },
      ],
    },
    {
      title: "Sebzeli Bulgur + Mercimek Köftesi",
      recipe: "Sebzeli bulgur pilavı ve mercimek köftesi (vejetaryen).",
      prep_minutes: 35, cost_tl: 45, protein_bias: 1.0, veg: true, vegan: true,
      ingredients: [
        { name: "Bulgur", category: "Tahıllar" },
        { name: "Kırmızı mercimek", category: "Bakliyat" },
        { name: "Maydanoz", category: "Sebze" },
      ],
    },
  ],
  supper: [
    {
      title: "Lor Peyniri + Ceviz",
      recipe: "Bir kase lor peyniri ve birkaç ceviz.",
      prep_minutes: 2, cost_tl: 20, protein_bias: 1.3, veg: true, vegan: false,
      ingredients: [
        { name: "Lor peyniri", category: "Süt Ürünleri" },
        { name: "Ceviz", category: "Atıştırmalıklar" },
      ],
    },
    {
      title: "Süzme Yoğurt + Tarçın",
      recipe: "Süzme yoğurt üzerine tarçın; yatmadan önce hafif protein.",
      prep_minutes: 2, cost_tl: 15, protein_bias: 1.2, veg: true, vegan: false,
      ingredients: [{ name: "Süzme yoğurt", category: "Süt Ürünleri" }],
    },
  ],
};

const SLOT_ORDER: MealSlot[] = ["breakfast", "snack1", "lunch", "snack2", "dinner", "supper"];

function pickTemplate(slot: MealSlot, prefs: string[], seed: number): MealTemplate {
  const vegan = prefs.includes("vegan");
  const vegetarian = vegan || prefs.includes("vegetarian");
  let pool = TEMPLATES[slot].filter((t) =>
    vegan ? t.vegan : vegetarian ? t.veg : true
  );
  if (pool.length === 0) pool = TEMPLATES[slot];
  return pool[seed % pool.length];
}

/** Deterministik öğün planı: makro hedeflerini 6 öğüne dağıtır. */
export function buildTemplateMealPlan(
  targets: MacroTargets,
  prefs: string[] = []
): MealPlanData {
  const seed = Math.floor(Date.now() / 86400000); // günlük değişen çeşitlilik
  const meals: MealPlanItem[] = SLOT_ORDER.map((slot, i) => {
    const t = pickTemplate(slot, prefs, seed + i);
    const share = SLOT_SHARE[slot];
    const cals = Math.round(targets.calories * share);
    // Protein'i bias ile dağıt, sonra normalize edilecek gibi basit yaklaşım.
    const protein = Math.round(targets.protein_g * share * t.protein_bias);
    const fat = Math.round(targets.fat_g * share);
    const carbs = Math.max(0, Math.round((cals - protein * 4 - fat * 9) / 4));
    const fiber = Math.round(targets.fiber_g * share);
    return {
      slot,
      title: t.title,
      recipe: t.recipe,
      calories: cals,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
      fiber_g: fiber,
      prep_minutes: t.prep_minutes,
      cost_tl: t.cost_tl,
    };
  });

  const total = meals.reduce(
    (a, m) => ({
      calories: a.calories + m.calories,
      protein_g: a.protein_g + m.protein_g,
      carbs_g: a.carbs_g + m.carbs_g,
      fat_g: a.fat_g + m.fat_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );

  return { meals, total };
}

/** Plan öğünlerinden kategori bazlı alışveriş listesi üretir. */
export function buildShoppingList(prefs: string[] = []): ShoppingCategoryGroup[] {
  const seed = Math.floor(Date.now() / 86400000);
  const byCat = new Map<string, Set<string>>();
  SLOT_ORDER.forEach((slot, i) => {
    const t = pickTemplate(slot, prefs, seed + i);
    for (const ing of t.ingredients) {
      if (!byCat.has(ing.category)) byCat.set(ing.category, new Set());
      byCat.get(ing.category)!.add(ing.name);
    }
  });
  return Array.from(byCat.entries()).map(([category, items]) => ({
    category,
    items: Array.from(items),
  }));
}
