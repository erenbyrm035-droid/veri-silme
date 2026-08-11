import { ROUTABLE_SPECIALISTS } from "./specialists";
import { countMatches, trLower, type RouteSignals } from "./specialists/kit";
import type { AgentKey, AgentSelection, SpecialistKey } from "./types";

// ============================================================================
// ORCHESTRATOR — HANGİ UZMAN ÇALIŞACAK?
//
// İKİ KADEMELİ, BİLİNÇLİ BİR TASARIM:
//
//   KADEME 1 — DETERMİNİSTİK SKORLAMA (LLM ÇAĞRISI YOK, ~0 ms, ~0 maliyet)
//     Mesajdaki kökler + bağlam sinyalleri puanlanır. Mesajların büyük kısmı
//     burada net biçimde çözülüyor: "bugün ne yemeliyim" → beslenme.
//
//   KADEME 2 — LLM İLE AYIRT ETME (yalnızca gerçekten belirsizse)
//     Hiçbir uzman eşiği geçemediyse ya da tepedeki iki uzman berabereyse
//     tek ve UCUZ bir sınıflandırma çağrısı yapılır.
//
// NEDEN HER MESAJDA LLM'E SORMUYORUZ: Yönlendirme için model çağırmak, henüz
// asıl işi yapmadan önce bir tur gecikme ve maliyet demek. Kullanıcıların
// sorularının çoğu apaçık; "dizim ağrıyor" için modele danışmaya gerek yok.
// Ölçtüğümüz şey basit: kural motoru kararı verebiliyorsa model susar.
//
// ÜST SINIR: Aynı anda en fazla `MAX_AGENTS` uzman. Bu sınır olmadan geniş
// bir soru 7 ajanı birden tetikler ve maliyet 7 katına çıkar. Sınır, cevabın
// kalitesini düşürmüyor — 3'ten fazla uzmanın katkısı zaten birbirini
// tekrarlamaya başlıyor.
// ============================================================================

/** Aynı turda çalışabilecek azami uzman sayısı. */
export const MAX_AGENTS = 3;
/**
 * Anahtar kelimeyle seçilmek için gereken asgari skor.
 *
 * TEK kök eşleşmesinin puanı 0.8; eşik bunun ÜSTÜNDE olamaz. Aksi halde
 * "bugün bacak günü yapayım mı" gibi tek kelimeyle apaçık anlaşılan mesajlar
 * kural motorunda çözülemez ve gereksiz yere LLM'e gider — yani yönlendirici
 * tam da kaçınmak için var olduğu maliyeti üretir.
 */
const THRESHOLD = 0.8;
/**
 * Bağlam sinyalinin TEK BAŞINA uzmanı devreye sokması için gereken eşik.
 *
 * Anahtar kelime eşiğinden AYRI ve daha düşük olmak zorunda: sinyaller
 * 0..1 aralığında üretiliyor, kelime eşleşmeleri ise 0.8'den başlayıp
 * birikiyor. İkisini aynı barajla ölçmek, sinyallerin hiçbir zaman
 * yetmemesi demekti — "kullanıcı sormasa da uzman devreye girsin"
 * tasarımı bu yüzden pratikte ölü kalıyordu.
 */
const SIGNAL_THRESHOLD = 0.35;

/**
 * Kapalı ajanları seçimden çıkarır ve gerekirse genel koça düşer.
 *
 * Yönlendirici ajan ayarlarını GÖRMEZ — kural motoru yalnızca mesaja ve
 * bağlam sinyallerine bakar. Bu yüzden panelden kapatılmış bir uzman
 * seçilebiliyor. Bu filtre olmadan seçim aşağıda sessizce boş bulguya
 * dönüşüyor ve kullanıcı cevap yerine hata mesajı alıyordu: yani bir ajanı
 * kapatmak koçu o konuda tamamen bozuyordu.
 *
 * Dönen boş dizi "uzmansız cevap ver" demektir, hata değil.
 */
export function filterEnabled(
  selections: AgentSelection[],
  isEnabled: (key: AgentKey) => boolean
): AgentSelection[] {
  const kept = selections.filter((s) => isEnabled(s.key));
  if (kept.length > 0) return kept;
  if (isEnabled(FALLBACK_AGENT)) {
    return [{ key: FALLBACK_AGENT, score: 0, reason: "forced" }];
  }
  return [];
}

export interface RouteDecision {
  selected: AgentSelection[];
  /** LLM'e danışıldı mı — telemetri ve maliyet takibi için. */
  usedLlm: boolean;
  /** Tüm skorlar (hata ayıklama / admin görünümü). */
  scores: { key: SpecialistKey; score: number }[];
}

/**
 * Kural tabanlı skorlama.
 *
 * Puanlama:
 *   güçlü kök eşleşmesi  → 2.0 (tek başına seçilmeye yeter)
 *   normal kök eşleşmesi → 0.8 (ilk), sonrakiler 0.4 (azalan getiri)
 *   bağlam sinyali       → 0..1 (uzmanın kendi `signal` fonksiyonu)
 *
 * Azalan getiri neden: "antrenman programı egzersiz set tekrar" gibi bir
 * cümle 5 kök birden eşleştirir; doğrusal toplasak fitness ajanı diğer her
 * şeyi ezerdi. İlk eşleşme sinyaldir, beşincisi tekrardır.
 */
export function scoreSpecialists(
  message: string,
  signals: RouteSignals
): { key: SpecialistKey; score: number; keywordScore: number; signalScore: number }[] {
  const text = trLower(message);

  return ROUTABLE_SPECIALISTS.map((spec) => {
    let keywordScore = 0;

    const strong = spec.strongKeywords ? countMatches(text, spec.strongKeywords) : 0;
    if (strong > 0) keywordScore += 2.0;

    const hits = countMatches(text, spec.keywords);
    if (hits > 0) keywordScore += 0.8 + Math.min(hits - 1, 4) * 0.4;

    const signalScore = spec.signal ? Math.max(0, Math.min(1, spec.signal(signals))) : 0;

    return {
      key: spec.key,
      score: Number((keywordScore + signalScore).toFixed(2)),
      keywordScore: Number(keywordScore.toFixed(2)),
      signalScore: Number(signalScore.toFixed(2)),
    };
  }).sort((a, b) => b.score - a.score);
}

export interface RuleRouteResult {
  /** Anahtar kelimeyle net biçimde seçilenler. */
  selected: AgentSelection[];
  /**
   * Bağlam sinyali yüksek olduğu için kullanıcı sormasa da eklenmesi gereken
   * uzmanlar. LLM'e gidilse bile bunlar KAYBOLMAZ — orchestrator birleştirir.
   */
  forced: AgentSelection[];
  needsLlm: boolean;
  scores: { key: SpecialistKey; score: number }[];
}

/**
 * Kural motoruyla karar ver.
 *
 * İKİ AYRI LİSTE döndürmesi kasıtlı:
 *   `selected` → kullanıcının SORDUĞU şey (anahtar kelime)
 *   `forced`   → kullanıcının SORMADIĞI ama bilmesi gereken şey (bağlam)
 *
 * Bunları tek listede toplayıp tek eşikle ölçmek, ikisinin de yanlış
 * çalışmasına yol açıyordu: sinyaller hiç yetmiyor, yettiğinde de mesajın
 * asıl konusunu bastırıyordu. Ayrı tutulunca ikisi de işini yapıyor.
 *
 * Saf fonksiyon — test edilebilir, ağ yok.
 */
export function routeByRules(message: string, signals: RouteSignals): RuleRouteResult {
  const scored = scoreSpecialists(message, signals);
  const scores = scored.map(({ key, score }) => ({ key, score }));

  const selected: AgentSelection[] = scored
    .filter((x) => x.keywordScore >= THRESHOLD)
    .slice(0, MAX_AGENTS)
    .map((x) => ({ key: x.key, score: x.score, reason: "rules" as const }));

  const chosen = new Set(selected.map((s) => s.key));
  const forced: AgentSelection[] = scored
    .filter((x) => x.signalScore >= SIGNAL_THRESHOLD && !chosen.has(x.key))
    .map((x) => ({ key: x.key, score: x.score, reason: "forced" as const }));

  // Mesajın konusu anlaşılmadıysa LLM'e sor. Güçlü sinyal varsa bile soruyoruz:
  // sinyal "bunu da söyle" demek, "kullanıcı bunu sordu" demek değil.
  return { selected, forced, needsLlm: selected.length === 0, scores };
}

/**
 * Seçim + zorunlu uzmanları birleştirir, üst sınırı uygular.
 *
 * Mesajın asıl konusu (selected) ÖNCE gelir; sinyalle eklenenler sonra.
 * Sınır dolduğunda kesilen taraf sinyal olur — kullanıcının sorduğu soru
 * cevapsız kalmasın.
 */
export function mergeSelections(
  selected: AgentSelection[],
  forced: AgentSelection[],
  limit = MAX_AGENTS
): AgentSelection[] {
  const out: AgentSelection[] = [];
  const seen = new Set<SpecialistKey>();
  for (const s of [...selected, ...forced]) {
    if (seen.has(s.key)) continue;
    seen.add(s.key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** LLM'e sorulacak sınıflandırma promptu. Kısa tutuluyor — bu çağrı ucuz olmalı. */
export function buildRouterPrompt(): string {
  const list = ROUTABLE_SPECIALISTS.map((s) => `${s.key}: ${s.description}`).join("\n");
  return `Bir fitness uygulamasının yönlendiricisisin. Kullanıcının mesajını oku ve hangi uzmanların cevaba katkı vermesi gerektiğine karar ver.

UZMANLAR:
${list}

KURALLAR:
- En fazla ${MAX_AGENTS} uzman seç. Gereksiz uzman seçmek maliyeti artırır ve cevabı dağıtır.
- Mesaj tek bir konuya aitse TEK uzman seç. Çoğu mesaj tek uzmanla cevaplanır.
- Selamlama, teşekkür, sohbet ya da genel bir soruysa yalnızca "fitness" seç.
- Yalnızca uzman anahtarlarını virgülle ayırarak yaz. Açıklama, cümle, noktalama ekleme.

Örnek çıktı: nutrition,fitness`;
}

/** LLM çıktısını güvenli biçimde ayrıştırır. */
export function parseRouterOutput(raw: string): SpecialistKey[] {
  const valid = new Set(ROUTABLE_SPECIALISTS.map((s) => s.key as string));
  const keys = raw
    .toLowerCase()
    .split(/[,\s\n]+/)
    .map((k) => k.trim().replace(/[^a-z_]/g, ""))
    .filter((k) => valid.has(k)) as SpecialistKey[];

  return [...new Set(keys)].slice(0, MAX_AGENTS);
}

/**
 * Son çare: LLM de karar veremezse fitness koçu cevaplasın.
 *
 * NEDEN FITNESS: Uygulamanın ana konusu antrenman ve o ajanın bağlamı en
 * geniş. Boş cevap dönmek ya da "anlamadım" demek, kullanıcı açısından
 * ürünün bozuk olması demektir.
 */
export const FALLBACK_AGENT: SpecialistKey = "fitness";
