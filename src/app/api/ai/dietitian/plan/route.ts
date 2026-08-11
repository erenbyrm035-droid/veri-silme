// AI Diyetisyen V3 — görüşme sonrası ANALİZ + kişiselleştirilmiş PLAN üretimi.
// Çıktı: yalnızca JSON. Markdown/HTML YOK. Frontend kartları kendisi çizer.
// action:"generate" → tam plan (analiz + günler + alışveriş listesi)
// action:"meal"     → tek öğünü yeniden üretir (ör. "kahvaltıyı değiştir")
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getEntitlements } from "@/lib/premium/entitlements";
import { FREE_LIMITS } from "@/lib/premium/plans";
import { getAIProvider } from "@/lib/ai/provider";
import { stripMarkdown } from "@/lib/ai/strip-markdown";
import { calcMacroTargets } from "@/lib/nutrition";
import { GOAL_LABEL, type InterviewAnswers, type DietDay, type DietMeal, type ShoppingGroup } from "@/lib/nutrition/interview";
import type { NutritionGoal, ActivityLevel } from "@/lib/database.types";
import { reportError } from "@/lib/observability/report-server";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Görüşme cevapları → makro hedefleri ------------------------------------
function goalToNutrition(goal: unknown): NutritionGoal {
  switch (String(goal)) {
    case "gain_muscle": case "gain_weight": return "gain_muscle";
    case "lose_fat": case "lose_weight": return "lose_fat";
    default: return "healthy";
  }
}
function deriveActivity(a: InterviewAnswers): ActivityLevel {
  const d = Number(a.training_days) || 0;
  if (d >= 6) return "athlete";
  if (d >= 4) return "active";
  if (d >= 2) return "moderate";
  if (d >= 1) return "light";
  return "sedentary";
}

function buildContext(a: InterviewAnswers): string {
  const list = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? "")) || "belirtilmedi";
  const one = (v: unknown) => (v === "" || v == null ? "belirtilmedi" : String(v));
  const meals = Number(a.meals_per_day) || 4;
  return [
    `Hedef: ${GOAL_LABEL[String(a.goal)] ?? one(a.goal)}`,
    `Boy/Kilo/Yaş/Cinsiyet: ${one(a.height_cm)}cm / ${one(a.weight_kg)}kg / ${one(a.age)} / ${one(a.gender)}`,
    `Haftalık antrenman: ${one(a.training_days)} gün, saati: ${one(a.training_time)}`,
    `Uyanma/uyku: ${one(a.wake_time)} / ${one(a.sleep_time)}`,
    `Öğün sayısı tercihi: ${meals}`,
    `Kahvaltı: ${one(a.breakfast)}`,
    `Sevdikleri: ${list(a.favorites)}`,
    `SEVMEDİKLERİ (asla koyma): ${list(a.dislikes)}`,
    `ALERJİLER (kesinlikle koyma): ${list(a.allergies)}`,
    `İntoleranslar (koyma): ${list(a.intolerances)}`,
    `Sağlık durumu: ${list(a.conditions)}`,
    `Takviyeler: ${list(a.supplements)}`,
    `Günlük bütçe: ${one(a.budget)} TL`,
    `Yemek yapımı: ${one(a.cooking)}`,
    `Evdeki malzemeler: ${list(a.pantry)}`,
    `Su: ${one(a.water_l)} L/gün, oturma: ${one(a.sitting_hours)} saat/gün`,
    `Meslek: ${one(a.occupation)}`,
    `Hafta sonu farklı mı: ${one(a.weekend_diff)}, cheat meal: ${one(a.cheat)}/hafta`,
  ].join("\n");
}

const SYSTEM = "Sen Viva uygulamasının deneyimli spor diyetisyenisin. Kullanıcıyla görüşme yaptın, şimdi kişiye özel plan kuruyorsun. Türk mutfağını ve marketteki ürünleri iyi biliyorsun. ÇOK ÖNEMLİ: Yanıtın SADECE geçerli JSON olacak. Markdown, açıklama, ``` işareti veya düz metin EKLEME. JSON dışında tek karakter yazma.";

// Kullanıcıya göre GEREKLİ öğün slotları — her gün bunların HEPSİ olmalı.
function requiredSlots(a: InterviewAnswers): string[] {
  const trains = (Number(a.training_days) || 0) >= 1 && String(a.training_time) !== "none";
  const goal = String(a.goal);
  const bulking = goal === "gain_muscle" || goal === "gain_weight";
  const mpd = Number(a.meals_per_day) || 4;
  const slots = ["Kahvaltı", "Ara Öğün", "Öğle Yemeği"];
  if (trains) slots.push("Antrenman Öncesi", "Antrenman Sonrası");
  slots.push("Akşam Yemeği");
  if (bulking || mpd >= 6) slots.push("Gece Öğünü");
  return slots;
}

// Slot bazlı yaklaşık makro payları (toplam ~1.0). Eksik slot varsa normalize edilir.
const SLOT_SHARE: Record<string, number> = {
  "Kahvaltı": 0.22, "Ara Öğün": 0.10, "Öğle Yemeği": 0.25,
  "Antrenman Öncesi": 0.10, "Antrenman Sonrası": 0.13, "Akşam Yemeği": 0.25, "Gece Öğünü": 0.08,
};

// Her günün TÜM gerekli slotları içermesini garanti eder (AI eksik bırakırsa
// başka bir tam günden o slotu kopyalar). Frontend'e asla eksik gün gitmez.
function ensureComplete(days: DietDay[], slots: string[]): DietDay[] {
  const fallback: Record<string, DietMeal> = {};
  for (const s of slots) {
    for (const d of days) {
      const m = d.meals?.find((x) => x.slot === s);
      if (m?.name) { fallback[s] = m; break; }
    }
  }
  return days.map((d) => {
    const meals = slots.map((s) => {
      const m = d.meals?.find((x) => x.slot === s);
      return m?.name ? { ...m, slot: s } : (fallback[s] ? { ...fallback[s] } : null);
    }).filter(Boolean) as DietMeal[];
    return { day: d.day, meals };
  });
}

// Bir günün tam olup olmadığı (tüm slotlar dolu mu).
function dayComplete(d: DietDay, slots: string[]): boolean {
  return slots.every((s) => d.meals?.some((m) => m.slot === s && !!m.name));
}

function parseJson(raw: string): unknown {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  const slice = start >= 0 && end > start ? clean.slice(start, end + 1) : clean;
  return JSON.parse(slice);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const rl = await aiRateGuard(request, supabase, user.id);
  if (rl) return rl;

  const provider = getAIProvider();
  if (!provider) return NextResponse.json({ error: "AI şu anda yapılandırılmamış." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const action: string = body?.action ?? "generate";
  const admin = createAdminClient();

  // Görüşme cevapları + üyelik durumu.
  const [{ data: prof }, { data: pProfile }] = await Promise.all([
    admin.from("dietitian_profiles").select("answers, completed").eq("user_id", user.id).maybeSingle(),
    admin.from("profiles").select("is_premium, membership_type, premium_until").eq("id", user.id).maybeSingle(),
  ]);
  const ent = getEntitlements(pProfile ?? undefined);
  const answers: InterviewAnswers = (prof?.answers as InterviewAnswers) ?? {};
  if (!answers.goal) return NextResponse.json({ error: "Önce görüşmeyi tamamla." }, { status: 400 });

  const targets = calcMacroTargets({
    gender: (answers.gender as "male" | "female") ?? null,
    age: Number(answers.age) || null,
    height_cm: Number(answers.height_cm) || null,
    weight_kg: Number(answers.weight_kg) || null,
    activity_level: deriveActivity(answers),
    nutrition_goal: goalToNutrition(answers.goal),
    weekly_training_days: Number(answers.training_days) || null,
  });
  const T = { calories: targets.calories, protein: targets.protein_g, carbs: targets.carbs_g, fat: targets.fat_g };
  const meals = Math.min(6, Math.max(3, Number(answers.meals_per_day) || 4));

  try {
    // ------------------------------------------------------------------ MEAL
    if (action === "meal") {
      if (!ent.isPremium) {
        return NextResponse.json({ error: "Öğün değiştirme Premium'a özel. Sınırsız değiştirme için Premium'a yükselt.", upgrade: "/premium" }, { status: 402 });
      }
      const planId: string = body?.planId ?? "";
      const dayNo = Number(body?.day) || 1;
      const slot: string = body?.slot ?? "";
      const { data: row } = await admin.from("dietitian_plans").select("id, plan").eq("id", planId).eq("user_id", user.id).maybeSingle();
      if (!row) return NextResponse.json({ error: "Plan bulunamadı." }, { status: 404 });
      const days = ((row.plan as { days?: DietDay[] })?.days ?? []) as DietDay[];
      const day = days.find((d) => d.day === dayNo);
      const old = day?.meals.find((m) => m.slot === slot);

      const prompt = `Kullanıcı bilgileri:\n${buildContext(answers)}\n
Günlük hedef: ${T.calories} kcal, ${T.protein}g protein, ${T.carbs}g karb, ${T.fat}g yağ.
"${slot}" öğünü için YENİ bir öğün öner (öncekinden farklı olsun${old ? `; önceki: ${old.name}` : ""}).
Sadece şu JSON'u döndür:
{"slot":"${slot}","name":"...","grams":"porsiyon açıklaması","calories":sayı,"protein":sayı,"carbs":sayı,"fat":sayı,"prep_min":sayı,"recipe":"kısa tarif düz metin","alternatives":["alternatif 1","alternatif 2"]}`;
      const raw = await provider.complete(
        [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }],
        { temperature: 0.8, maxTokens: 600 }
      );
      const meal = parseJson(raw) as DietMeal;
      if (!meal?.name) throw new Error("meal parse");
      // Planı güncelle.
      const newDays = days.map((d) => d.day !== dayNo ? d : {
        ...d, meals: d.meals.map((m) => (m.slot === slot ? { ...meal, slot } : m)),
      });
      await admin.from("dietitian_plans").update({ plan: { days: newDays } }).eq("id", planId);
      return NextResponse.json({ meal: { ...meal, slot }, day: dayNo });
    }

    // -------------------------------------------------------------- GENERATE
    let span = [7, 14, 30].includes(Number(body?.days)) ? Number(body.days) : 7;

    // Free kısıtları: 14/30 gün Premium; en fazla 1 tadımlık plan.
    if (!ent.isPremium) {
      if (span > FREE_LIMITS.dietMaxSpan) {
        return NextResponse.json({ error: `${span} günlük plan Premium'a özel. Ücretsiz sürümde ${FREE_LIMITS.dietMaxSpan} günlük plan oluşturabilirsin.`, upgrade: "/premium" }, { status: 402 });
      }
      span = Math.min(span, FREE_LIMITS.dietMaxSpan);
      const { count } = await admin.from("dietitian_plans").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if ((count ?? 0) >= FREE_LIMITS.maxDiets) {
        return NextResponse.json({ error: `Ücretsiz sürümde ${FREE_LIMITS.maxDiets} diyet planı oluşturabilirsin. Sınırsız plan ve güncelleme için Premium'a yükselt.`, upgrade: "/premium" }, { status: 402 });
      }
    }

    const distinct = Math.min(span, 5); // 5 farklı tam gün üret, döngüyle span'e uzat
    const slots = requiredSlots(answers);

    // Slot bazlı makro payı ipucu (yalnızca bu plandaki slotlar üzerinden normalize).
    const shareSum = slots.reduce((s, x) => s + (SLOT_SHARE[x] ?? 0.15), 0) || 1;
    const shareHint = slots.map((s) => {
      const f = (SLOT_SHARE[s] ?? 0.15) / shareSum;
      return `${s}: ~${Math.round(T.calories * f)} kcal / ${Math.round(T.protein * f)}g P`;
    }).join(", ");

    const slotSchema = slots.map((s) =>
      `     {"slot":"${s}","name":"...","grams":"porsiyon açıklaması","calories":0,"protein":0,"carbs":0,"fat":0,"prep_min":0,"recipe":"kısa tarif düz metin","alternatives":["...","..."]}`
    ).join(",\n");

    const buildPrompt = (strict: boolean) => `Bir spor diyetisyeni olarak bu kişiyi analiz et ve plan kur.\n\nKULLANICI:\n${buildContext(answers)}\n
Hesaplanan günlük hedef: ${T.calories} kcal, ${T.protein}g protein, ${T.carbs}g karbonhidrat, ${T.fat}g yağ.

ZORUNLU KURALLAR:
1) ${distinct} FARKLI ve EKSİKSİZ gün üret (çeşitli, Türk mutfağı, sıkıcı olmayan).
2) HER GÜN tam olarak şu ${slots.length} öğünü İÇERMELİ, sırayla: ${slots.join(", ")}. Hiçbir öğünü atlama, sadece kahvaltı üretme.
3) Öğünlerin makro toplamı günlük hedefe ÇOK YAKIN olsun (±%5). Yaklaşık dağılım: ${shareHint}.
4) Her öğünde: yemek adı, gramaj, kalori, protein, karbonhidrat, yağ, hazırlama süresi (dk), kısa tarif ve en az 2 alternatif olsun.
5) Sevmedikleri, alerjenleri ve intoleransları ASLA kullanma. Bütçeye ve evdeki malzemelere uygun ol.${strict ? "\n6) ÖNEMLİ: Bir önceki denemende bazı günlerde öğünler eksikti. Bu sefer HER GÜN yukarıdaki TÜM öğünleri eksiksiz doldur." : ""}

SADECE şu JSON şemasını döndür (Markdown yok, açıklama yok, tüm günler için tüm slotları doldur):
{
 "analysis":"Kullanıcıyı neden bu şekilde planladığını 4-6 cümlede, sıcak ve net bir dille anlat. Günlük toplam hedefe (${T.calories} kcal, ${T.protein}g protein) nasıl ulaştığını belirt. Düz metin.",
 "days":[
   {"day":1,"meals":[
${slotSchema}
   ]}
 ],
 "shopping":[{"category":"Protein","items":["Tavuk göğsü 1 kg","Yumurta 30 adet"]}]
}`;

    // Üret + doğrula; eksik gün varsa bir kez daha (strict) dene.
    async function generateOnce(strict: boolean) {
      const raw = await provider!.complete(
        [{ role: "system", content: SYSTEM }, { role: "user", content: buildPrompt(strict) }],
        { temperature: strict ? 0.5 : 0.7, maxTokens: 12000 }
      );
      return parseJson(raw) as { analysis?: string; days?: DietDay[]; shopping?: ShoppingGroup[] };
    }

    let json = await generateOnce(false);
    let baseDays = Array.isArray(json.days) ? json.days : [];
    // Tüm günler tam mı? Değilse strict retry.
    if (!baseDays.length || !baseDays.every((d) => dayComplete(d, slots))) {
      try {
        const retry = await generateOnce(true);
        const retryDays = Array.isArray(retry.days) ? retry.days : [];
        // Daha çok tam gün üreten sonucu seç.
        const score = (ds: DietDay[]) => ds.filter((d) => dayComplete(d, slots)).length;
        if (retryDays.length && score(retryDays) >= score(baseDays)) { json = retry; baseDays = retryDays; }
      } catch { /* ilk sonucu kullan */ }
    }
    if (!baseDays.length) return NextResponse.json({ error: "Plan üretilemedi, tekrar dene." }, { status: 502 });

    // Her günü eksiksiz hale getir (garanti), sonra span'e uzat.
    const complete = ensureComplete(baseDays, slots);
    const days: DietDay[] = Array.from({ length: span }, (_, i) => ({
      ...complete[i % complete.length], day: i + 1,
    }));
    const analysis = stripMarkdown(String(json.analysis ?? "").trim());
    const shopping: ShoppingGroup[] = Array.isArray(json.shopping) ? json.shopping : [];

    const { data: saved, error } = await admin.from("dietitian_plans").insert({
      user_id: user.id, span, analysis, plan: { days }, shopping, targets: T,
    }).select("id, created_at").single();
    if (error) throw error;

    return NextResponse.json({
      plan: { id: saved!.id, span, analysis, days, shopping, targets: T, created_at: saved!.created_at },
    });
  } catch (err) {
    await reportError(err, { where: "api/ai/dietitian/plan", severity: "error", userId: user.id });
    return NextResponse.json({ error: "Plan oluşturulamadı. Lütfen tekrar dene." }, { status: 500 });
  }
}
