import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { hasFeature } from "@/lib/premium/entitlements";
import { stripMarkdown } from "@/lib/ai/strip-markdown";
import { getAIProvider } from "@/lib/ai/provider";
import {
  buildFindings,
  buildCorrectiveProgram,
  computeScores,
  buildSummary,
} from "@/lib/posture/assemble";
import { POSTURE_PROBLEMS } from "@/lib/posture/problems";
import type { PostureProblem, TrainingEnvironment } from "@/lib/database.types";

export const runtime = "nodejs";

/**
 * Postür analizi + düzeltici program üretir ve posture_analyses'e kaydeder.
 *
 * Mimari not: Gerçek AI görüntü analizi (vision) için altyapı hazırdır —
 * fotoğraf yolları kaydedilir. Vision modeli bağlanana kadar bulgular
 * kullanıcının öz-değerlendirme yanıtlarından (dürüst sinyal) türetilir;
 * AI anahtarı varsa yalnızca kişisel özet metnini zenginleştirir.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  // Postür analizi Premium'a özel.
  const { data: pProfile } = await supabase
    .from("profiles").select("is_premium, membership_type, premium_until").eq("id", user.id).maybeSingle();
  if (!hasFeature(pProfile ?? undefined, "posture_analysis")) {
    return NextResponse.json(
      { error: "AI Postür Analizi Premium'a özeldir. Sınırsız erişim için Premium'a yükselt.", upgrade: "/premium" },
      { status: 402 }
    );
  }

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const body = await request.json().catch(() => ({}));
  const environment: TrainingEnvironment = ["home", "gym", "both"].includes(
    body?.environment
  )
    ? body.environment
    : "both";

  const photos = body?.photos ?? {};
  const rawAssessment: unknown[] = Array.isArray(body?.assessment)
    ? body.assessment
    : [];
  const detected = rawAssessment
    .filter((p): p is PostureProblem => typeof p === "string" && p in POSTURE_PROBLEMS)
    .map((problem) => ({
      problem,
      confidence: clampConf(body?.confidences?.[problem]),
    }));

  const findings = buildFindings(detected);
  const problems = findings.map((f) => f.problem);
  const scores = computeScores(findings);
  const program = buildCorrectiveProgram(problems, environment);

  // Özet: AI varsa kişiselleştir, yoksa deterministik.
  let summary = buildSummary(findings);
  const provider = getAIProvider();
  if (provider && findings.length) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("goal, experience")
        .eq("id", user.id)
        .single();
      const prompt = `Kullanıcının postür öz-değerlendirmesinde şu bulgular işaretlendi: ${findings
        .map((f) => f.label)
        .join(", ")}.
Hedefi: ${profile?.goal ?? "genel fitness"}. Seviye: ${profile?.experience ?? "başlangıç"}.
2-3 cümlelik, motive edici, Türkçe kişisel bir özet yaz. Tıbbi tanı koyma; "eğitim amaçlı" tonunda kal. Sadece düz metin döndür.`;
      const text = await provider.complete(
        [
          { role: "system", content: "Sen deneyimli bir postür ve düzeltici egzersiz koçusun." },
          { role: "user", content: prompt },
        ],
        { temperature: 0.6, maxTokens: 220 }
      );
      if (text && text.trim().length > 10) summary = stripMarkdown(text).trim();
    } catch {
      // AI hatası → deterministik özet kalır
    }
  }

  const { data: row, error } = await supabase
    .from("posture_analyses")
    .insert({
      user_id: user.id,
      environment,
      source: "self_assessment",
      photo_front_path: typeof photos.front === "string" ? photos.front : null,
      photo_side_path: typeof photos.side === "string" ? photos.side : null,
      photo_back_path: typeof photos.back === "string" ? photos.back : null,
      posture_score: scores.posture,
      mobility_score: scores.mobility,
      symmetry_score: scores.symmetry,
      recovery_score: scores.recovery,
      findings,
      corrective_program: program,
      summary,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: "Analiz kaydedilemedi." }, { status: 500 });
  }

  return NextResponse.json({ analysis: row });
}

function clampConf(v: unknown): number {
  const n = typeof v === "number" ? v : 72;
  return Math.max(40, Math.min(96, Math.round(n)));
}
