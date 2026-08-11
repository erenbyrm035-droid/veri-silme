// Çok günlü kişisel beslenme planı (7/14/30 gün) + otomatik alışveriş listesi.
// Profil + hedef makrolara göre AI (varsa) veya şablon plan üretir, kaydeder.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { contentQuotaGuard } from "@/lib/premium/limits";
import { getAIProvider } from "@/lib/ai/provider";
import { calcMacroTargets } from "@/lib/nutrition";
import { NUTRITION_GOAL_LABELS } from "@/lib/constants";
import type { NutritionGoal, Goal } from "@/lib/database.types";

export const runtime = "nodejs";

const GOAL_MAP: Record<Goal, NutritionGoal> = {
  lose_weight: "lose_fat", gain_muscle: "gain_muscle", get_fit: "healthy",
  improve_endurance: "endurance", gain_strength: "strength",
};

interface DayPlan {
  day: number;
  meals: { slot: string; name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }[];
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const rl = await aiRateGuard(request, supabase, user.id);
  if (rl) return rl;
  const quota = await contentQuotaGuard(supabase, user.id, "meal_plans", "diet");
  if (quota) return quota;

  const body = await request.json().catch(() => ({}));
  const days = [7, 14, 30].includes(Number(body?.days)) ? Number(body.days) : 7;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const p = profile ?? {};
  const nutritionGoal: NutritionGoal =
    (p.nutrition_goal as NutritionGoal) || (p.goal ? GOAL_MAP[p.goal as Goal] : "healthy") || "healthy";
  const targets = calcMacroTargets({
    gender: p.gender ?? null, age: p.age ?? null, height_cm: p.height_cm ?? null, weight_kg: p.weight_kg ?? null,
    activity_level: p.activity_level ?? null, nutrition_goal: nutritionGoal, weekly_training_days: p.weekly_training_days ?? null,
  });
  const mealsPerDay = Math.min(6, Math.max(3, p.meals_per_day ?? 4));
  const allergies = ((p.allergies ?? []) as string[]).join(", ") || "yok";
  const disliked = ((p.disliked_foods ?? []) as string[]).join(", ") || "yok";
  const prefs = ((p.dietary_preferences ?? []) as string[]).join(", ") || "yok";

  const provider = getAIProvider();
  let plan: DayPlan[] | null = null;

  // AI ile örnek gün(ler) üret (30 günü tek tek üretmek pahalı → 7 örnek gün üret, döngüyle uzat).
  if (provider) {
    try {
      const sampleDays = Math.min(days, 7);
      const prompt = `Türk mutfağına uygun ${sampleDays} günlük beslenme planı oluştur.
Günlük hedef: ${targets.calories} kcal, ${targets.protein_g}g protein, ${targets.carbs_g}g karb, ${targets.fat_g}g yağ.
Günde ${mealsPerDay} öğün. Beslenme hedefi: ${NUTRITION_GOAL_LABELS[nutritionGoal]}.
Alerjiler: ${allergies}. Sevmedikleri: ${disliked}. Diyet: ${prefs}.
SADECE geçerli JSON döndür:
{"days":[{"day":1,"meals":[{"slot":"Kahvaltı","name":"yemek (Türkçe)","calories":sayı,"protein_g":sayı,"carbs_g":sayı,"fat_g":sayı}]}]}
Öğün toplamları günlük hedefe yakın olsun. Günler çeşitli olsun.`;
      const raw = await provider.complete(
        [{ role: "system", content: "Sen uzman bir spor diyetisyenisin. Yalnızca geçerli JSON döndür." },
         { role: "user", content: prompt }],
        { temperature: 0.6, maxTokens: 2500 }
      );
      const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (json && Array.isArray(json.days) && json.days.length) {
        const base: DayPlan[] = json.days;
        plan = Array.from({ length: days }, (_, i) => ({ ...base[i % base.length], day: i + 1 }));
      }
    } catch { /* şablona düş */ }
  }

  if (!plan) plan = buildTemplate(days, targets, mealsPerDay);

  // Kaydet (meal_plans.plan jsonb — çok günlü yapı).
  const { data: saved } = await supabase.from("meal_plans").insert({
    user_id: user.id,
    title: `${days} Günlük Plan · ${NUTRITION_GOAL_LABELS[nutritionGoal]}`,
    goal: nutritionGoal,
    target_calories: targets.calories, target_protein: targets.protein_g,
    target_carbs: targets.carbs_g, target_fat: targets.fat_g,
    plan: { days: plan, multi_day: true },
  }).select("id").single();

  return NextResponse.json({ id: saved?.id, days, plan, targets });
}

function buildTemplate(days: number, t: { calories: number; protein_g: number; carbs_g: number; fat_g: number }, mealsPerDay: number): DayPlan[] {
  const slots = ["Kahvaltı", "Ara Öğün", "Öğle", "Ara Öğün", "Akşam", "Gece"].slice(0, mealsPerDay);
  const ideas: Record<string, string[]> = {
    "Kahvaltı": ["Yumurta + peynir + tam buğday ekmek", "Yulaf + süt + muz", "Menemen + zeytin", "Süzme yoğurt + granola + meyve"],
    "Ara Öğün": ["Badem + elma", "Süzme yoğurt", "Protein bar", "Ceviz + kuru meyve", "Havuç + humus"],
    "Öğle": ["Izgara tavuk + bulgur pilavı + salata", "Köfte + pilav + cacık", "Ton balıklı salata", "Mercimek çorbası + tam buğday"],
    "Akşam": ["Fırın somon + sebze", "Izgara köfte + yeşil salata", "Tavuk sote + esmer pirinç", "Sebzeli omlet + peynir"],
    "Gece": ["Süzme yoğurt + tarçın", "Lor peyniri", "Kefir"],
  };
  const share = (frac: number) => frac;
  const per = mealsPerDay === 3 ? [0.3, 0.4, 0.3] : mealsPerDay === 4 ? [0.28, 0.12, 0.35, 0.25] : [0.25, 0.1, 0.3, 0.1, 0.25];
  return Array.from({ length: days }, (_, d) => ({
    day: d + 1,
    meals: slots.map((slot, i) => {
      const frac = per[i] ?? share(1 / mealsPerDay);
      const list = ideas[slot] ?? ideas["Ara Öğün"];
      return {
        slot, name: list[d % list.length],
        calories: Math.round(t.calories * frac),
        protein_g: Math.round(t.protein_g * frac),
        carbs_g: Math.round(t.carbs_g * frac),
        fat_g: Math.round(t.fat_g * frac),
      };
    }),
  }));
}
