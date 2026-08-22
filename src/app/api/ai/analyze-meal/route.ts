import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getAIProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 60; // AI üretimi uzun sürer; Vercel varsayılanı (10-15 sn) yetmiyor

interface Recognized {
  name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number;
  portion?: string; confidence?: number;
}

/**
 * Yemek fotoğrafı analizi — AI vision ile kalori + makro + porsiyon tahmini.
 * Fotoğraf `meal-photos` (private) bucket'ında; imzalı URL üretilip vision
 * modeline gönderilir, JSON sonuç meal_photos.recognized'a yazılır.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const body = await request.json().catch(() => ({}));
  const path: string = typeof body?.path === "string" ? body.path : "";
  if (!path) return NextResponse.json({ error: "Fotoğraf yolu gerekli." }, { status: 400 });

  // Kayıt oluştur (analiz başarısız olsa bile foto kaydı kalsın).
  const { data: row } = await supabase
    .from("meal_photos")
    .insert({ user_id: user.id, storage_path: path, recognized: {}, logged: false })
    .select("*")
    .single();

  const provider = getAIProvider();
  if (!provider?.analyzeImage) {
    return NextResponse.json({
      saved: row, recognized: null,
      message: "Fotoğrafın kaydedildi. AI görüntü tanıma için yönetici bir AI anahtarı eklemeli; şimdilik öğününü manuel ekleyebilirsin.",
    });
  }

  // Private bucket → geçici imzalı URL (AI erişebilsin).
  const { data: signed } = await supabase.storage.from("meal-photos").createSignedUrl(path, 300);
  if (!signed?.signedUrl) {
    return NextResponse.json({ saved: row, recognized: null, message: "Fotoğrafa erişilemedi, tekrar dene." });
  }

  const prompt = `Bu bir yemek fotoğrafı. Türk mutfağını iyi bilen bir diyetisyen gibi tabaktaki yemeği tanı ve TAHMİNİ besin değerlerini ver.
SADECE geçerli JSON döndür, başka metin yok:
{"name":"yemek adı (Türkçe)","portion":"tahmini porsiyon (ör. 1 tabak ~300g)","calories":sayı,"protein_g":sayı,"carbs_g":sayı,"fat_g":sayı,"confidence":0-1 arası}
Değerler tüm tabak/porsiyon için toplam olsun. Emin değilsen makul tahmin yap ve confidence'ı düşür.`;

  let recognized: Recognized | null = null;
  try {
    const raw = await provider.analyzeImage(signed.signedUrl, prompt, { maxTokens: 400 });
    const json = JSON.parse(raw.replace(/```json|```/g, "").trim());
    if (json && typeof json.name === "string") {
      recognized = {
        name: String(json.name).slice(0, 80),
        calories: Math.max(0, Math.round(Number(json.calories) || 0)),
        protein_g: Math.max(0, Math.round((Number(json.protein_g) || 0) * 10) / 10),
        carbs_g: Math.max(0, Math.round((Number(json.carbs_g) || 0) * 10) / 10),
        fat_g: Math.max(0, Math.round((Number(json.fat_g) || 0) * 10) / 10),
        portion: typeof json.portion === "string" ? json.portion.slice(0, 60) : undefined,
        confidence: Math.max(0, Math.min(1, Number(json.confidence) || 0.5)),
      };
    }
  } catch {
    // JSON/vision hatası → manuel ekleme fallback
  }

  if (recognized && row?.id) {
    await supabase.from("meal_photos").update({ recognized }).eq("id", row.id);
  }

  return NextResponse.json({
    saved: row, recognized,
    message: recognized
      ? `Tanındı: ${recognized.name} · ~${recognized.calories} kcal`
      : "Fotoğraf kaydedildi ama otomatik tanınamadı. Öğününü manuel ekleyebilirsin.",
  });
}
