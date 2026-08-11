import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { contentQuotaGuard } from "@/lib/premium/limits";
import { getAIProvider } from "@/lib/ai/provider";
import { GOAL_LABELS, EXPERIENCE_LABELS, ENVIRONMENT_LABELS } from "@/lib/constants";
import type { ProgramPlan } from "@/lib/database.types";

export const runtime = "nodejs";

/**
 * Kullanıcı profili + (varsa) kas analizine göre 8 haftalık antrenman programı
 * üretir. AI varsa JSON plan üretir; yoksa şablon tabanlı plan oluşturulur.
 * Program programs tablosuna kaydedilir.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const _q = await contentQuotaGuard(supabase, user.id, "programs", "program");
  if (_q) return _q;

  const body = await request.json().catch(() => ({}));
  const focus: string[] = Array.isArray(body?.focus) ? body.focus : [];

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const days = profile?.weekly_training_days ?? 3;
  const env = profile?.training_environment ?? "gym";
  const goal = profile?.goal ?? "get_fit";

  const provider = getAIProvider();
  let plan: ProgramPlan | null = null;

  if (provider) {
    try {
      const prompt = `Kullanıcıya özel 8 haftalık antrenman programı oluştur.
Hedef: ${GOAL_LABELS[goal as keyof typeof GOAL_LABELS]}
Seviye: ${profile?.experience ? EXPERIENCE_LABELS[profile.experience as keyof typeof EXPERIENCE_LABELS] : "başlangıç"}
Haftalık gün: ${days}
Ortam: ${ENVIRONMENT_LABELS[env as keyof typeof ENVIRONMENT_LABELS]}
${focus.length ? `Öncelikli kas grupları: ${focus.join(", ")}` : ""}

SADECE geçerli JSON döndür (başka metin yok). Yapı:
{"weeks":[{"week":1,"focus":"kısa Türkçe odak","days":[{"day":"Gün 1","focus":"Göğüs & Triceps","exercises":[{"name":"Bench Press","sets":4,"reps":"8-10"}]}]}]}
8 hafta üret ama tekrarları azaltmak için benzer haftaları kısaca özetleyebilirsin; her hafta ${days} gün içersin. Türkçe egzersiz adları kullan.`;

      const raw = await provider.complete(
        [
          { role: "system", content: "Sen uzman bir antrenörsün. Yalnızca geçerli JSON döndür." },
          { role: "user", content: prompt },
        ],
        { temperature: 0.5, maxTokens: 2000 }
      );
      const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
      if (json && Array.isArray(json.weeks)) plan = json as ProgramPlan;
    } catch {
      // AI/JSON hatası → şablon
    }
  }

  if (!plan) {
    plan = buildTemplatePlan(days, env, focus);
  }

  const { data: program } = await supabase
    .from("programs")
    .insert({
      user_id: user.id,
      title: `${GOAL_LABELS[goal as keyof typeof GOAL_LABELS]} · 8 Hafta`,
      goal: GOAL_LABELS[goal as keyof typeof GOAL_LABELS],
      weeks: 8,
      plan,
    })
    .select("id")
    .single();

  return NextResponse.json({ id: program?.id, plan });
}

/** AI yoksa: bölünmüş (split) şablon plan üretir. */
function buildTemplatePlan(days: number, env: string, focus: string[]): ProgramPlan {
  const gym = env !== "home"; // "both" ve "gym" → salon ekipmanlı varyant
  const splits: Record<number, { day: string; focus: string; exercises: { name: string; sets: number; reps: string }[] }[]> = {
    2: [
      { day: "Gün 1", focus: "Üst Vücut", exercises: [
        { name: gym ? "Bench Press" : "Şınav", sets: 3, reps: "8-12" },
        { name: gym ? "Lat Pulldown" : "Barfiks", sets: 3, reps: "8-10" },
        { name: "Omuz Press", sets: 3, reps: "10-12" },
        { name: "Biceps Curl", sets: 3, reps: "12" },
      ] },
      { day: "Gün 2", focus: "Alt Vücut & Core", exercises: [
        { name: gym ? "Squat" : "Goblet Squat", sets: 4, reps: "8-12" },
        { name: "Romanian Deadlift", sets: 3, reps: "10" },
        { name: "Lunges", sets: 3, reps: "12" },
        { name: "Plank", sets: 3, reps: "45 sn" },
      ] },
    ],
    3: [
      { day: "Gün 1", focus: "İtiş (Göğüs/Omuz/Triceps)", exercises: [
        { name: gym ? "Bench Press" : "Şınav", sets: 4, reps: "8-10" },
        { name: "Omuz Press", sets: 3, reps: "10" },
        { name: "Triceps Pushdown", sets: 3, reps: "12" },
      ] },
      { day: "Gün 2", focus: "Çekiş (Sırt/Biceps)", exercises: [
        { name: gym ? "Lat Pulldown" : "Barfiks", sets: 4, reps: "8-10" },
        { name: "Dumbbell Row", sets: 3, reps: "10" },
        { name: "Biceps Curl", sets: 3, reps: "12" },
      ] },
      { day: "Gün 3", focus: "Bacak & Core", exercises: [
        { name: gym ? "Squat" : "Goblet Squat", sets: 4, reps: "8-12" },
        { name: "Hip Thrust", sets: 3, reps: "10" },
        { name: "Plank", sets: 3, reps: "45 sn" },
      ] },
    ],
  };
  const base = splits[days >= 3 ? 3 : 2];
  // Odak kas grupları için not
  const weeks = Array.from({ length: 8 }, (_, i) => ({
    week: i + 1,
    focus:
      i < 4
        ? "Temel: form ve hacim" + (focus.length ? ` · öncelik: ${focus.join(", ")}` : "")
        : "İlerleme: ağırlık ve yoğunluk artışı",
    days: base,
  }));
  return { weeks };
}
