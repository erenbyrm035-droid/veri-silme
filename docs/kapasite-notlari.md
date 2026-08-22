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

---

## ÖLÇÜM — 10.000 / 50.000 / 100.000 kayıtlı kullanıcı

Bu bölüm **gerçek koşu verisi**. Tahmin yok.

### Nasıl ölçüldü

Bu kapta Docker daemon'ı çalışmıyor, yani Supabase yerel yığını kurulamıyor.
Ama PostgreSQL 16 sunucusu kurulu. Kurulan düzenek:

1. Temiz Postgres 16 kümesi (`shared_buffers=2GB`, 4 çekirdek, 15 GB RAM)
2. Supabase'in `auth` / `storage` şemaları taklit edildi
3. `supabase/baseline/0000_taban.sql` + **53 migration'ın tamamı** uygulandı
   → 131 tablo, 369 indeks, 161 fonksiyon, 208 RLS politikası
4. Sentetik veri: kullanıcı başına 20 antrenman, antrenman başına 8 set,
   60 su + 60 beslenme kaydı; tarihler **365 güne yayılmış** (30 günlük pencere
   verinin %8,4'ünü tutuyor — gerçekçi seçicilik)

100.000 kullanıcıda tablo hacmi: **2M antrenman · 16M set · 3M su · 3M beslenme**.

> **Bu Vercel+Supabase üretimi DEĞİL.** Ağ gecikmesi, PostgREST katmanı,
> bağlantı havuzu ve Supabase'in donanımı burada yok. Ölçülen şey **veritabanı
> sorgularının veri hacmiyle nasıl davrandığı** — ve asıl darboğaz orada.

### Sonuç 1 — Kullanıcı başına sorgular sorunsuz

`explain analyze` ile sunucu tarafı süreleri (100.000 kullanıcıda):

| Sorgu | Süre |
|---|---|
| Kullanıcının son 20 antrenmanı | **0,32 ms** |
| Kullanıcının 30 günlük beslenme kaydı | **0,07 ms** |
| Profil okuma | < 1 ms |
| Bir antrenmanın setleri | < 1 ms |

Bu yollar doğru indekslenmiş ve 100.000 kullanıcıda bile sorun çıkarmıyor.

> Ölçüm aracının kendi maliyeti (psql süreç başlatma) 28 ms; yukarıdaki
> değerler ondan arındırılmış gerçek sunucu süreleri.

### Sonuç 2 — Liderlik tablosu tek darboğaz

`leaderboard_scores()` iki farklı davranıyor:

| Çağrı | 10.000 | 50.000 | 100.000 |
|---|---|---|---|
| **Tüm zamanlar** (`p_start = null`) | 38 ms | 68 ms | **108 ms** |
| **Dönemsel** (haftalık) | 1.716 ms | 3.482 ms | **3.570 ms** |
| **Dönemsel** (aylık) | — | — | **4.968 ms** |

> ⚠️ 10.000 ve 50.000 ölçümleri, tarihlerin 365 güne yayılmasından ÖNCE
> alındı (o sırada veri 60 güne sıkışıktı, pencere daha büyük bir oran
> tutuyordu). Yön doğru ama 100.000 satırıyla birebir kıyaslanamaz.
> **Güvenilir olan 100.000 satırı** — düzeltilmiş dağılımla ölçüldü.

**Neden bu fark:** tüm-zamanlar sorgusu hazır toplanmış `user_gamification`
tablosunu okuyor. Dönemsel sorgu ise her çağrıda `workouts`, `workout_sets`,
`water_logs`, `nutrition_logs` tablolarını **kullanıcı filtresi olmadan**
baştan sona tarayıp yeniden hesaplıyor.

100.000 kullanıcıda 30 günlük pencere için CTE kırılımı:

| CTE | Tablo | Süre |
|---|---|---|
| protein | nutrition_logs (3M) | 3.403 ms |
| su | water_logs (3M) | 1.861 ms |
| hacim | workout_sets (16M) ⋈ workouts | 1.385 ms |

Hepsinde aynı plan: `Parallel Seq Scan`.

### Kök neden — indeksler yanlış sütunla başlıyor

Mevcut indekslerin hepsi `(user_id, tarih)` sırasında:

```
idx_workouts_user_date    (user_id, workout_date desc)
idx_nutrition_user_date   (user_id, log_date desc)
idx_water_user_date       (user_id, log_date desc)
```

Sorguda `user_id` yokken öncü sütun kullanılamaz → sequential scan.

### Düzeltme ve ölçülen kazanç

`supabase/migrations/0054_liderlik_indeksleri.sql` tarih-öncelikli indeksler
ekliyor. Aynı replikada, aynı veriyle, öncesi/sonrası:

| Sorgu | İndekssiz | İndeksli | Kazanç |
|---|---|---|---|
| haftalık | 3.570 ms | **1.856 ms** | 1,9× |
| aylık | 4.968 ms | **3.476 ms** | 1,4× |

**Ama bu yeterli değil.** Aylık sorgu indeksle bile 3,5 saniye. Bir web
isteğinin içinde çalışmamalı; Vercel fonksiyon süresi ve Supabase statement
timeout'u bunu keser.

**Kalıcı çözüm:** dönem puanlarını da önceden toplamak — tıpkı tüm-zamanlar
sorgusunun okuduğu `user_gamification` gibi (108 ms). Bu ayrı bir iş: periyodik
toplama tablosu + tazeleme cron'u. Bu turda YAPILMADI, çünkü şema değişikliği
ve XP kurallarının yeniden üretilmesi gerekiyor.

### Bu sorgu nerelerde çalışıyor

`leaderboard_scores` yalnızca liderlik sayfasında değil — `listTeams()`
(`src/lib/teams/queries.ts`) her takım listesi görüntülemesinde çağırıyor.
Yani Takımlar sayfası da aynı maliyeti ödüyor.

---

## Ölçülemeyen kısım — hâlâ duruyor

Yukarıdaki veri **veritabanı katmanı** için gerçek. Ama şunlar hâlâ ölçülmedi
ve bu ortamda ölçülemez:

- Eşzamanlı kullanıcı altında uçtan uca gecikme (Vercel + PostgREST + ağ)
- Supabase bağlantı tavanı ve DB CPU'su
- Vercel fonksiyon süresi ve soğuk başlangıç
- AI uçlarının gerçek gecikmesi ve token maliyeti

**SAFE / WARNING / CRITICAL eşzamanlı kullanıcı sayıları hâlâ boş.** Onlar
gerçek altyapıda koşu ister; gerekenler `loadtest/README.md` bölüm 0'da.
