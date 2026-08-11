import "server-only";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** Aramadan/DB'den dönen tek besin kaydı. */
export interface FoodHit {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  serving_desc: string | null;
  serving_grams: number | null;
  is_turkish: boolean;
  is_restaurant: boolean;
  score?: number;
}

/**
 * Bulanık besin araması — pg_trgm tabanlı search_foods RPC (10k+ besinde <100ms).
 * "tvk" → Tavuk, "prot" → Protein Tozu gibi önek + typo toleranslı.
 */
export async function searchFoods(query: string, limit = 20): Promise<FoodHit[]> {
  const q = (query ?? "").trim();
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("search_foods", { q, lim: limit });
  if (error || !data) return [];
  return data as FoodHit[];
}

/** Tek besin (id ile). */
export async function getFoodById(id: string): Promise<FoodHit | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("foods")
    .select("id, name, brand, category, calories, protein_g, carbs_g, fat_g, fiber_g, serving_desc, serving_grams, is_turkish, is_restaurant")
    .eq("id", id)
    .maybeSingle();
  return (data as FoodHit) ?? null;
}

/** Restoran adına göre menü kalemleri. */
export async function getRestaurantMenu(restaurant: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("restaurant_foods")
    .select("id, restaurant, item_name, category, calories, protein_g, carbs_g, fat_g, serving_desc")
    .ilike("restaurant", restaurant)
    .order("category", { ascending: true });
  return data ?? [];
}

/** Sistemdeki tüm restoranların adları (menü modu için). */
export async function listRestaurants(): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("restaurant_foods").select("restaurant");
  const set = new Set<string>((data ?? []).map((r: { restaurant: string }) => r.restaurant));
  return [...set].sort();
}

/**
 * RAG bağlamı: kullanıcının sorusundan anahtar kelimeleri çıkarıp DB'den
 * gerçek besin değerlerini getirir. AI'ya "kafadan makro üretme" yerine
 * bu doğrulanmış değerleri verir.
 */
export async function retrieveFoodContext(userText: string, maxFoods = 12): Promise<FoodHit[]> {
  const text = (userText ?? "").toLowerCase();
  // Türkçe stop-word'leri ele, 3+ harfli kelimeleri aday yap.
  const stop = new Set(["ile","ve","bir","için","gram","adet","kase","porsiyon","yedim","yiyorum","bugün","kaç","kalori","protein","makro","ne","nasıl","olur","daha","gibi","çok","az"]);
  const words = text.replace(/[^a-zçğıöşü0-9\s]/gi, " ").split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w));
  const uniq = [...new Set(words)].slice(0, 8);
  const hits: FoodHit[] = [];
  const seen = new Set<string>();
  for (const w of uniq) {
    const res = await searchFoods(w, 3);
    for (const h of res) {
      if (!seen.has(h.id) && (h.score ?? 0) > 0.5) {
        seen.add(h.id);
        hits.push(h);
      }
    }
    if (hits.length >= maxFoods) break;
  }
  return hits.slice(0, maxFoods);
}

/** AI hafızası: kullanıcının beslenme tercihleri (serbest notlar — fact). */
export async function getNutritionMemory(userId: string): Promise<{ fact: string; kind: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("nutrition_memory")
    .select("fact, kind")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data as { fact: string; kind: string }[]) ?? [];
}

/** RAG besin bağlamını AI system prompt'una uygun metne çevirir. */
export function formatFoodContext(hits: FoodHit[]): string {
  if (!hits.length) return "";
  const lines = hits.map((h) => {
    const per = h.serving_grams ? `${h.serving_grams}g` : "100g";
    const b = h.brand ? ` [${h.brand}]` : "";
    return `- ${h.name}${b} (${per}): ${Math.round(h.calories)} kcal, P:${h.protein_g}g K:${h.carbs_g}g Y:${h.fat_g}g`;
  });
  return `DOĞRULANMIŞ BESİN VERİTABANI (bu değerleri kullan, kendin makro uydurma):\n${lines.join("\n")}`;
}
