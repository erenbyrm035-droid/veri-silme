// Supplement AI — hedefe göre takviye önerisi (ilaç/tedavi ÖNERMEZ).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getAIProvider } from "@/lib/ai/provider";
import { stripMarkdown } from "@/lib/ai/strip-markdown";
import { GOAL_LABELS, NUTRITION_GOAL_LABELS } from "@/lib/constants";
import type { NutritionGoal, Goal } from "@/lib/database.types";

export const runtime = "nodejs";

const GOAL_MAP: Record<Goal, NutritionGoal> = {
  lose_weight: "lose_fat", gain_muscle: "gain_muscle", get_fit: "healthy",
  improve_endurance: "endurance", gain_strength: "strength",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const rl = await aiRateGuard(request, supabase, user.id);
  if (rl) return rl;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const p = profile ?? {};
  const goal: NutritionGoal = (p.nutrition_goal as NutritionGoal) || (p.goal ? GOAL_MAP[p.goal as Goal] : "healthy") || "healthy";
  const allergies = ((p.allergies ?? []) as string[]).join(", ") || "yok";
  const conditions = ((p.health_conditions ?? []) as string[]).join(", ") || "yok";

  const provider = getAIProvider();
  if (!provider) {
    return NextResponse.json({
      suggestions: [
        { name: "Whey Protein", why: "Günlük protein hedefini tamamlamak zorsa pratik destek.", dose: "Antrenman sonrası 1 ölçek (~25g protein)." },
        { name: "Kreatin Monohidrat", why: "Güç ve kas kütlesi için en kanıtlı takviye.", dose: "Günde 3-5 g, düzenli." },
        { name: "Omega-3", why: "Genel sağlık ve toparlanma.", dose: "Günde 1-2 g EPA+DHA." },
        { name: "D Vitamini", why: "Türkiye'de eksiklik yaygın (kan değerine göre).", dose: "Doktor/kan değerine göre." },
      ],
      note: "AI yapılandırılmadığı için genel öneriler gösterildi. Takviye almadan önce bir uzmana danış.",
    });
  }

  try {
    const prompt = `Kullanıcı için hedefine uygun SPOR TAKVİYESİ (supplement) önerisi ver. Fitness hedefi: ${p.goal ? GOAL_LABELS[p.goal as Goal] : "?"}, Beslenme hedefi: ${NUTRITION_GOAL_LABELS[goal]}. Alerjiler: ${allergies}. Sağlık durumu: ${conditions}.
ÖNEMLİ: İlaç veya tedavi ÖNERME. Sadece yaygın spor takviyeleri (whey, kreatin, omega-3, vitamin vb.). Sağlık durumu varsa uzmana danışmayı belirt.
SADECE geçerli JSON döndür:
{"suggestions":[{"name":"takviye","why":"neden (kısa)","dose":"tipik kullanım"}],"note":"kısa güvenlik notu"}
En fazla 5 öneri.`;
    const raw = await provider.complete(
      [{ role: "system", content: "Sen bir spor beslenmesi uzmanısın. İlaç/tedavi önermezsin. Yalnızca geçerli JSON döndür." },
       { role: "user", content: prompt }],
      { temperature: 0.5, maxTokens: 600 }
    );
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    const clean = (v: unknown) => (typeof v === "string" ? stripMarkdown(v) : v);
    const suggestions = Array.isArray(json.suggestions)
      ? json.suggestions.slice(0, 5).map((s: Record<string, unknown>) => ({ ...s, name: clean(s.name), why: clean(s.why), dose: clean(s.dose) }))
      : [];
    return NextResponse.json({
      suggestions,
      note: typeof json.note === "string" ? stripMarkdown(json.note) : "Takviye almadan önce bir uzmana danış.",
    });
  } catch {
    return NextResponse.json({ suggestions: [], note: "Öneri üretilemedi, tekrar dene." });
  }
}
