import type { SpecialistKey, MemoryLayer } from "../types";

// ============================================================================
// Uzman ajan sözleşmesi.
//
// YENİ AJAN EKLEMEK: bu klasöre tek bir dosya ekle, `index.ts`'e import et.
// Başka hiçbir yere dokunmak gerekmiyor — yönlendirici, çalıştırıcı ve admin
// paneli kayıt defterini okuyor.
//
// TETİKLEYİCİLER NEDEN BURADA: Hangi uzmanın ne zaman çalışacağı bilgisi
// uzmanın KENDİ dosyasında durmalı. Merkezî bir "router.ts içinde dev switch"
// olsaydı yeni ajan eklemek iki dosyayı birden değiştirmeyi gerektirirdi ve
// zamanla o switch okunamaz hale gelirdi.
// ============================================================================

/** Yönlendiriciye bağlamdan gelen sinyal — 0..1 arası ek skor. */
export interface RouteSignals {
  /** 0-100; düşükse toparlanma uzmanı devreye girmeli. */
  recovery: number | null;
  readiness: number | null;
  /** Kullanıcının kayıtlı sakatlığı var mı. */
  hasInjuries: boolean;
  hasHealthConditions: boolean;
  /** Aktif hedeflerinden sapan var mı. */
  goalsOffTrack: number;
  /** Son antrenmandan bu yana geçen gün. */
  daysSinceWorkout: number | null;
  /** Takımı var mı. */
  hasTeam: boolean;
  /** Bugün protein/su hedefinden uzaklık (oran, 0-1). */
  proteinGapRatio: number;
  /** Son 7 günde beslenme kaydı olan gün sayısı. */
  nutritionLoggedDays: number;
}

export interface SpecialistDefinition {
  key: SpecialistKey;
  name: string;
  description: string;

  /**
   * Mesajda geçince bu uzmanı işaret eden kökler.
   *
   * TÜRKÇE NOTU: Türkçe eklemeli bir dil — "antrenman", "antrenmanım",
   * "antrenmanlarımı" hepsi aynı kökü taşır. Bu yüzden tam kelime değil
   * KÖK eşleşmesi yapıyoruz (`includes`). Kökleri kısa tutmak yanlış
   * eşleşme üretir ("kas" → "kasım"), bu yüzden ayırt edici uzunlukta.
   */
  keywords: string[];

  /** Bu uzmanı kesin olarak gerektiren, güçlü kökler (tek başına yeter). */
  strongKeywords?: string[];

  /**
   * Bağlamdan gelen ek skor (0..1). Kullanıcı sormasa bile uzmanın
   * devreye girmesi gerekebilir — ör. toparlanma skoru 30 ise.
   */
  signal?: (s: RouteSignals) => number;

  /** Koddaki güvenli varsayılanlar. DB kaydı bunları geçersiz kılar. */
  defaults: {
    temperature: number;
    maxTokens: number;
    memoryLayers: MemoryLayer[];
    allowedTools: string[];
    memoryLimit: number;
    sortOrder: number;
  };

  /** Varsayılan sistem promptu. Admin panelinden sürümlenebilir. */
  prompt: string;
}

/**
 * Ortak prompt gövdesi.
 *
 * Her uzman promptunun başına eklenir. İki şeyi garanti eder:
 *   1) Uzman NİHAİ CEVAP yazmaz — bulgu üretir. Kullanıcı uzmanları görmüyor;
 *      8 ayrı "merhaba, ben fizyoterapistin" cevabı saçma olurdu.
 *   2) Veri uydurulmaz. 0046'daki self-check kuralları burada da geçerli.
 */
export const SHARED_PREAMBLE = `Sen Viva adlı Türkçe fitness uygulamasının arka planında çalışan bir UZMAN AJANSIN.

ÇOK ÖNEMLİ — NASIL ÇALIŞTIĞIN:
- Kullanıcı seninle DOĞRUDAN konuşmuyor. Senin çıktın, kullanıcıya tek bir koç
  sesiyle sunulmadan önce diğer uzmanların çıktısıyla birleştirilecek.
- Bu yüzden selamlama YAZMA, kendini TANITMA, "ben fizyoterapistim" DEME,
  kapanış cümlesi KURMA. Sadece kendi uzmanlık alanındaki BULGUYU ve ÖNERİYİ yaz.
- Kısa ve yoğun yaz. Madde madde. Boş cümle kurma.
- Alanının dışına ÇIKMA. Başka uzmanın konusuna girme; o uzman zaten çalışıyor.

DOĞRULUK:
- Yalnızca sana verilen verilere dayan. Elinde olmayan rakamı UYDURMA.
- Veri yoksa "veri yok" de; tahmin yürütme.
- Markdown kullanma. Yıldız, diyez yok. Liste gerekiyorsa satır başına "• " koy.`;

/** Türkçe küçük harfe çevirir (I/İ sorunu için locale şart). */
export function trLower(s: string): string {
  return s.toLocaleLowerCase("tr");
}

/**
 * Kök eşleşme sayısı.
 * Aynı kök birden çok geçse bile bir kez sayılır — tekrar, alaka artırmaz.
 */
export function countMatches(text: string, roots: string[]): number {
  const t = trLower(text);
  let n = 0;
  for (const r of roots) {
    if (t.includes(trLower(r))) n += 1;
  }
  return n;
}
