import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasFeature } from "@/lib/premium/entitlements";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";

// ============================================================================
// ElevenLabs metin→ses köprüsü.
//
// Neden sunucu tarafı: API anahtarı istemciye SIZDIRILMAZ. İstemci yalnızca
// metin gönderir, ses baytlarını alır.
//
// Anahtar tanımlı değilse 503 döner — istemci bunu görüp sessizce Web Speech
// API'sine düşer (bkz. `lib/voice/provider.ts`). Yani ElevenLabs kurulmasa da
// sesli koç ÇALIŞIR, sadece sesi tarayıcının kendi motorundan gelir.
//
// Yeni npm bağımlılığı yok — düz `fetch`.
// ============================================================================

export const runtime = "nodejs";
export const maxDuration = 60; // AI üretimi uzun sürer; Vercel varsayılanı (10-15 sn) yetmiyor
export const dynamic = "force-dynamic";

/** Türkçe için makul, dengeli bir ses. Env ile değiştirilebilir. */
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const MAX_CHARS = 300;

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Ses sağlayıcısı yapılandırılmamış." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_premium, membership_type, premium_until")
    .eq("id", user.id)
    .maybeSingle();

  if (!hasFeature(profile ?? undefined, "voice_coach")) {
    // 403 değil 503: istemci için ikisi de "Web Speech'e düş" anlamına gelir,
    // ama 403 kullanıcıya hata gibi görünürdü. Sesli koç yine çalışır.
    return NextResponse.json({ error: "Bu ses Premium üyelere özel." }, { status: 503 });
  }

  // Karakter başına ücretlendiği için kullanıcı bazlı sıkı limit.
  const rl = await checkRateLimitAsync(`tts:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Ses limiti doldu. Bir süre sonra tekrar dene." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let text = "";
  try {
    const body = (await req.json()) as { text?: string };
    text = (body.text ?? "").trim().slice(0, MAX_CHARS);
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Metin boş." }, { status: 400 });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.4, similarity_boost: 0.75 },
        }),
      }
    );

    if (!res.ok) {
      console.error("[tts] ElevenLabs hatası:", res.status);
      return NextResponse.json({ error: "Ses üretilemedi." }, { status: 503 });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[tts] istek başarısız:", err);
    return NextResponse.json({ error: "Ses üretilemedi." }, { status: 503 });
  }
}
