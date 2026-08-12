import type { AIProvider, ChatMessage } from "@/lib/ai/provider";
import type { AgentConfig } from "./types";
import type { RouteSignals } from "./specialists/kit";
import { trLower } from "./specialists/kit";

// ============================================================================
// TIBBİ GÜVENLİK KAPISI
//
// Diğer ajanlardan YAPICA farklı: cevaba bölüm eklemez, cevabı DENETLER.
//
// İKİ KADEMELİ — sebebi maliyet değil, güvenilirlik:
//
//   KADEME 1 — DETERMİNİSTİK (her zaman çalışır, LLM yok)
//     Kırmızı çizgiler kalıp eşleşmesiyle yakalanır: acil semptom, aşırı
//     düşük kalori, hızlı kilo verme vaadi, ilaç dozu. Bunlar için modele
//     güvenmiyoruz — model bazen kaçırır, kalıp kaçırmaz.
//
//   KADEME 2 — LLM DENETİMİ (yalnızca risk sinyali varsa)
//     Kullanıcının sağlık durumu/gebeliği/ilacı varsa ya da mesajda tıbbi
//     içerik geçiyorsa nihai cevap modele denetletilir. Kalıpların
//     yakalayamayacağı bağlamsal çelişkileri (ör. tansiyon hastasına yüksek
//     yoğunluklu interval) bu kademe yakalar.
//
// HER MESAJDA LLM DENETİMİ YAPILMAZ: "bugün kaç XP kazandım" sorusunun
// tıbbi denetimden geçmesi maliyet ve gecikmeden başka bir şey üretmez.
// ============================================================================

export type SafetyVerdict = "safe" | "warn" | "block";

export interface SafetyResult {
  verdict: SafetyVerdict;
  /** `warn` ise cevaba eklenecek, `block` ise cevabın yerine geçecek metin. */
  message: string | null;
  /** Hangi kural tetikledi — `ai_logs`'a yazılır. */
  flags: string[];
  /** LLM denetimi çalıştı mı (telemetri). */
  usedLlm: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

const SAFE: SafetyResult = {
  verdict: "safe", message: null, flags: [], usedLlm: false,
  latencyMs: 0, promptTokens: 0, completionTokens: 0,
};

// ---------------------------------------------------------------------------
// KADEME 1 — deterministik kırmızı çizgiler
// ---------------------------------------------------------------------------

/** Kullanıcı mesajında acil tıbbi durum işareti. Bunlar tartışmasız. */
const EMERGENCY_PATTERNS: { re: RegExp; flag: string }[] = [
  { re: /göğs[üu]m(de)?\s+(ağrı|acı|sıkış|baskı)|göğüs ağrısı/i, flag: "chest_pain" },
  { re: /nefes\s*(al[ae]mıyor|darlığı|yetmiyor)|boğuluyor/i,      flag: "dyspnea" },
  // Bayılma/presenkop: GELECEK ZAMAN da yakalanmalı ("bayılacağım"). Baş
  // dönmesi ve göz kararması, egzersiz sırasında durup kontrol etmeyi
  // gerektiren erken uyarılardır; bunlar eksikti.
  { re: /bayıl(dım|ıyorum|acağım|mak üzere)|bilincimi kaybet|kendimden geç|baş[ıi]m dön(üyor|dü)|gözüm karar/i, flag: "syncope" },
  // İnme belirtileri: peltek/dolaşan konuşma da bu gruba girer.
  // "sol/sağ" da taraf belirtir. Egzersiz sırasında TEK TARAFLI uyuşma veya
  // güç kaybı (özellikle sol kolda) kardiyak/nörolojik uyarı işaretidir;
  // yalnızca "bir taraf|yarım|tek taraf" aramak bunu kaçırıyordu.
  // TARAF + BELİRTİ, aradaki ek çekiminden bağımsız. Türkçe'de kök yumuşuyor
  // ("bacak" → "bacağımda"), bu yüzden kelime kelime eşleştirme kaçırıyordu;
  // mesafe tabanlı arama ek çekimine takılmaz.
  // Egzersiz sırasında tek taraflı uyuşma/güç kaybı (özellikle sol kolda)
  // kardiyak veya nörolojik uyarı işaretidir.
  { re: /(bir taraf|yarım|tek taraf|sol|sağ).{0,25}(uyuş|güç kayb|felç)|konuşmam (bozul|peltek)|peltekleş|dilim dolaş|ağzım kay/i, flag: "stroke_signs" },
  { re: /kanl[ıi] (kusma|dışkı)|kan kusuyor/i,                     flag: "bleeding" },
  { re: /intihar|kendime zarar|yaşamak istemiyorum/i,              flag: "self_harm" },
];

/** Cevapta olmaması gereken kalıplar. */
const UNSAFE_ANSWER_PATTERNS: { re: RegExp; flag: string }[] = [
  // Aşırı düşük kalori
  { re: /\b([2-9]\d{2}|1[01]\d{2})\s*(kcal|kalori)\b.{0,40}(günde|günlük|hedef)/i, flag: "very_low_calorie" },
  { re: /(günde|günlük).{0,40}\b([2-9]\d{2}|1[01]\d{2})\s*(kcal|kalori)\b/i,       flag: "very_low_calorie" },
  // Hızlı kilo verme vaadi
  { re: /haftada\s*([2-9]|\d{2})\s*(kilo|kg)/i,                                     flag: "rapid_weight_loss" },
  { re: /(\d+)\s*günde\s*([5-9]|\d{2})\s*(kilo|kg)/i,                               flag: "rapid_weight_loss" },
  // Uzun açlık / su kısıtlama
  { re: /(\d{2,})\s*(saat|gün)\s*(aç kal|oruç|hiçbir şey yeme)/i,                   flag: "prolonged_fasting" },
  { re: /su(yu)?\s*(kes|içme|kısıtla)/i,                                            flag: "water_restriction" },
  // İlaç / doz
  { re: /\b(mg|ml)\b.{0,20}(günde|al|kullan)|doz(u|unu)\s*(artır|yükselt)/i,        flag: "drug_dosing" },
  { re: /(steroid|anabolik|testosteron|clen|efedrin).{0,30}(kullan|al|öner)/i,      flag: "peds" },
  // Teşhis dili
  { re: /\b(sende|sizde)\b.{0,25}\b(var|olmuş)\b.{0,15}(fıtık|yırtık|tendinit|artroz|kireçlenme)/i, flag: "diagnosis" },
  // Ağrıya rağmen devam
  { re: /ağrıya\s*(rağmen|aldırma|alış)|acıyorsa\s*devam/i,                         flag: "train_through_pain" },
];

/** Sağlık bağlamı gerektiren kullanıcı ifadeleri (LLM denetimini tetikler). */
const MEDICAL_CONTEXT = [
  "hamile", "gebe", "emzir", "kalp", "tansiyon", "diyabet", "şeker hastal",
  "astım", "tiroid", "epilepsi", "böbrek", "karaciğer", "ameliyat", "operasyon",
  "ilaç", "kronik", "kanser", "anemi", "kan sulandır", "reflü", "ülser",
  "yeme bozukluğu", "anoreksi", "bulimi", "doktor dedi", "hekim",
];

/** Acil durumda üretilen cevap — bu metin LLM'e bırakılmayacak kadar kritik. */
function emergencyMessage(flags: string[]): string {
  if (flags.includes("self_harm")) {
    return (
      "Söylediklerin beni ciddi anlamda kaygılandırdı ve bunu hafife almak istemiyorum. " +
      "Bu konuda sana bir fitness uygulaması olarak yardımcı olamam, ama yalnız değilsin.\n\n" +
      "• Acil bir tehlike varsa 112'yi ara.\n" +
      "• Türkiye'de psikolojik destek için 182'den randevu alabilir ya da bir ruh sağlığı " +
      "uzmanına başvurabilirsin.\n" +
      "• Güvendiğin birine şu an ulaşman iyi olur.\n\n" +
      "Antrenman ve beslenme konusunda konuşmaya hazır olduğunda buradayım."
    );
  }
  return (
    "Anlattığın belirtiler acil tıbbi değerlendirme gerektirebilir. Bu konuda sana " +
    "antrenman ya da beslenme önerisi vermem doğru olmaz.\n\n" +
    "• Belirtiler sürüyorsa ya da şiddetleniyorsa vakit kaybetmeden 112'yi ara veya " +
    "en yakın acil servise başvur.\n" +
    "• Bu değerlendirme yapılmadan antrenmana devam etme.\n\n" +
    "Sağlığın yerine geldiğinde programına kaldığın yerden devam ederiz. Geçmiş olsun."
  );
}

/** Kullanıcı mesajını tarar. Acil durumda cevap ÜRETİLMEDEN önce durdurur. */
export function screenUserMessage(message: string): SafetyResult {
  const flags = EMERGENCY_PATTERNS.filter((p) => p.re.test(message)).map((p) => p.flag);
  if (flags.length === 0) return SAFE;
  return { ...SAFE, verdict: "block", message: emergencyMessage(flags), flags };
}

/** Üretilmiş cevabı deterministik kalıplara karşı tarar. */
export function screenAnswer(answer: string): string[] {
  return UNSAFE_ANSWER_PATTERNS.filter((p) => p.re.test(answer)).map((p) => p.flag);
}

/**
 * LLM denetimi gerekli mi?
 *
 * Gereksiz denetim maliyet; atlanmış denetim risk. Denge: kullanıcının
 * kayıtlı sağlık durumu varsa, mesajda tıbbi bağlam geçiyorsa ya da cevapta
 * kalıp yakalandıysa denetle.
 */
export function needsLlmReview(
  message: string,
  answer: string,
  signals: RouteSignals,
  patternFlags: string[]
): boolean {
  if (patternFlags.length > 0) return true;
  if (signals.hasHealthConditions) return true;
  const t = trLower(`${message}\n${answer}`);
  return MEDICAL_CONTEXT.some((k) => t.includes(k));
}

// ---------------------------------------------------------------------------
// KADEME 2 — LLM denetimi
// ---------------------------------------------------------------------------

/**
 * Nihai cevabı tıbbi güvenlik ajanına denetletir.
 *
 * Denetim BAŞARISIZ olursa (ağ hatası, model hatası) cevap ENGELLENMEZ —
 * deterministik kademe zaten çalışmış durumda. Denetimin çökmesi yüzünden
 * kullanıcıyı cevapsız bırakmak, orantısız bir tepki olurdu.
 */
export async function reviewAnswer(
  provider: AIProvider,
  cfg: AgentConfig,
  params: { message: string; answer: string; healthContext: string }
): Promise<SafetyResult> {
  const started = Date.now();
  const messages: ChatMessage[] = [
    { role: "system", content: `${cfg.prompt}\n\n=== KULLANICI SAĞLIK BİLGİSİ ===\n${params.healthContext}` },
    {
      role: "user",
      content:
        `KULLANICININ MESAJI:\n${params.message}\n\n` +
        `DENETLENECEK TASLAK CEVAP:\n${params.answer}`,
    },
  ];

  try {
    const raw = await provider.complete(messages, {
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
    });
    const promptTokens = Math.ceil(messages.reduce((a, m) => a + m.content.length, 0) / 4);
    const completionTokens = Math.ceil(raw.length / 4);
    const parsed = parseReview(raw);

    return {
      ...parsed,
      flags: parsed.verdict === "safe" ? [] : [`llm_${parsed.verdict}`],
      usedLlm: true,
      latencyMs: Date.now() - started,
      promptTokens,
      completionTokens,
    };
  } catch (err) {
    console.error("Tıbbi güvenlik denetimi hatası:", err);
    return { ...SAFE, usedLlm: true, latencyMs: Date.now() - started };
  }
}

/** Denetim çıktısını ayrıştırır. Biçim bozuksa GÜVENLİ sayar. */
function parseReview(raw: string): { verdict: SafetyVerdict; message: string | null } {
  const text = raw.trim();
  if (!text) return { verdict: "safe", message: null };

  const lines = text.split("\n");
  const head = trLower(lines[0].trim()).replace(/[^a-zçğıöşü]/g, "");
  const body = lines.slice(1).join("\n").trim();

  if (head.startsWith("engelle")) {
    // ENGELLE dendi ama yerine konacak metin yoksa engelleme —
    // kullanıcıyı boş ekranla baş başa bırakmak çözüm değil.
    return body ? { verdict: "block", message: body } : { verdict: "safe", message: null };
  }
  if (head.startsWith("uyari") || head.startsWith("uyarı")) {
    return body ? { verdict: "warn", message: body } : { verdict: "safe", message: null };
  }
  return { verdict: "safe", message: null };
}

/** Deterministik kalıplar yakaladı ama LLM denetimi yapılamadıysa kullanılacak uyarı. */
export const PATTERN_WARNING =
  "Bu öneriyi uygulamadan önce bir sağlık profesyoneline danışmanı öneririm; " +
  "özellikle mevcut bir sağlık durumun ya da kullandığın bir ilaç varsa.";
