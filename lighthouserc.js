// ============================================================================
// Lighthouse CI yapılandırması.
//
// NE İÇİN: REGRESYON yakalamak. "90 aldık" demek için DEĞİL.
//
// CI'da ölçülen değer, paylaşımlı bir runner'da, yerel ağda, gerçek kullanıcı
// koşulları olmadan üretiliyor. Mağaza kontrol listesindeki "Lighthouse ≥ 90"
// maddesinin GERÇEK doğrulaması, domain bağlandıktan sonra canlı site
// üzerinde PageSpeed Insights ile yapılmalı (bkz. docs/paket-boyutu.md).
//
// Buradaki eşikler bu yüzden "geçer not" değil, "bugünkünden belirgin şekilde
// kötüleşme var mı" alarmı. Eşiği gerçekte ölçülen değerlerin biraz altına
// koymak, CI'yı gürültüyle kırmızıya boğmadan gerçek düşüşleri yakalar.
//
// Ölçülen sayfalar oturum GEREKTİRMEYENLER — CI'da gerçek Supabase kimlik
// bilgisi yok, korumalı sayfalar zaten /login'e düşer.
// ============================================================================

// Port CI ile yerel arasında değişebilsin.
const TABAN = process.env.LHCI_BASE_URL || "http://127.0.0.1:3000";

module.exports = {
  ci: {
    collect: {
      // Sunucuyu CI adımı başlatıyor; burada yalnızca adresler.
      url: [`${TABAN}/`, `${TABAN}/login`],
      numberOfRuns: 1,
      settings: {
        // CI runner'ında GPU yok; varsayılan masaüstü emülasyonu daha kararlı
        // sonuç veriyor. Mobil ölçüm canlı sitede PageSpeed ile yapılacak.
        preset: "desktop",
        // PWA kategorisi kaldırıldı: service worker davranışı `next start`
        // altında canlıdan farklı ve sürekli yanlış alarm üretiyor.
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        chromeFlags: "--no-sandbox --disable-dev-shm-usage",
      },
    },
    assert: {
      assertions: {
        // Erişilebilirlik ve SEO deterministik — yüksek eşik güvenli.
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
        // Performans paylaşımlı runner'da dalgalanıyor; eşik uyarı seviyesinde.
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      // Geçici genel depoya yükler; rapor bağlantısı CI çıktısında görünür.
      // Sunucu kurmadan raporu gözle incelemenin en kolay yolu.
      target: "temporary-public-storage",
    },
  },
};
