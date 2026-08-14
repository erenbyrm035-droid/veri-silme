# RevenueCat (iOS/Android IAP) Kurulumu

> ## ⚠ ANDROID İÇİN BU DOKÜMANI KULLANMA
>
> Android kabuğu **TWA** olarak kuruldu (bkz.
> [`android-studio-twa-kurulum.md`](./android-studio-twa-kurulum.md)) ve Play
> satın almalarını **RevenueCat'siz**, doğrudan Digital Goods API +
> `/api/billing/play/verify` üzerinden işliyor
> (`src/lib/billing/play-client.ts`).
>
> **Sonuç — Play Console'daki ürün kimlikleri:** TWA yolunda eşleme
> `planForSku()` ile **birebir** yapılır
> (`src/app/api/billing/play/verify/route.ts` → `src/lib/premium/plans.ts`
> `playSku`). Ürünleri aşağıdaki `viva_premium_*` kalıbıyla açarsan
> `planForSku()` `null` döner ve her satın alma **"Bilinmeyen ürün"** ile
> reddedilir. Play'de kullanılacak kimlikler:
> `premium_monthly`, `premium_yearly`, `premium_lifetime`.
>
> Aşağısı **iOS** için (ya da ileride Capacitor'a geçilirse Android için)
> geçerlidir.

Web'de iyzico kalır; **iOS/Android uygulamasında** abonelikler Apple/Google IAP
ile satılır. RevenueCat satın almayı yönetir, webhook ile Supabase'deki premium
durumunu günceller. Uygulamanın geri kalanı (entitlements motoru) değişmez.

Akış:

```
App Store Connect / Play Console (abonelik ürünleri)
        ↓
RevenueCat SDK (Capacitor uygulaması)
        ↓ webhook
/api/billing/revenuecat  (bu backend — HAZIR)
        ↓
Supabase profiles.is_premium / membership_type / premium_until
        ↓
getEntitlements() — mevcut motor, değişmeden çalışır
```

## 1) Ürünler (App Store Connect / Play Console)

Auto-renewable subscription + lifetime için non-consumable oluştur. Ürün
kimliklerini şu kalıba göre adlandır (backend otomatik eşler):

| Plan            | App Store Connect (iOS)  | Play Console (TWA — birebir) |
|-----------------|--------------------------|------------------------------|
| Aylık           | `viva_premium_monthly`   | `premium_monthly`            |
| Yıllık          | `viva_premium_yearly`    | `premium_yearly`             |
| Lifetime        | `viva_premium_lifetime`  | `premium_lifetime`           |

**İki sütun neden farklı:** RevenueCat yolunda eşleme esnek — id içinde
`life` → lifetime, `year/annual/yil` → yıllık, aksi halde aylık
(`src/lib/billing/revenuecat.ts:productToPlan`), yani `viva_` öneki sorun
çıkarmaz. TWA/Play yolunda ise eşleme **tam eşitlik** ile yapılır
(`planForSku()` → `plans.ts` `playSku`); önek eklersen satın alma reddedilir.

## 2) RevenueCat panel

1. Project oluştur, App Store + Play Store app'lerini bağla (API anahtarları).
2. **Entitlements**: `premium` adında bir entitlement, ürünleri ona bağla.
3. **Integrations → Webhooks**:
   - URL: `https://veri-silme.vercel.app/api/billing/revenuecat`
     (domain aldıktan sonra kendi domaininle güncelle)
   - **Authorization header**: güçlü bir gizli değer belirle (örn. `rcw_...`)

## 3) Vercel env değişkeni

Webhook'un doğrulaması için panelde belirlediğin Authorization değerini ekle:

```
REVENUECAT_WEBHOOK_SECRET = <panelde girdiğin Authorization değeri>
```

Not: `REVENUECAT_WEBHOOK_SECRET` boşsa backend doğrulama yapmaz (yalnızca test
için). Prodüksiyonda MUTLAKA doldur.

## 4) Uygulama tarafı (Capacitor)

`@revenuecat/purchases-capacitor` kur. Kullanıcı giriş yaptıktan sonra
RevenueCat kimliğini Supabase user id ile eşle:

```ts
import { Purchases } from "@revenuecat/purchases-capacitor";

// Uygulama açılışında (bir kez):
await Purchases.configure({ apiKey: APPLE_or_GOOGLE_PUBLIC_SDK_KEY });

// Kullanıcı giriş yapınca:
await Purchases.logIn({ appUserID: supabaseUserId });          // app_user_id = Supabase uuid
await Purchases.setAttributes({ "$supabaseUserId": supabaseUserId }); // yedek eşleme

// Satın alma:
const offerings = await Purchases.getOfferings();
const pkg = offerings.current?.availablePackages[0];
if (pkg) await Purchases.purchasePackage({ aPackage: pkg });
```

Backend, olaydaki `app_user_id` veya `$supabaseUserId` özniteliğinden kullanıcıyı
çözer (`resolveUserId`). İkisi de Supabase uuid olmalı.

## 5) Doğrulama

- RevenueCat panelinde **Send test event** ile webhook'u test et.
- Sandbox satın alımdan sonra `billing_events` tablosunda `provider='revenuecat'`
  kaydı ve ilgili kullanıcının `profiles.is_premium=true` olduğunu kontrol et.

## İşlenen olaylar

| Olay | Sonuç |
|------|-------|
| INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, NON_RENEWING_PURCHASE, UNCANCELLATION, SUBSCRIPTION_EXTENDED | premium ver (grant) |
| CANCELLATION, BILLING_ISSUE, SUBSCRIPTION_PAUSED | süre bitene dek premium kalır (keep) |
| EXPIRATION, REFUND | premium geri al (revoke) |

Tüm olaylar `billing_events`'e idempotent (event_id) yazılır.
