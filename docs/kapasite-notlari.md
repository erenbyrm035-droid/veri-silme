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

---

## Taban şema artık gerçek (güncelleme)

Yukarıdaki ölçümler `database.types.ts`ten TÜRETİLEN bir taban şema üzerinde
yapılmıştı. O taban artık **üretim veritabanından alınan gerçeğiyle**
değiştirildi.

Aradaki fark küçük değildi:

| | Tipten tahmin | Üretimden gerçek |
|---|---|---|
| İndeks | 6 | **43** |
| CHECK kısıtı | 0 | **8** |
| `profiles` sütunu | 16 | **63** |
| `exercises` sütunu | 16 | **53** |
| `foods` sütunu | 9 | **42** |

**Ölçüm sonuçlarına etkisi:** liderlik darboğazının kök nedeni değişmedi.
Gerçek şemada da `workouts`, `water_logs` ve `nutrition_logs` üzerindeki
indekslerin hepsi `(user_id, tarih)` ile başlıyor — yani kullanıcı filtresi
olmayan sorgu yine sequential scan'e düşüyor. Tarih-öncelikli indeks önerisi
(`0054`) geçerliliğini koruyor.

Yeni öğrenilen: `foods` tablosunda trigram (GIN) indeksleri var, `exercises`
üzerinde `aliases`/`tags` için GIN indeksleri var. Bunlar tipte görünmüyordu.

### Bu sırada bulunan bir migration hatası

`0002_exercises_rich.sql` iki `create type`i tek bir
`do $$ ... exception when duplicate_object` bloğuna koymuştu:

```sql
do $$ begin
  create type exercise_category as enum (...);
  create type alt_relation as enum (...);   -- ← buraya hiç gelinmiyor
exception when duplicate_object then null; end $$;
```

`exercise_category` zaten varsa ilk ifade istisna atıyor, blok orada kopuyor ve
`alt_relation` **hiç yaratılmıyor**. Sonra aynı dosyanın 36. satırı
"type alt_relation does not exist" ile patlıyor.

Temiz bir veritabanında görünmüyordu (ikisi de yoktu). Taban şema
`exercise_category`yi önceden tanımlayınca ortaya çıktı. Her tip kendi bloğuna
ayrıldı. Kod tabanında aynı desenin başka örneği taranıp arandı — yok.

### Şu anki üretim hacmi

Ölçümden sonra üretim veritabanının satır sayıları alındı:

| Tablo | Satır |
|---|---|
| workout_sets | 187 |
| water_logs | 120 |
| workouts | 35 |
| profiles | 12 |
| nutrition_logs | 12 |

Aynı liderlik sorgusu üretimde **5 ms** sürüyor — çünkü tarayacak veri yok.

**Yani liderlik darboğazı bugünün problemi değil.** Ölçüm "şu an bozuk"
demiyor, "şu hacme gelince bozulacak" diyor. `workout_sets` bir milyonu
geçtiğinde yeniden bakılmalı:

```sql
select count(*) as setler,
       case when count(*) > 1000000 then 'ŞİMDİ liderlik toplamasını yap'
            when count(*) >  200000 then 'planla'
            else 'sorun yok' end as durum
from public.workout_sets;
```

### Taban şemayı çıkarma sorgusu

Şema değiştiğinde `supabase/baseline/0000_taban.sql`i tazelemek için Supabase
SQL Editor'de çalıştırılacak sorgu — `pg_dump`a erişim gerekmeden aynı işi
yapar:

```sql
with hedef as (
  select unnest(array[
    'profiles','exercises','workouts','workout_sets','body_measurements',
    'foods','nutrition_logs','water_logs','ai_conversations','ai_messages'
  ]) as t
)
select string_agg(ddl, chr(10)||chr(10) order by sira, ad, alt, ddl) from (
  select 1 as sira, c.relname as ad, 0 as alt,
    'create table public.' || c.relname || ' (' || chr(10) ||
    string_agg('  ' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
      || case when a.attnotnull then ' not null' else '' end
      || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''),
      ',' || chr(10) order by a.attnum) || chr(10) || ');'
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r' and c.relname in (select t from hedef)
  group by c.relname
  union all
  select 2, rel.relname, con.contype::int,
    'alter table public.' || rel.relname || ' add constraint ' || con.conname
    || ' ' || pg_get_constraintdef(con.oid) || ';'
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace
  where n.nspname = 'public' and rel.relname in (select t from hedef)
  union all
  select 3, tablename, 0, indexdef || ';'
  from pg_indexes where schemaname = 'public' and tablename in (select t from hedef)
) x;
```

---

## ÖLÇÜM 2 — 100 / 1.000 / 10.000 kullanıcı (asıl ilgilenilen aralık)

İlk ölçüm 10.000'den başlıyordu; oysa uygulama 12 kullanıcıda. Bu bölüm
**100–10.000 aralığını** kapsıyor ve sorulan asıl soruyu cevaplıyor:
"100–1.000 kişi olunca ne yapacağız?"

**Kurulum:** gerçek taban şema (üretimden alınan) + 54 migration, temiz
PostgreSQL 16. Tarihler baştan **365 güne yayılmış** — ilk ölçümdeki
sıkıştırma hatası tekrarlanmadı. Süreler `explain analyze`in sunucu tarafı
`Execution Time` değeri (psql süreç maliyeti dahil değil).

| Kullanıcı | Set | DB boyutu | Liderlik tüm-zmn | Liderlik haftalık | Liderlik aylık | Kullanıcı sorgusu |
|---|---|---|---|---|---|---|
| **100** | 16.000 | 24 MB | 2,7 ms | 25 ms | 22 ms | 0,28 ms |
| **1.000** | 160.000 | 91 MB | 2,1 ms | 48 ms | 68 ms | 0,25 ms |
| **10.000** | 1.600.000 | 772 MB | 5,5 ms | **1.099 ms** | **3.605 ms** | 0,26 ms |

### Okunacak üç şey

**1. Kullanıcı başına sorgular ölçekten bağımsız.** Dashboard, antrenman
listesi, profil — 100'de de 10.000'de de ~0,25 ms. Bu yollar doğru
indekslenmiş; büyümekten etkilenmiyorlar.

**2. 100–1.000 arasında yapılacak hiçbir şey yok.** En yavaş sorgu 68 ms,
veritabanı 91 MB. Optimizasyon gerekmiyor.

**3. Liderlik 1.000 → 10.000 arasında patlıyor.** Haftalık 48 ms → 1.099 ms
(23×), aylık 68 ms → 3.605 ms (53×). Kök neden yukarıda: kullanıcı filtresiz
tam tablo taraması.

> **İlk ölçümdeki 10.000 satırıyla fark:** orada haftalık 1.716 ms çıkmıştı,
> burada 1.099 ms. Sebep tarih dağılımı — ilkinde loglar 60 güne sıkışıktı,
> pencere verinin daha büyük oranını tutuyordu. **Bu bölümdeki sayılar
> geçerli olanlar**; ilk ölçümün 10.000/50.000 satırları yalnızca yön
> gösterir.

### ASIL DUVAR PERFORMANS DEĞİL — YER

Kullanıcı başına **79 KB** veri birikiyor. Supabase ücretsiz katmanı 500 MB.

```
 1.000 kullanıcı  →   91 MB   rahat
 5.000 kullanıcı  →  ~400 MB  sınıra yaklaşıldı
 6.500 kullanıcı  →  ~500 MB  ÜCRETSİZ KATMAN DOLAR
10.000 kullanıcı  →  772 MB   Pro şart
```

Yani **performans sorunu çıkmadan önce depolama kotası doluyor.** Doğru sıra:

| Eşik | Ne olur | Ne yapılır |
|---|---|---|
| ~6.500 kullanıcı | Ücretsiz katman dolar | Supabase Pro |
| ~10.000 kullanıcı | Liderlik yavaşlar | Dönem puanı toplama tablosu |

10.000 kullanıcıda yeri yiyenler: `workout_sets` 341 MB, `nutrition_logs`
193 MB, `water_logs` 159 MB, `workouts` 57 MB. Üçü de kullanıcı × gün
büyüyor.

> **Sınırlar:** bu sayılar sentetik bir kullanım modeliyle — kullanıcı başına
> 20 antrenman, antrenman başına 8 set, 60 su + 60 beslenme kaydı. Gerçek
> kullanıcılar daha az veya daha çok üretebilir; oran değişirse eşikler de
> kayar. Ayrıca **fotoğraflar (vücut/yemek/postür) Supabase Storage'da, ayrı
> kotada** — bu 500 MB'a dahil değil.

### İzleme sorgusu

Ayda bir Supabase SQL Editor'de:

```sql
select
  (select count(*) from public.profiles)      as kullanici,
  (select count(*) from public.workout_sets)  as setler,
  pg_size_pretty(pg_database_size(current_database())) as db_boyutu,
  case
    when pg_database_size(current_database()) > 400*1024*1024
      then 'Pro plana gecmeyi planla'
    when (select count(*) from public.workout_sets) > 1000000
      then 'liderlik toplamasini yap'
    else 'sorun yok'
  end as durum;
```

400 MB görülürse plan yükseltme; bir milyon set görülürse liderlik toplama
işi. İkisi de o an birer günlük iş — şimdiden yapmanın faydası yok.
