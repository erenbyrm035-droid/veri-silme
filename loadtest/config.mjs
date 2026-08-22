// ============================================================================
// Load test ortak yapılandırması (Node tarafı — seed/teardown/collect).
//
// Buradaki hiçbir değer koda gömülmez; hepsi ortam değişkeninden gelir.
// Eksik değişkende BETİK DURUR — yanlış projeye yazmaktansa hiç çalışmamak.
// ============================================================================

/** Zorunlu ortam değişkenini okur; yoksa açık bir mesajla durur. */
export function gerekli(ad, aciklama) {
  const v = process.env[ad];
  if (!v) {
    console.error(`\n[HATA] ${ad} tanımlı değil.\n  ${aciklama}\n`);
    process.exit(1);
  }
  return v;
}

export function istege(ad, varsayilan) {
  return process.env[ad] || varsayilan;
}

/**
 * ÜRETİME YAZMA ONAYI.
 *
 * Bu takım production veritabanına test kullanıcısı yazıyor. Kazara
 * çalıştırılmasın diye açık onay isteniyor: LOADTEST_ONAY=evet.
 * Bir bayrak eklemek, yanlışlıkla 500 sahte kullanıcı açmaktan ucuzdur.
 */
export function onayIste(islem) {
  if (process.env.LOADTEST_ONAY !== "evet") {
    console.error(
      `\n[DURDU] "${islem}" üretim veritabanına dokunuyor.\n` +
        `  Devam etmek için: LOADTEST_ONAY=evet ile çalıştır.\n` +
        `  Öncesinde Supabase → Database → Backups'tan elle yedek al.\n`
    );
    process.exit(1);
  }
}

/** Test hesaplarının e-posta deseni. `.invalid` TLD'si RFC 2606 ile ayrılmıştır:
 *  DNS'te asla çözülmez, yani kazara gerçek bir adrese posta gitmesi imkânsız. */
export const EPOSTA_ALANI = "viva-loadtest.invalid";
export const EPOSTA_ONEK = "loadtest";

/** Test kullanıcılarının damgası. teardown BUNA bakarak siler — desen
 *  eşleştirmeye ya da tahmine güvenmez. */
export const DAMGA = "viva_loadtest";

export const SIFRE = "LoadTest!2026_viva";

export function kosuKimligi() {
  return istege("LOADTEST_RUN", new Date().toISOString().slice(0, 16).replace(/[-:T]/g, ""));
}

export function kullaniciDosyasi(runId) {
  return new URL(`./rapor/kullanicilar-${runId}.json`, import.meta.url).pathname;
}
