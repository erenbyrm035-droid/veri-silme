import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getAIProvider } from "@/lib/ai/provider";
import { stripMarkdown } from "@/lib/ai/strip-markdown";
import { GOAL_LABELS } from "@/lib/constants";

export const runtime = "nodejs";

/**
 * Kullanıcının antrenman geçmişini analiz ederek geride kalan kas gruplarını
 * belirler. AI varsa JSON döndürür; yoksa hacim tabanlı kural motoruna düşer.
 * Sonuç muscle_analyses tablosuna kaydedilir.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const [{ data: profile }, { data: sets }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("workout_sets")
      .select("exercise_name, workouts!inner(user_id)")
      .eq("workouts.user_id", user.id)
      .limit(500),
  ]);

  // Kas grubu başına set hacmi (egzersiz kütüphanesinden eşle)
  const { data: exercises } = await supabase
    .from("exercises")
    .select("name, muscle_group");
  const exMap = new Map(
    (exercises ?? []).map((e) => [e.name, e.muscle_group as string])
  );

  const volume: Record<string, number> = {};
  const ALL_GROUPS = ["Göğüs", "Sırt", "Bacak", "Omuz", "Kol", "Karın", "Kalça"];
  ALL_GROUPS.forEach((g) => (volume[g] = 0));
  (sets ?? []).forEach((s) => {
    const g = exMap.get(s.exercise_name as string);
    if (g && g in volume) volume[g] += 1;
  });

  const provider = getAIProvider();
  let lagging: { muscle: string; reason: string }[] = [];
  let summary = "";

  if (provider) {
    try {
      const prompt = `Kullanıcının kas grubu başına antrenman set hacmi (son kayıtlar):
${JSON.stringify(volume)}
Hedef: ${profile?.goal ? GOAL_LABELS[profile.goal as keyof typeof GOAL_LABELS] : "genel"}
Seviye: ${profile?.experience ?? "?"}

Dengeli gelişim için en çok ihmal edilen 2-3 kas grubunu belirle. SADECE şu formatta geçerli JSON döndür (başka metin yok):
{"summary":"kısa Türkçe özet","lagging":[{"muscle":"kas grubu","reason":"kısa Türkçe gerekçe"}]}`;

      const raw = await provider.complete(
        [
          { role: "system", content: "Sen bir fitness analiz asistanısın. Yalnızca geçerli JSON döndür." },
          { role: "user", content: prompt },
        ],
        { temperature: 0.3, maxTokens: 400 }
      );
      const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
      lagging = Array.isArray(json.lagging) ? json.lagging.slice(0, 3) : [];
      summary = typeof json.summary === "string" ? stripMarkdown(json.summary) : "";
    } catch {
      // JSON parse / AI hatası → kural motoru
    }
  }

  // Fallback: en düşük hacimli gruplar geride kabul edilir.
  if (lagging.length === 0) {
    const sorted = Object.entries(volume).sort((a, b) => a[1] - b[1]);
    lagging = sorted.slice(0, 3).map(([muscle, v]) => ({
      muscle,
      reason:
        v === 0
          ? "Kayıtlı antrenman yok — dengeli gelişim için ekle."
          : `Diğer gruplara göre daha az çalışılmış (${v} set).`,
    }));
    summary =
      "Antrenman hacmine göre en az çalışılan kas grupları öne çıkarıldı. Dengeli bir gelişim için bu bölgelere öncelik ver.";
  }

  await supabase.from("muscle_analyses").insert({
    user_id: user.id,
    lagging,
    summary,
  });

  return NextResponse.json({ lagging, summary });
}
