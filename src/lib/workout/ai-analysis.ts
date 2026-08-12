import "server-only";
import { getAIProvider, type ChatMessage } from "@/lib/ai/provider";
import { screenAnswer, PATTERN_WARNING } from "@/lib/ai/agents/safety";
import type { WorkoutSummaryData } from "./summary";

// ============================================================================
// ANTRENMAN SONRASI AI ANALİZİ
//
// KURAL: AI SAYI ÜRETMEZ, YALNIZCA ANLATIR.
//   Bütün rakamlar (hacim değişimi, set/tekrar, PR'lar) `summary.ts` içinde
//   veritabanından deterministik olarak hesaplanır ve modele HAZIR cümleler
//   olarak verilir. Model bunları yorumlar. Böylece:
//     · "%12 arttı" gerçekten hesaplanmış bir sayıdır, uydurma değil
//     · AI erişilemezse özet yine çalışır (bulgular zaten gösteriliyor)
//
// GÜVENLİK: Üretilen metin `screenAnswer` ile taranır — tıbbi teşhis, aşırı
// kalori kısıtlaması gibi kırmızı çizgiler yakalanırsa uyarı eklenir.
// ============================================================================

export interface AnalysisResult {
  text: string | null;
  /** Deterministik güvenlik taramasında yakalanan kalıplar. */
  flags: string[];
  /** AI çağrılamadıysa sebep — kullanıcıya değil, loga. */
  error?: string;
}

const SYSTEM = `Sen bir fitness koçusun. Kullanıcının AZ ÖNCE bitirdiği antrenmanı değerlendiriyorsun.

SANA VERİLEN BULGULAR KESİNDİR — veritabanından hesaplanmıştır.
Kurallar:
- ASLA yeni sayı, yüzde veya rekor UYDURMA. Yalnızca verilen bulgulardaki sayıları kullan.
- Bulgularda olmayan bir şey hakkında yorum yapma.
- 3-4 kısa cümle yaz. Madde işareti veya başlık kullanma.
- Önce ne iyi gittiğini söyle, sonra bir sonraki antrenman için SOMUT bir öneri ver.
- Sıcak ama abartısız bir ton kullan. Emoji kullanma.
- Tıbbi teşhis KOYMA. Ağrı/sakatlık ima eden bir durum varsa "bir uzmana danış" de.
- Türkçe yaz. Egzersiz adlarını OLDUĞU GİBİ bırak (İngilizce standart adlar).`;

export async function analyzeWorkout(summary: WorkoutSummaryData): Promise<AnalysisResult> {
  if (summary.totals.totalSets === 0) {
    return { text: null, flags: [], error: "tamamlanmış set yok" };
  }

  // Sağlayıcı yoksa (anahtar tanımsız) sessizce geç — bulgular zaten ekranda.
  let provider: ReturnType<typeof getAIProvider>;
  try {
    provider = getAIProvider();
  } catch (err) {
    return { text: null, flags: [], error: `sağlayıcı yok: ${String(err)}` };
  }
  if (!provider) return { text: null, flags: [], error: "sağlayıcı yapılandırılmamış" };

  const bulgular = summary.facts.map((f) => `- ${f}`).join("\n");
  const kasDagilimi = summary.totals.muscleGroups
    .map((m) => `${m.name}: ${m.sets} set, ${m.volume.toLocaleString("tr-TR")} kg`)
    .join(" · ");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content:
        `BULGULAR:\n${bulgular}\n\n` +
        `KAS GRUBU DAĞILIMI:\n${kasDagilimi}\n\n` +
        (summary.recoveryNote ? `TOPARLANMA NOTU:\n${summary.recoveryNote}\n\n` : "") +
        `Bu antrenmanı değerlendir.`,
    },
  ];

  try {
    const text = (await provider.complete(messages, { temperature: 0.6, maxTokens: 280 })).trim();
    if (!text) return { text: null, flags: [], error: "boş yanıt" };

    // Deterministik güvenlik taraması — model ne derse desin kalıplar üstündür.
    const flags = screenAnswer(text);
    return {
      text: flags.length ? `${text}\n\n${PATTERN_WARNING}` : text,
      flags,
    };
  } catch (err) {
    return { text: null, flags: [], error: String(err) };
  }
}
