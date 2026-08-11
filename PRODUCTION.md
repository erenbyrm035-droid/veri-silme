# Viva AI Coach — Production Hazırlık Raporu (Sprint 10)

Bu belge, uygulamanın production/mağaza seviyesine çıkması için **tamamlanan** ve
**kalan** işleri listeler. Yeni ürün özelliği eklenmedi; yalnızca sertleştirme.

---

## ✅ Bu sprintte tamamlananlar

| Alan | Durum | Nerede |
|------|-------|--------|
| Güvenlik başlıkları (CSP, HSTS, X-Frame, nosniff, Permissions-Policy) | ✅ | `next.config.ts` |
| Global error boundary + crash reporting soyutlaması | ✅ | `src/app/global-error.tsx`, `src/lib/observability/report.ts` |
| Rate limit (sliding-window, AI route'una bağlı) | ✅ | `src/lib/security/rate-limit.ts`, `api/ai-coach` |
| Premium yetkilendirme motoru (Free/Monthly/Yearly/Lifetime) | ✅ | `src/lib/premium/*` |
| Premium özellik kapıları (entitlements/hasFeature/requireFeature) | ✅ | `src/lib/premium/{entitlements,guard}.ts` |
| Premium fiyatlandırma sayfası | ✅ | `/premium` |
| Ödeme sağlayıcı soyutlaması (Stripe/Play/StoreKit arayüzü) | ✅ (iskelet) | `src/lib/billing/provider.ts` |
| Ödeme webhook mimarisi (idempotent, imza doğrulamalı) | ✅ (iskelet) | `api/billing/webhook` |
| Push (FCM) soyutlaması + 8 bildirim kategorisi | ✅ (iskelet) | `src/lib/push/fcm.ts` |
| Kullanıcı Ayarları (profil/tema/dil/birim/bildirim/gizlilik) | ✅ | `/settings` |
| KVKK/GDPR — Veri indirme (JSON export) | ✅ | `src/lib/settings/actions.ts` |
| KVKK/GDPR — Hesap silme (auth.deleteUser + cascade) | ✅ | `src/lib/settings/actions.ts` |
| Yasal sayfalar: Gizlilik, Şartlar, Destek, İletişim, Hakkında/Sürüm | ✅ | `src/app/(legal)/*` |
| Admin: Sistem Sağlığı (DB/AI/Storage/Config/Hata logları) | ✅ | `/admin/system` |
| CI/CD (GitHub Actions: lint + typecheck + build) | ✅ | `.github/workflows/ci.yml` |
| DB migration 0022 (settings/push/logs/billing/deletion + RLS) | ✅ | `supabase/migrations/0022_*.sql` |

---

## ⏳ Kalan production noktaları (dış yapılandırma / entegrasyon gerektirir)

Bunlar **kod tarafında hazır** ama **anahtar/hesap** ister:

1. **Ödeme (Stripe):** `npm i stripe` + `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   fiyat ID'leri. `provider.ts` içindeki 2 TODO doldurulur.
2. **Google Play Billing / Apple StoreKit:** mobil kabuk (Capacitor/native) makbuz
   doğrulaması → aynı webhook mimarisine bağlanır.
3. **Push (FCM):** `FCM_SERVER_KEY` (veya service account JSON) + `fcm.ts` gönderim TODO'su.
4. **AI Coach sohbeti:** `OPENAI_API_KEY` veya `ANTHROPIC_API_KEY` (yoksa güvenli fallback).
5. **Hata izleme (Sentry):** `SENTRY_DSN` + `report.ts` içindeki captureException.
6. **2FA:** Supabase Auth MFA (TOTP) — Supabase panelinden etkinleştirilip UI eklenmeli.
7. **Magic Link:** Supabase Auth'ta e-posta OTP zaten mevcut; giriş ekranına buton eklenebilir.
8. **Testler:** Vitest (unit) + Playwright (E2E) kurulup CI'daki `e2e` job'ı açılmalı.
9. **Offline mode derinleştirme:** Service worker mevcut; program/egzersiz/GIF/AI raporu
   için IndexedDB + React Query persist önerilir (altyapı hazır, kalıcı cache eklenecek).
10. **Store görselleri:** app icon setleri mevcut (`/public/icon-*`); mağaza ekran görüntüleri
    ve feature graphic hazırlanmalı.

---

## Güvenlik notları

- Tüm kullanıcı tabloları **RLS** ile korunuyor; admin işlemleri `has_admin_access()` +
  service_role. Migration'lar idempotent.
- CSP TF.js (wasm/eval) ve Three.js (blob worker) ile uyumlu ayarlandı.
- SQL injection: tüm sorgular Supabase client (parametrize) üzerinden; ham SQL yok.
- XSS: React varsayılan kaçışı; markdown `react-markdown` ile güvenli render.
- CSRF: Supabase cookie tabanlı oturum + same-site; state değiştiren işlemler Server Actions.
- Secret rotasyonu: kullanılan Vercel token'ı ve Supabase service_role anahtarı iş bitince
  yenilenmeli.
