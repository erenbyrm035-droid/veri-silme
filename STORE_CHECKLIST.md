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
- [ ] Magic Link butonu (altyapı hazır — UI eklenecek)
- [ ] 2FA / MFA (Supabase MFA etkinleştir + UI)

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
- [ ] Lighthouse ≥ 90 (Perf/A11y/Best/SEO) doğrulaması
- [ ] Bundle analiz (`@next/bundle-analyzer`) ile büyük chunk kontrolü

## 6. Güvenlik
- [x] Güvenlik başlıkları (CSP/HSTS/X-Frame/nosniff/Permissions-Policy)
- [x] Rate limit (AI route)
- [x] RLS tüm tablolarda
- [x] XSS/CSRF/SQL-injection önlemleri
- [ ] Rate limit'i tüm yazma API'larına yaygınlaştır (Upstash Redis önerilir)
- [ ] Bağımlılık güvenlik taraması (`npm audit`, Dependabot)
- [ ] Secret rotasyonu (Vercel token + Supabase service_role)

## 7. Gözlemlenebilirlik
- [x] Global error boundary
- [x] Hata log tablosu + admin görüntüleme
- [x] Admin sistem sağlığı paneli
- [ ] Sentry DSN bağlama
- [ ] Uptime/alerting (ör. Better Uptime / Vercel Monitoring)

## 8. Erişilebilirlik
- [x] Koyu/açık tema + kontrast
- [x] Semantik HTML + aria etiketleri (nav/butonlar)
- [ ] Dinamik yazı tipi ölçeği (ayarlarda font-scale)
- [ ] VoiceOver/TalkBack manuel testi
- [ ] Klavye navigasyonu tam denetimi

## 9. Test & CI/CD
- [x] GitHub Actions: lint + typecheck + build
- [ ] Vitest unit testleri (nutrition/premium/entitlements/rate-limit)
- [ ] Playwright E2E (login → onboarding → workout → AI)
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
- [ ] Storage bucket kota/temizlik politikası

---

### Yayın öncesi minimum "must-have" (kritik yol)
1. Ödeme sağlayıcısı (Stripe veya mağaza billing) tamamlama
2. FCM push aktivasyonu
3. Sentry + uptime izleme
4. Gerçek yasal/iletişim bilgileri
5. E2E test + Lighthouse geçişi
6. Store görselleri + gizlilik formları
