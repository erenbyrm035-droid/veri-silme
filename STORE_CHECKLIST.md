# 🏪 Store'a Çıkmadan Önce — Yayın Checklist'i

Viva AI Coach'un App Store / Google Play / Web'de yayına hazır olması için
adım adım kontrol listesi. `[x]` = hazır, `[ ]` = yapılacak.

## 1. Yasal & Uyumluluk
- [x] Gizlilik Politikası sayfası (`/privacy`)
- [x] Kullanım Şartları sayfası (`/terms`)
- [x] KVKK/GDPR veri indirme
- [x] KVKK/GDPR hesap silme
- [x] Çerez/gizlilik açıklaması
- [ ] Gerçek şirket/iletişim bilgileri (e-posta adresleri placeholder — güncellenmeli)
- [ ] App Store/Play "Data Safety" & "App Privacy" formları doldurulmalı

## 2. Kimlik Doğrulama
- [x] E-posta + şifre
- [x] Şifre sıfırlama
- [x] E-posta doğrulama
- [x] Google OAuth (Supabase'te sağlayıcı açık olmalı)
- [x] Apple OAuth (Supabase'te sağlayıcı açık olmalı)
- [x] Magic Link (şifresiz giriş) — sunucu action'ı + giriş sayfası butonu.
      (Bu madde "altyapı hazır" diyordu ama `signInWithOtp` kod tabanında
      hiç yoktu; gönderme tarafı sıfırdan yazıldı. Doğrulama tarafı gerçekten
      hazırdı: `/auth/confirm` `verifyOtp`'yi genel işliyor.)
      **Senin adımın:** Supabase → Authentication → Providers → Email →
      "Enable Email OTP / Magic Link" açık olmalı; e-posta şablonu
      Authentication → Email Templates → Magic Link.
- [x] 2FA / MFA — TOTP, Ayarlar → Güvenlik. Kayıt (QR + kod), girişte kod
      ekranı, middleware'de her istekte aal2 kapısı, kaba kuvvet sınırı.
      **Kurtarma kodu YOK** (gerekçe: `docs/guvenlik-notlari.md`) —
      kullanıcı açma ekranında uyarılıyor.
      **Senin adımın:** Supabase → Authentication → Providers → MFA etkin olmalı.

## 3. Ödeme & Premium
- [x] Plan/rol sistemi (Free/Monthly/Yearly/Lifetime)
- [x] Premium özellik kapıları
- [x] Fiyatlandırma sayfası
- [x] Webhook mimarisi (idempotent)
- [ ] Stripe anahtarları + `npm i stripe` + checkout tamamlama
- [x] Google Play Billing kodu hazır (istemci: `lib/billing/play-client.ts`,
      sunucu doğrulaması: `/api/billing/play/verify`) — env girilince aktif
- [ ] Apple StoreKit makbuz doğrulama (iOS kabuğu ile birlikte)
- [ ] Gerçek fiyatların ve KDV'nin doğrulanması

## 4. Bildirimler
- [x] In-app notifications
- [x] Bildirim kategorileri + kullanıcı tercihleri
- [x] Push soyutlaması (FCM)
- [ ] FCM anahtarı + web push VAPID + cihaz token kaydı
- [ ] iOS APNs sertifikası (mobil)

## 5. Performans
- [x] Code splitting (route + `next/dynamic` ağır kütüphaneler)
- [x] Lazy loading (TF.js, Three.js, grafikler)
- [x] Görsel optimizasyonu (`next/image`, avif/webp)
- [x] Statik varlık cache header'ları
- [x] Lighthouse — CI'da her push'ta koşuyor (`lighthouserc.js`). Yerel
      ölçüm: **dört kategoride de 100** (/ ve /login). Ölçüm sırasında iki
      erişilebilirlik hatası bulunup düzeltildi.
      **Not:** bu değer yerel koşullarda; gerçek doğrulama domain
      bağlandıktan sonra PageSpeed Insights ile yapılmalı.
- [x] Bundle analiz — `npm run analyze`. Ölçüm yapıldı: paylaşılan JS 103 kB,
      en ağır rota 292 kB; three/tfjs/recharts zaten `dynamic()` arkasında.
      Ek optimizasyon gerekmiyor. Ayrıntı: `docs/paket-boyutu.md`

## 6. Güvenlik
- [x] Güvenlik başlıkları (CSP/HSTS/X-Frame/nosniff/Permissions-Policy)
- [x] Rate limit (AI route)
- [x] RLS tüm tablolarda
- [x] XSS/CSRF/SQL-injection önlemleri
- [x] Rate limit — AI uçlarına patlama sınırı (premium dahil), play/verify ve
      barkod uçlarına sınır, yazma action'larına profil bazlı sınır. Ödeme
      webhook'ları bilerek istisna. Upstash bağlanınca dağıtık olur (kod
      değişikliği gerekmez). Ayrıntı: `docs/guvenlik-notlari.md`
- [x] Bağımlılık güvenlik taraması — Dependabot (haftalık, gruplu) +
      `npm audit` denetimi. Next.js'te 8 açık (3 yüksek) bulunup kapatıldı.
      Bilerek açık bırakılanların gerekçesi: `docs/guvenlik-notlari.md`
- [ ] Secret rotasyonu (Vercel token + Supabase service_role)

## 7. Gözlemlenebilirlik
- [x] Global error boundary
- [x] Hata log tablosu + admin görüntüleme
- [x] Admin sistem sağlığı paneli
- [x] Sentry — kod tarafı bağlandı (`@sentry/node`, tek huniden).
      **Senin adımın:** sentry.io'da proje aç, DSN'i Vercel'e `SENTRY_DSN`
      olarak gir. Tanımlanana kadar hatalar yine `error_logs` tablosuna
      ve konsola yazılıyor — hiçbir şey bozulmuyor.
- [ ] Uptime/alerting (ör. Better Uptime / Vercel Monitoring)

## 8. Erişilebilirlik
- [x] Koyu/açık tema + kontrast
- [x] Semantik HTML + aria etiketleri (nav/butonlar)
- [x] Dinamik yazı tipi ölçeği — Ayarlar → Yazı boyutu (4 kademe). Kök
      font-size değiştiği için tüm arayüz orantılı ölçekleniyor.
- [ ] VoiceOver/TalkBack manuel testi
- [x] Klavye navigasyonu denetimi — 5 modal yalnızca fareyle kapanıyordu
      (Esc yoktu); ortak `useModal` kancasıyla Esc + odak tuzağı + odak
      iadesi eklendi. "İçeriğe atla" bağlantısı yoktu, eklendi.
      9 E2E testiyle korunuyor.

## 9. Test & CI/CD
- [x] GitHub Actions: lint + typecheck + test + build
      (Bu madde uzun süre yanlış işaretliydi: depoda hiç ESLint yapılandırması
      yoktu, `next lint` interaktif soru sorup exit 1 veriyor ve akış hep
      kırmızıya düşüyordu. Yapılandırma eklendi, çalışma #13'ten beri yeşil.)
- [x] Vitest unit testleri — saf fonksiyonlar (workout engine, XP projeksiyonu,
      egzersiz isim/arama, AI güvenlik kalıpları, postür eşikleri, plan/SKU
      eşlemesi, profil ve takım şemaları, takım üyelik kapıları)
- [x] Playwright E2E — 22 test, CI'da her push'ta koşuyor. Oturum
      GEREKTİRMEYEN akışlar tam kapsanıyor (kimlik doğrulama kapısı, giriş
      sayfası, magic link, erişilebilirlik). Oturum gerektirenler yazıldı
      ama kimlik bilgisi olmadan ATLANIYOR — sahte yeşil üretmemek için.
      **Senin adımın:** staging Supabase'de bir test hesabı aç, GitHub
      repo secrets'a `E2E_EMAIL` / `E2E_PASSWORD` ekle; o testler
      kendiliğinden koşmaya başlar.
- [ ] Preview deploy (Vercel PR preview) + Production deploy pipeline

## 10. Store Hazırlığı
- [x] App icon setleri (192/512 + maskable)
- [x] Splash / manifest (PWA)
- [x] Onboarding akışı
- [x] Destek / İletişim / Sürüm ekranları
- [ ] Store ekran görüntüleri (6.5"/5.5" iPhone, Android, tablet)
- [ ] Feature graphic (1024×500) + tanıtım metni
- [ ] Yaş sınırı / içerik derecelendirmesi
- [x] Android kabuk kararı: **TWA** (Capacitor değil — yeni npm bağımlılığı
      gerektirmiyor, Play Billing zaten Digital Goods API ile bağlı)
- [x] TWA proje dosyaları hazır (`android-twa/`) + rehber
      (`docs/android-studio-twa-kurulum.md`)
- [ ] Android Studio'da projeyi oluştur + dosyaları yerleştir + imzalı AAB üret
- [ ] Play Console'da uygulamayı aç → dahili teste yükle
- [ ] Play App Signing SHA-256'yı `public/.well-known/assetlinks.json` içine
      yaz + deploy (şu an `REPLACE_WITH_...` yer tutucu)
- [ ] Play ürünleri: `premium_monthly` / `premium_yearly` / `premium_lifetime`
- [ ] Vercel env: `ANDROID_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- [ ] iOS kabuk (ayrı iş — RevenueCat yolu, `docs/revenuecat-kurulum.md`)

## 11. Veri & Yedekleme
- [x] Migration'lar (0001–0022) versiyonlanmış + `schema.sql` senkron
- [ ] Supabase otomatik yedekleme planı doğrulaması
- [x] Storage kota/temizlik — yetim dosya toplayıcı. VARSAYILAN OLARAK
      SİLMEZ, yalnızca sayar. `/api/maintenance/storage-cleanup` ile kuru
      rapora bak; sayılar beklendiği gibiyse Vercel'de
      `STORAGE_CLEANUP_APPLY=1` yap. Kapsam: body-photos, meal-photos,
      posture-photos (eşlemesi kesin olanlar).

---

### Yayın öncesi minimum "must-have" (kritik yol)
1. Ödeme sağlayıcısı (Stripe veya mağaza billing) tamamlama
2. FCM push aktivasyonu
3. Sentry + uptime izleme
4. Gerçek yasal/iletişim bilgileri
5. E2E test + Lighthouse geçişi
6. Store görselleri + gizlilik formları
