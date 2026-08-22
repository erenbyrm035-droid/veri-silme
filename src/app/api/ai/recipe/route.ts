import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aiRateGuard } from "@/lib/security/ai-guard";
import { getAIProvider } from "@/lib/ai/provider";
import { stripMarkdown } from "@/lib/ai/strip-markdown";

export const runtime = "nodejs";
export const maxDuration = 60; // AI üretimi uzun sürer; Vercel varsayılanı (10-15 sn) yetmiyor

/**
 * Akıllı tarif: kullanıcının elindeki malzemelere veya makro hedefine göre
 * tarif/öğün önerisi üretir. AI varsa zengin; yoksa kural tabanlı fallback.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const _rl = await aiRateGuard(request, supabase, user.id);
  if (_rl) return _rl;

  const body = await request.json().catch(() => ({}));
  const prompt: string = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Boş istek." }, { status: 400 });

  const provider = getAIProvider();
  if (provider) {
    try {
      const text = await provider.complete(
        [
          {
            role: "system",
            content:
              "Sen Türk mutfağına hakim bir diyetisyensin. Kullanıcının elindeki malzemelere veya makro hedefine uygun, pratik bir tarif öner. Yaklaşık kalori ve protein ver. Kısa, uygulanabilir ve Türkçe yaz. Tıbbi tavsiye verme; gerektiğinde bir uzmana danışmayı öner. BİÇİM: Markdown KULLANMA — yıldız (**), diyez (#, ##, ###) veya başlık işareti yok; düz metin yaz, liste gerekirse her satır başına \"• \" koy.",
          },
          { role: "user", content: prompt },
        ],
        { temperature: 0.7, maxTokens: 500 }
      );
      const clean = stripMarkdown(text ?? "");
      if (clean && clean.trim().length > 10) {
        return NextResponse.json({ recipe: clean.trim(), source: "ai" });
      }
    } catch {
      // fallback
    }
  }

  return NextResponse.json({ recipe: fallbackRecipe(prompt), source: "template" });
}

/** AI yoksa: basit kural tabanlı tarif önerisi. */
function fallbackRecipe(prompt: string): string {
  const p = prompt.toLowerCase();
  const proteinMatch = p.match(/(\d+)\s*(g|gram)?\s*protein/);
  if (proteinMatch) {
    const g = parseInt(proteinMatch[1], 10);
    return `~${g} g protein için öneri: 150 g ızgara tavuk göğsü (~46 g protein) + 200 g süzme yoğurt (~20 g) + 1 avuç badem. Toplam ~${
      g <= 66 ? "66" : "70+"
    } g proteine yakın. Sebze ve tam tahılla dengele. (Kişiselleştirilmiş plan için bir diyetisyene danışabilirsin.)`;
  }
  const has = (w: string) => p.includes(w);
  if (has("tavuk") && has("pirinç")) {
    return "Tavuklu Pilav Kasesi: Izgara tavuk göğsünü küp doğra, pişmiş pirinçle karıştır; yanına sade yoğurt ve mevsim salata. ~500 kcal, ~40 g protein. Hazırlık ~20 dk.";
  }
  if (has("yumurta")) {
    return "Sebzeli Menemen: Domates ve biberi kavur, 2-3 yumurta kır, karıştır. Tam buğday ekmekle. ~300 kcal, ~18 g protein. Hazırlık ~12 dk.";
  }
  if (has("mercimek") || has("nohut") || has("fasulye")) {
    return "Baklagil Bowl: Haşlanmış baklagili zeytinyağı, limon, soğan ve maydanozla karıştır; bulgurla servis et. ~450 kcal, ~18 g protein, yüksek lif. Hazırlık ~25 dk.";
  }
  return "Elindeki malzemeleri protein + kompleks karbonhidrat + sebze üçlüsüyle dengele. Örn. bir protein kaynağı (tavuk/yumurta/baklagil) + tam tahıl (bulgur/pirinç) + bol sebze. Daha kişisel öneri için malzemelerini veya makro hedefini yaz.";
}
