import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calcMacroTargets } from "@/lib/nutrition";
import { getTodayNutrition } from "@/lib/data/nutrition";
import { getNutritionMemory, retrieveFoodContext, formatFoodContext } from "./food-db";
import { GOAL_LABELS, NUTRITION_GOAL_LABELS } from "@/lib/constants";
import type { NutritionGoal, Goal } from "@/lib/database.types";
import { buildInsightBlock } from "@/lib/ai/insights";

const GOAL_MAP: Record<Goal, NutritionGoal> = {
  lose_weight: "lose_fat", gain_muscle: "gain_muscle", get_fit: "healthy",
  improve_endurance: "endurance", gain_strength: "strength",
};

/**
 * AI Diyetisyen için TAM bağlamlı sistem promptu.
 * Kullanıcının profili + hedefleri + bugünkü makroları + su + antrenman +
 * fitness/nutrition skoru + AI hafızası + (RAG) doğrulanmış besin değerleri.
 * Amaç: gerçek bir spor diyetisyeni gibi, uydurmadan, veriye dayalı öneri.
 */
export async function buildDietitianSystemPrompt(userId: string, userMessage: string): Promise<string> {
  const supabase = await createClient();
  const [{ data: profile }, today, memory, foodHits, { data: workouts }, { data: score }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    getTodayNutrition(userId),
    getNutritionMemory(userId),
    retrieveFoodContext(userMessage),
    supabase.from("workouts").select("title, workout_date, status").eq("user_id", userId).order("workout_date", { ascending: false }).limit(3),
    supabase.from("fitness_scores").select("score").eq("user_id", userId).maybeSingle(),
  ]);

  const p = profile ?? {};
  const nutritionGoal: NutritionGoal =
    (p.nutrition_goal as NutritionGoal) || (p.goal ? GOAL_MAP[p.goal as Goal] : "healthy") || "healthy";
  const targets = calcMacroTargets({
    gender: p.gender ?? null, age: p.age ?? null, height_cm: p.height_cm ?? null, weight_kg: p.weight_kg ?? null,
    activity_level: p.activity_level ?? null, nutrition_goal: nutritionGoal, weekly_training_days: p.weekly_training_days ?? null,
  });

  const remaining = {
    kcal: Math.max(0, targets.calories - Math.round(today.calories)),
    protein: Math.max(0, targets.protein_g - Math.round(today.protein_g)),
  };

  const memLines = memory
    .map((m) => `- ${m.fact}`).join("\n") || "Henüz kayıt yok.";
  const allergies = (p.allergies ?? []) as string[];
  const disliked = (p.disliked_foods ?? []) as string[];
  const prefs = (p.dietary_preferences ?? []) as string[];
  const workoutLine = (workouts ?? []).map((w: { workout_date: string; title: string; status: string }) =>
    `${w.workout_date}: ${w.title}${w.status === "completed" ? " ✓" : ""}`).join(" · ") || "yok";

  const ragBlock = foodHits.length ? `\n\n${formatFoodContext(foodHits)}` : "";

  // Koçla aynı içgörü bloğu — diyetisyen de kullanıcının gerçek verisine değinsin.
  const insightBlock = await buildInsightBlock(userId);

  return `Sen "Viva Diyetisyen"; Türkçe konuşan, deneyimli bir SPOR DİYETİSYENİsin. Sohbet ettiğin kişiye gerçek bir diyetisyen gibi, kişiselleştirilmiş, bilimsel ve uygulanabilir beslenme tavsiyeleri veriyorsun. Türk mutfağını ve marketteki ürünleri iyi biliyorsun.

═══ KULLANICI PROFİLİ ═══
İsim: ${p.full_name ?? "?"} | Yaş: ${p.age ?? "?"} | Cinsiyet: ${p.gender ?? "?"}
Boy: ${p.height_cm ?? "?"} cm | Kilo: ${p.weight_kg ?? "?"} kg | Hedef kilo: ${p.target_weight_kg ?? "?"} kg
Fitness hedefi: ${p.goal ? GOAL_LABELS[p.goal as Goal] : "?"} | Beslenme hedefi: ${NUTRITION_GOAL_LABELS[nutritionGoal]}
Aktivite: ${p.activity_level ?? "?"} | Haftalık antrenman: ${p.weekly_training_days ?? "?"} gün | Uyku: ${p.sleep_hours ?? "?"} saat
Su hedefi: ${p.daily_water_goal_ml ?? 2500} ml | Fitness skoru: ${(score as { score?: number })?.score ?? "?"}

═══ GÜNLÜK HEDEFLER ═══
Kalori: ${targets.calories} kcal | Protein: ${targets.protein_g}g | Karb: ${targets.carbs_g}g | Yağ: ${targets.fat_g}g

═══ BUGÜN ALINAN (canlı) ═══
Kalori: ${Math.round(today.calories)} kcal | Protein: ${Math.round(today.protein_g)}g | Karb: ${Math.round(today.carbs_g)}g | Yağ: ${Math.round(today.fat_g)}g | Su: ${today.waterMl} ml | Öğün: ${today.mealCount}
KALAN: ${remaining.kcal} kcal, ${remaining.protein}g protein

═══ TERCİHLER & KISITLAR (mutlaka uy) ═══
Alerjiler: ${allergies.join(", ") || "yok"} | Sevmedikleri: ${disliked.join(", ") || "yok"} | Diyet: ${prefs.join(", ") || "yok"}

═══ AI HAFIZASI ═══
${memLines}

═══ SON ANTRENMANLAR ═══
${workoutLine}${ragBlock}${insightBlock}

═══ KURALLAR ═══
- Gerçek bir diyetisyen gibi sıcak, net ve motive edici konuş.
- Besin değeri verirken ÖNCE yukarıdaki DOĞRULANMIŞ BESİN VERİTABANI'nı kullan; orada yoksa makul tahmin ver ve "yaklaşık" olduğunu belirt. Kesinlikle rastgele/uydurma değer verme.
- Önerileri kullanıcının KALAN kalori/protein bütçesine ve hedefine göre ver.
- Alerji ve sevilmeyen besinleri ASLA önerme.
- Türk mutfağı ve marketteki (Pınar, Sütaş, Eti vb.) ürünlerden örnekler ver.
- Tıbbi tavsiye/ilaç önerme; gerektiğinde uzman/doktora yönlendir.
- Cevaplar kısa-orta uzunlukta olsun.
- ÇOK ÖNEMLİ — BİÇİM: Markdown KULLANMA. Asla yıldız (**), diyez (#, ##, ###) veya başlık işareti kullanma. Sadece düz metin yaz. Liste gerekirse her satırın başına "• " koy.`;
}
