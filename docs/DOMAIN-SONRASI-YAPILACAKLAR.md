# 🌐 Domain Aldıktan Sonra Yapılacaklar

Kendi alan adını (örn. `vivaapp.com`) aldıktan sonra sırayla bunları yap.
Aşağıda `SENIN-DOMAIN` yerine gerçek alan adını yaz.

---

## 1) Vercel — domaini bağla + site URL env

- Vercel → Project → **Settings → Domains** → domaini ekle (DNS kayıtlarını
  domain sağlayıcında gir: A / CNAME).
- **Settings → Environment Variables**:
  - `NEXT_PUBLIC_SITE_URL = https://SENIN-DOMAIN`
- Değişiklik sonrası **yeniden deploy** al.

> Bu env birçok yerde kullanılıyor (iyzico callback, e-posta linkleri vb.),
> o yüzden en kritik adım budur.

## 2) Supabase — Auth URL'leri

Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://SENIN-DOMAIN`
- **Redirect URLs** (hepsini ekle):
  - `https://SENIN-DOMAIN/**`
  - `https://SENIN-DOMAIN/auth/callback`
  - `https://SENIN-DOMAIN/auth/confirm`
  - `https://SENIN-DOMAIN/reset-password`

> Yoksa şifre sıfırlama / e-posta doğrulama / Google-Apple girişi yanlış
> adrese döner.

## 3) Google / Apple OAuth — redirect URI

- **Google Cloud Console** → OAuth Client → Authorized redirect URIs'e
  Supabase callback + `https://SENIN-DOMAIN/auth/callback` ekle.
- **Apple Developer** → Services ID → Return URLs güncelle.

## 4) iyzico — callback

- iyzico callback zaten `NEXT_PUBLIC_SITE_URL`'i kullanıyor; 1. adımı yapınca
  otomatik düzelir. Yine de iyzico panelinde tanımlı bir URL varsa güncelle.

## 5) ⭐ RevenueCat — webhook URL (iOS/Android IAP)

RevenueCat → **Integrations → Webhooks** → mevcut webhook'u düzenle:
- **Webhook URL:** `https://SENIN-DOMAIN/api/billing/revenuecat`
- **Authorization header (aynı kalır):**
  `rcw_56acc57a0c469ae0dfc417d2ffd832679e9d0398bef63599d11d5f1bb4f21c6d`
- Kaydet → **Send test event** ile `200 OK` doğrula.

> Not: `veri-silme.vercel.app` adresi domain sonrası da çalışmaya devam eder,
> ama kalıcı olarak kendi domainini kullanmak daha profesyonel + güvenli.

## 6) PWA / genel

- PWA "Ana ekrana ekle" ikonu ve paylaşım linkleri artık yeni domaini gösterir
  (env sonrası otomatik). Sosyal medya / App Store açıklamalarında yeni domaini
  kullan.

---

## Ayrıca (domainden bağımsız, lansman öncesi güvenlik)

- [ ] Sohbette paylaşılan anahtarları **yenile (rotate)**: OpenAI, Vercel token,
      iyzico, Supabase service_role.
- [ ] iyzico **prodüksiyon** başvurusu + eksik yasal sayfalar
      (Mesafeli Satış Sözleşmesi, İptal/İade Politikası).
- [ ] `REVENUECAT_WEBHOOK_SECRET` prodüksiyon için yeni bir değere çevrilebilir
      (bu sır sohbette görüldüğü için).
