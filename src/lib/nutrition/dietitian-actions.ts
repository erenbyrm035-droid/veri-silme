"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { computeNutritionScore, interpretNutritionScore } from "./score";
import { reportError } from "@/lib/observability/report-server";
import type { MealAnalysis, MealAnalysisItem, NutritionPreferences } from "@/lib/database.types";

export interface DietResult<T = undefined> { ok: boolean; error?: string; data?: T; }
const fail = (e: string): DietResult<never> => ({ ok: false, error: e });

async function uid(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// --- Akıllı öğün analizi (kural tabanlı; foods DB ile eşleştirir) ------------
const TR_NUMBERS: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, yarım: 0.5, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 };

/** Serbest metinden öğünü analiz eder: makro + protein/lif değerlendirmesi + alternatifler. */
export async function analyzeMealText(text: string): Promise<DietResult<MealAnalysis>> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  const clean = (text ?? "").trim();
  if (clean.length < 2) return fail("Lütfen ne yediğini yaz.");

  try {
    const admin = createAdminClient();
    const lower = clean.toLowerCase();

    // Metni kelimelere ayır; her anlamlı kelimeyi besin veritabanında ara.
    // "öğlen tavuk pilav" → tavuk (Tavuk Göğsü) + pilav (Pirinç Pilavı).
    const STOP = new Set([
      "ile","ve","bir","için","gram","gr","kase","kâse","porsiyon","adet","dilim","bardak",
      "yedim","yiyorum","içtim","bugün","sabah","öğle","öğlen","akşam","aksam","gece","ara",
      "kahvaltı","kahvaltıda","biraz","az","çok","tane","yarım","büyük","küçük","orta",
    ]);
    type FoodRow = { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number };

    // Tek kelime için en iyi besni bul: önce bulanık RPC, olmazsa ILIKE (migration öncesi de çalışır).
    async function findFood(token: string): Promise<FoodRow | null> {
      try {
        const { data, error } = await admin.rpc("search_foods", { q: token, lim: 3 });
        const rows = (data as (FoodRow & { score?: number })[]) ?? [];
        if (!error && rows.length) {
          const hit = rows.find((h) => h.name.toLowerCase().includes(token)) ?? rows[0];
          if (hit && (hit.name.toLowerCase().includes(token) || (hit.score ?? 0) > 0.55)) return hit;
        }
      } catch { /* RPC henüz yoksa ILIKE'a düş */ }
      // Fallback: 0035 öncesi de çalışsın diye popularity'ye göre sıralamadan
      // birkaç eşleşme çek, en kısa/isabetli ismi JS'te seç.
      const { data: il } = await admin
        .from("foods")
        .select("name, calories, protein_g, carbs_g, fat_g")
        .ilike("name", `%${token}%`)
        .limit(8);
      const rows = (il as FoodRow[]) ?? [];
      if (!rows.length) return null;
      // İsmi token ile başlayan veya en kısa olan → en olası eşleşme.
      rows.sort((a, b) => {
        const as = a.name.toLowerCase().startsWith(token) ? 0 : 1;
        const bs = b.name.toLowerCase().startsWith(token) ? 0 : 1;
        return as - bs || a.name.length - b.name.length;
      });
      return rows[0];
    }

    const tokens = lower.replace(/[^a-zçğıöşü0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
    const items: MealAnalysisItem[] = [];
    const used = new Set<string>();
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.length < 3 || STOP.has(tok) || /^\d+$/.test(tok)) continue;
      const food = await findFood(tok);
      if (!food || used.has(food.name)) continue;
      used.add(food.name);
      const prev = tokens[i - 1] ?? "";
      const qty = TR_NUMBERS[prev] ?? 1;
      const grams = qty * 100; // 100g referanslı
      const factor = grams / 100;
      items.push({
        name: food.name, grams: Math.round(grams),
        calories: Math.round(food.calories * factor),
        protein_g: Math.round(food.protein_g * factor * 10) / 10,
        carbs_g: Math.round(food.carbs_g * factor * 10) / 10,
        fat_g: Math.round(food.fat_g * factor * 10) / 10,
        fiber_g: 0,
      });
      if (items.length >= 8) break;
    }

    const sum = items.reduce((a, it) => ({
      calories: a.calories + (it.calories ?? 0), protein_g: a.protein_g + (it.protein_g ?? 0),
      carbs_g: a.carbs_g + (it.carbs_g ?? 0), fat_g: a.fat_g + (it.fat_g ?? 0), fiber_g: a.fiber_g + (it.fiber_g ?? 0),
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 });

    // Değerlendirme + alternatifler (kural tabanlı, profesyonel dil)
    const assessment: string[] = [];
    const alternatives: string[] = [];
    if (items.length === 0) {
      assessment.push("Bu öğünü besin veritabanında eşleştiremedim. Ürünü daha açık yazar mısın (örn. 'kepekli ekmek 2 dilim')?");
    } else {
      const proteinDensity = sum.calories ? (sum.protein_g * 4) / sum.calories : 0;
      if (proteinDensity < 0.15) {
        assessment.push(`Bu öğünde protein düşük (${Math.round(sum.protein_g)}g). Kaslarını korumak için protein eklemelisin.`);
        alternatives.push("Yanına haşlanmış yumurta, yoğurt veya peynir ekle.");
      } else {
        assessment.push(`Protein dengesi iyi (${Math.round(sum.protein_g)}g).`);
      }
      const PRODUCE_RE = /elma|muz|portakal|domates|salatalık|marul|ıspanak|brokoli|havuç|biber|yeşillik|meyve|sebze|çilek|üzüm|armut|avokado|patlıcan|kabak|roka|salata|mercimek|nohut|fasulye|bakla/i;
      const hasProduce = items.some((it) => PRODUCE_RE.test(it.name));
      if (!hasProduce) {
        assessment.push("Öğünde sebze/meyve görünmüyor. Lif ve mikrobesin için eklemek faydalı olur.");
        alternatives.push("Yanına salata veya bir porsiyon sebze/meyve ekle.");
      }
      const wholeGrain = /tam tahıl|kepek|yulaf|bulgur|esmer/i.test(lower);
      if (!wholeGrain && /ekmek|pirinç|makarna|un/i.test(lower)) {
        alternatives.push("Beyaz un/pirinç yerine tam tahıl (bulgur, kepekli, yulaf) tercih et.");
      }
      if (sum.calories > 700) alternatives.push("Porsiyonu biraz küçültmek kalori dengesi için iyi olabilir.");
    }

    // Mini skor: protein yoğunluğu (0.25 hedef) + sebze/meyve varlığı
    const hasProduceForScore = items.some((it) => /elma|muz|domates|salata|sebze|meyve|yeşillik|mercimek|nohut/i.test(it.name));
    const score = Math.max(0, Math.min(100, Math.round(
      (sum.calories ? Math.min(1, (sum.protein_g * 4) / sum.calories / 0.25) : 0) * 65 +
      (hasProduceForScore ? 35 : 0)
    )));

    const { data: saved, error } = await admin.from("meal_analysis").insert({
      user_id: userId, input_text: clean, items,
      calories: Math.round(sum.calories), protein_g: Math.round(sum.protein_g * 10) / 10,
      carbs_g: Math.round(sum.carbs_g * 10) / 10, fat_g: Math.round(sum.fat_g * 10) / 10,
      fiber_g: Math.round(sum.fiber_g * 10) / 10, score,
      assessment: assessment.join(" "), alternatives, source: "rule",
    }).select("*").single();
    if (error) return fail(error.message);
    return { ok: true, data: saved as MealAnalysis };
  } catch (err) {
    await reportError(err, { where: "dietitian/analyzeMealText", userId });
    return fail("Analiz yapılamadı.");
  }
}

// --- Dolabımdakiler → CMS tarif önerisi -------------------------------------
export interface PantryMatch { recipe_id: string; title: string; matched: string[]; missing: string[]; coverage: number; }

export async function suggestFromPantry(ingredients: string[]): Promise<DietResult<PantryMatch[]>> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  const have = ingredients.map((i) => i.toLowerCase().trim()).filter(Boolean);
  if (have.length === 0) return fail("En az bir malzeme yaz.");

  try {
    const admin = createAdminClient();
    const { data: recipes } = await admin
      .from("recipes").select("id, name, recipe_ingredients(name)").eq("status", "published").limit(200);
    const rows = (recipes as { id: string; name: string; recipe_ingredients: { name: string }[] }[]) ?? [];

    const matches: PantryMatch[] = rows.map((r) => {
      const ings = (r.recipe_ingredients ?? []).map((x) => x.name);
      const matched = ings.filter((ing) => have.some((h) => ing.toLowerCase().includes(h) || h.includes(ing.toLowerCase())));
      const missing = ings.filter((ing) => !matched.includes(ing));
      return { recipe_id: r.id, title: r.name, matched, missing, coverage: ings.length ? matched.length / ings.length : 0 };
    })
      .filter((m) => m.matched.length > 0)
      .sort((a, b) => b.coverage - a.coverage || b.matched.length - a.matched.length)
      .slice(0, 8);

    return { ok: true, data: matches };
  } catch (err) {
    await reportError(err, { where: "dietitian/suggestFromPantry", userId });
    return fail("Tarif önerisi alınamadı.");
  }
}

/** Bir tarifi geçmişe kaydeder (öneri kabul edilince). */
export async function logRecipe(recipeId: string | null, title: string, source: "cms" | "pantry" | "ai"): Promise<DietResult> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  const admin = createAdminClient();
  await admin.from("recipe_history").insert({ user_id: userId, recipe_id: recipeId, title, source });
  revalidatePath("/nutrition/coach");
  return { ok: true };
}

// --- Tercihler + hafıza ------------------------------------------------------
/**
 * GÜVENLİK: `.strict()` — bilinmeyen anahtar reddedilir ve `user_id` spread'den
 * SONRA yazılır. Aksi halde hazırlanmış bir çağrı `payload.user_id` göndererek
 * başka bir kullanıcının tercih satırına yazabilirdi (tip kontrolü çalışma
 * zamanında yoktur).
 */
const nutritionPrefsSchema = z.object({
  activity_level: z.string().max(40).nullable().optional(),
  weekly_training: z.number().int().min(0).max(14).nullable().optional(),
  daily_steps: z.number().int().min(0).max(100_000).nullable().optional(),
  sleep_hours: z.number().min(0).max(24).nullable().optional(),
  meals_per_day: z.number().int().min(1).max(10).nullable().optional(),
  dietary_preference: z.string().max(40).nullable().optional(),
  allergies: z.array(z.string().max(60)).max(50).optional(),
  disliked_foods: z.array(z.string().max(60)).max(100).optional(),
  favorite_foods: z.array(z.string().max(60)).max(100).optional(),
  supplements: z.array(z.string().max(60)).max(50).optional(),
  digestion_issues: z.array(z.string().max(60)).max(50).optional(),
  health_notes: z.string().max(2000).nullable().optional(),
  budget_weekly: z.number().min(0).max(1_000_000).nullable().optional(),
  cooks_at_home: z.boolean().nullable().optional(),
  work_hours: z.string().max(60).nullable().optional(),
  target_weight_kg: z.number().min(20).max(400).nullable().optional(),
}).strict();

export async function saveNutritionPreferences(payload: Partial<NutritionPreferences>): Promise<DietResult> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");

  const parsed = nutritionPrefsSchema.safeParse(payload);
  if (!parsed.success) return fail("Geçersiz tercih verisi.");

  const admin = createAdminClient();
  const { error } = await admin.from("nutrition_preferences").upsert(
    { ...parsed.data, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: "user_id" }
  );
  if (error) return fail(error.message);
  // Anahtar alanları profiles ile senkronla (diğer modüller kullanır)
  const profilePatch: Record<string, unknown> = {};
  if (payload.target_weight_kg != null) profilePatch.target_weight_kg = payload.target_weight_kg;
  if (payload.meals_per_day != null) profilePatch.meals_per_day = payload.meals_per_day;
  if (payload.favorite_foods) profilePatch.favorite_foods = payload.favorite_foods;
  if (payload.disliked_foods) profilePatch.disliked_foods = payload.disliked_foods;
  if (Object.keys(profilePatch).length) await admin.from("profiles").update(profilePatch).eq("id", userId);
  revalidatePath("/nutrition/coach");
  return { ok: true };
}

export async function addNutritionMemory(fact: string): Promise<DietResult> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  const f = fact.trim();
  if (f.length < 2) return fail("Boş not eklenemez.");
  const admin = createAdminClient();
  await admin.from("nutrition_memory").insert({ user_id: userId, fact: f, source: "user" });
  revalidatePath("/nutrition/coach");
  return { ok: true };
}

export async function resetNutritionMemory(): Promise<DietResult> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  const admin = createAdminClient();
  await admin.from("nutrition_memory").delete().eq("user_id", userId);
  revalidatePath("/nutrition/coach");
  return { ok: true };
}

// --- Alışveriş listesi (elle düzenlenebilir) --------------------------------
export type ShoppingGroup = { category: string; items: string[] };

/**
 * Kullanıcının alışveriş listesini kaydeder (kategori bazlı öğeler).
 * Mevcut liste varsa günceller, yoksa oluşturur → tek "aktif" liste tutulur.
 */
export async function saveShoppingList(items: ShoppingGroup[]): Promise<DietResult<{ id: string }>> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  // Boş kategorileri ve öğeleri temizle.
  const clean: ShoppingGroup[] = (items ?? [])
    .map((g) => ({ category: (g.category || "Diğer").trim(), items: (g.items ?? []).map((i) => i.trim()).filter(Boolean) }))
    .filter((g) => g.items.length > 0);
  try {
    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("shopping_lists").select("id").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.id) {
      const { error } = await admin.from("shopping_lists").update({ items: clean }).eq("id", existing.id);
      if (error) return fail(error.message);
      revalidatePath("/nutrition/coach");
      return { ok: true, data: { id: existing.id } };
    }
    const { data, error } = await admin
      .from("shopping_lists")
      .insert({ user_id: userId, title: "Alışveriş Listesi", items: clean })
      .select("id").single();
    if (error) return fail(error.message);
    revalidatePath("/nutrition/coach");
    return { ok: true, data: { id: data!.id } };
  } catch (err) {
    await reportError(err, { where: "dietitian/saveShoppingList", userId });
    return fail("Liste kaydedilemedi.");
  }
}

/** Nutrition Score'u hesaplar, kaydeder ve döndürür. */
export async function refreshNutritionScore(): Promise<DietResult<{ score: number; comment: string; breakdown: Record<string, number> }>> {
  const userId = await uid();
  if (!userId) return fail("Oturum bulunamadı.");
  try {
    const result = await computeNutritionScore(userId);
    const comment = interpretNutritionScore(result);
    const admin = createAdminClient();
    await admin.from("nutrition_scores").upsert(
      { user_id: userId, score_date: new Date().toISOString().slice(0, 10), score: result.score, breakdown: result.breakdown, ai_comment: comment },
      { onConflict: "user_id,score_date" }
    );
    revalidatePath("/nutrition/coach");
    return { ok: true, data: { score: result.score, comment, breakdown: result.breakdown } };
  } catch (err) {
    await reportError(err, { where: "dietitian/refreshNutritionScore", userId });
    return fail("Skor hesaplanamadı.");
  }
}
