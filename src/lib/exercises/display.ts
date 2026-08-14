// ============================================================================
// Egzersiz GÖRÜNEN İSMİ — tek kaynak.
//
// NEDEN AYRI BİR KATMAN:
//   `exercises.name` Türkçe ve VERİTABANI İÇ ANAHTARIDIR. `workout_sets.
//   exercise_name` ile `personal_records.exercise_name` onun kopyasını tutuyor
//   ve PR tablosunun benzersizlik kısıtı (unique(user_id, exercise_name)) ona
//   bağlı. Bu yüzden `name` DEĞİŞTİRİLEMEZ — değişse tüm geçmiş antrenman ve
//   rekor kayıtları koparadı.
//
//   Kullanıcıya gösterilecek isim ise uluslararası standart olmalı: kullanıcı
//   hareketi YouTube / NASM / ACE / ExRx'te aynı isimle arayabilsin.
//   "Göğüs Presi" değil "Barbell Bench Press".
//
//   Çözüm: veritabanı `name` ile çalışır, ARAYÜZ `english_name` gösterir.
//   Bu modül o çeviriyi tek yerde yapar.
// ============================================================================

/** Görünen isim için gereken asgari alanlar. */
export interface NameableExercise {
  name?: string | null;
  english_name?: string | null;
  aliases?: string[] | null;
}

/**
 * Kullanıcıya gösterilecek isim: standart İngilizce ad.
 *
 * `english_name` yoksa `name`e düşer — veri eksikse boş kutu göstermektense
 * eldeki ismi göstermek daha iyidir.
 */
export function displayName(ex: NameableExercise | null | undefined): string {
  if (!ex) return "";
  const en = (ex.english_name ?? "").trim();
  if (en) return en;
  return (ex.name ?? "").trim();
}

/**
 * `workout_sets` / `personal_records` gibi ismi DENORMALİZE tutan kayıtlar için.
 *
 * Bu tablolar Türkçe `name`in kopyasını saklıyor. Kayıtta `exercise_id` varsa
 * egzersiz listesinden standart isim çözülür; yoksa (egzersiz silinmişse)
 * saklanan isme düşülür — geçmiş kayıt asla isimsiz kalmaz.
 */
export function displayNameFor(
  stored: { exercise_id?: string | null; exercise_name?: string | null },
  byId: Map<string, NameableExercise>
): string {
  if (stored.exercise_id) {
    const ex = byId.get(stored.exercise_id);
    if (ex) return displayName(ex);
  }
  return (stored.exercise_name ?? "").trim();
}

/**
 * Aksan/Türkçe harf farkını yok sayan arama anahtarı.
 *
 * `I` EŞLEMESİ ŞART: aşağıda `toLocaleLowerCase("tr-TR")` var ve Türkçe
 * yerelde büyük `I` → NOKTASIZ `ı` olur. Bu eşleme olmadan "DEADLIFT"
 * aranınca "deadlıft" üretilir ve "Romanian Deadlift" ile eşleşmez —
 * yani caps lock'la ya da otomatik büyük harf yapan mobil klavyeyle
 * arayan kullanıcı hiçbir sonuç alamaz. Büyük ve küçük İ/I'nın dört
 * biçimi de `i`ye indirgeniyor.
 */
function foldKey(s: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    İ: "i", I: "i",
  };
  return s
    .split("").map((c) => map[c] ?? c).join("")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Arama eşleşmesi — standart isim, alias'lar VE Türkçe iç isim üzerinden.
 *
 * Üçü birden aranır çünkü kullanıcı üç şekilde de yazabilir:
 *   "RDL"                → alias
 *   "Romanian Deadlift"  → standart isim
 *   "Rumen"              → eski Türkçe isim (alışkanlık)
 * Türkçe ismi aramadan çıkarmak, eski kullanıcıların bildiği hareketi
 * bulamaması demek olurdu.
 */
export function matchesSearch(ex: NameableExercise, query: string): boolean {
  const q = foldKey(query);
  if (!q) return true;
  const alanlar = [ex.english_name, ex.name, ...(ex.aliases ?? [])];
  return alanlar.some((a) => a && foldKey(a).includes(q));
}

/** Video/medya dosyası için standart isimden türetilen slug. */
export function videoSlug(ex: NameableExercise): string {
  return foldKey(displayName(ex)).replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
