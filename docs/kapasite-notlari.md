# Kapasite notları — mimari bulgular ve yapılan düzeltmeler

Bu dosya, production kapasite ölçümü için yapılan **okuma-tabanlı mimari
analizin** bulgularını ve her birinin akıbetini tutar.

Ölçüm takımının kendisi `loadtest/` altında. Bu dosya "ne bulduk, ne düzelttik,
ne senin tarafında kaldı" sorusunun cevabı.

Son güncelleme: 2026-08-22

---

## Önce bir geri çekme

İlk raporda **"middleware her istekte iki auth ağ çağrısı yapıyor"** demiştim
(`getUser()` + `getAuthenticatorAssuranceLevel()`). **Bu yanlıştı.**

`node_modules/@supabase/auth-js` kaynağını okudum:
`_getAuthenticatorAssuranceLevel()` jwt argümanı olmadan çağrıldığında
`getSession()` kullanıyor, çerezdeki JWT'yi yerel olarak decode ediyor ve
`session.user.factors` alanına bakıyor. **Ağa çıkmıyor.**

Middleware istek başına **bir** auth ağ çağrısı yapıyor, iki değil. MFA kapısı
ölçülebilir bir maliyet eklemiyor.

---

## Kodla düzeltilenler

### 1. İstemci kurulumu — istek başına onlarca kez

`createClient()` kod tabanında **165 yerde**, `createAdminClient()` **265
yerde** çağrılıyor. İkisi de her çağrıda sıfırdan bir Supabase istemcisi
kuruyordu (GoTrue + Postgrest + Storage + Realtime alt istemcileri).

**Düzeltme** (`src/lib/supabase/server.ts`):
- `createClient` → React `cache()` ile **istek başına tek örnek**
- `createAdminClient` → **lambda ömrü boyunca tek örnek** (tembel kurulum)

**Neden ikisi farklı:** admin istemcisinin oturum durumu yok — kimliği sabit
bir service-role anahtarı, `persistSession` ve `autoRefreshToken` kapalı.
Paylaşmak güvenli. Çerezli istemci ise kullanıcıya özel; o yüzden modül
düzeyinde değil, **istek başına** paylaşılıyor.

**İstekler arası sızıntı riski — kontrol edildi, varsayılmadı.** React'in
`cache()` gövdesi şöyle başlıyor:

```js
var dispatcher = ReactSharedInternals.A;
if (!dispatcher) return fn.apply(null, arguments);
```

Önbellek dispatcher'ın istek başına oluşturduğu köke bağlı. Dispatcher yoksa
hiç önbellekleme yapılmıyor, fonksiyon doğrudan çağrılıyor. Yani en kötü
ihtimalle eski davranış; bir kullanıcının çerezli istemcisinin başka bir
isteğe taşınması mümkün değil.

### 2. Aynı sayfada iki kez çalışan yükleyiciler

Üç sayfa `generateMetadata` ve sayfa gövdesinde **aynı yükleyiciyi iki kez**
çağırıyordu. Sorgular ikiye katlanıyordu:

| Sayfa | Yükleyici | Sorgu (önce → sonra) |
|---|---|---|
| `/teams/[slug]` | `getTeamHub` | 12 × 2 = **24 → 12** |
| `/u/[id]` | `getPublicProfile` | 9 × 2 = **18 → 9** |
| `/programs/hazir/[slug]` | `getReadyProgram` | 3 × 2 = **6 → 3** |

`getTeamHub` ve `getPublicProfile` kullanıcıya özel → React `cache()` (istek
başına). `getReadyProgram` katalog verisi → `unstable_cache` (istekler arası).

### 3. Önbelleklenmemiş katalog okumaları

`listReadyPrograms` ve `getReadyProgram` yalnızca `status = 'published'`
filtreliyor — sonuç her kullanıcı için aynı. Egzersiz kataloğuyla aynı
gerekçe, aynı tag'i (`CATALOG_TAGS.programs`) paylaşıyorlar.

**Geçersiz kılma doğrulandı:** `src/features/admin/features/programs/actions.ts`
içindeki mutasyon yapan **her** action ortak `revalidate()` yardımcısını
çağırıyor, o da `revalidateTag(CATALOG_TAGS.programs)` yapıyor. Betikle tarandı,
atlayan action yok.

**Hata yutma kapatıldı:** ikisi de `?? []` ile sessizce boş dönüyordu.
Önbellekle birlikte bu tehlikeli olurdu — anlık bir sorgu hatası "0 program"
sonucunu bir saat saklardı. Artık `ensure()` throw ediyor; `unstable_cache`
throw eden çağrının sonucunu saklamıyor.

### 4. AI uçlarında zaman aşımı ayarı yoktu

15 AI/ses/koç route'unun **14'ünde** `maxDuration` tanımlı değildi; yalnızca
`ai/dietitian/plan` ayarlıydı. Vercel'in varsayılanı kısa (Fluid Compute
kapalıyken 10–15 sn). `meal-planner` 2500 token, `generate-program` 2000 token
üretiyor — bu sınırı rahat aşarlar ve istek yarıda kesilir.

14 route'a `export const maxDuration = 60;` eklendi.

### 5. `user!.id` — 13 sayfada çökme riski

Analiz sırasında ölçüm yaparken sunucu logunda çıktı:

```
TypeError: Cannot read properties of null (reading 'id')
    at .next/server/app/(app)/dashboard/page.js
```

13 korumalı sayfa `user!.id` yazıyordu — yani "middleware kullanıcıyı garanti
eder" varsayımı. Middleware gerçekten 307 ile yönlendiriyor, ama Next sayfa ile
layout'u **paralel** render ettiği için sayfa yine de çalışıp patlıyordu.
Yanıt doğru gidiyordu, log ve Sentry ise gürültüyle doluyordu.

**Bu bulgunun kaynağı test edildi, varsayılmadı:** değişikliklerim stash'lenip
önceki hâl yeniden build edildi — aynı hata, aynı sayıda. **Önceden vardı,
benim değişikliğimden gelmiyordu.**

Kod tabanında zaten doğru desen vardı (`gamification`, `profile`, `discover`,
`form` sayfaları `if (!user) redirect("/login")` kullanıyor). 13 sayfa ona
hizalandı; istemci bileşeni olan `workouts/new` ise `router.push("/login")`
ile.

**Ölçüldü:** düzeltme öncesi 8 korumalı sayfaya istek → 2 hata satırı.
Sonrası → **0**. Sekizi de temiz 307 veriyor.

---

## Kodla düzeltilemeyenler — senin tarafında

### A. Hız sınırı dağıtık değil

`UPSTASH_REDIS_REST_URL` tanımlı olmadığı için sayaç **lambda başına
in-memory** çalışıyor (`src/lib/security/rate-limit.ts`). 40 lambda varsa
"dakikada 12" pratikte "dakikada 480" oluyor.

**Kod hazır** — `checkRateLimitAsync` Upstash'i zaten destekliyor. Gereken tek
şey iki ortam değişkeni:
```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### B. Tek bölge, tek cron

`vercel.json`: `regions: ["fra1"]`, günde tek cron. Hobby planının sınırı.
Çok bölge ve daha sık cron Pro planı gerektiriyor.

---

## Hâlâ ölçülmemiş olan

Bu düzeltmeler **sorgu sayısını** ve **çökme riskini** azaltıyor; ikisi de kod
okunarak doğrulanabilir. Ama **gecikme, throughput ve kırılma noktası** gerçek
koşu verisi ister.

SAFE / WARNING / CRITICAL eşzamanlı kullanıcı sayıları **hâlâ boş** — ve tahmin
edilerek doldurulmayacak. Gerekenler `loadtest/README.md` bölüm 0'da.
