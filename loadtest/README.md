# Viva — load test koşum takımı

Bu dizin **uygulama kodunun parçası değil**. `next build`e girmez, `src/`
altındaki hiçbir dosyaya dokunmaz. Amacı tek: Viva'nın kapasitesini
**ölçmek**, tahmin etmemek.

Mimari analiz ve kademe planı: bu dizinin dışında, sohbetteki plan belgesinde.

---

## 0. Önce oku — bu takım ÜRETİM veritabanına yazar

Hedef `https://veri-silme.vercel.app` ve arkasındaki üretim Supabase projesi.
Gerçek kayıtlı kullanıcı olmadığı teyit edildiği için bu kabul edildi. Yine de:

1. **Yedek al.** Supabase → Database → Backups → manuel yedek. İsteğe bağlı değil.
2. Her betik `LOADTEST_ONAY=evet` ister. Bayrak kazara çalıştırmaya karşı.
3. **Faz 6 (temizlik) atlanamaz.** İşin bittiğinin kanıtı rapor değil,
   veritabanının temiz olması.

---

## 1. Kurulum

```bash
# k6 (Debian/Ubuntu)
sudo gpg -k && sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

Ortam değişkenleri (kabuğa `export` et, dosyaya yazma):

| Değişken | Nereden |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | aynı ekran → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | aynı ekran → service_role |
| `TABAN` | `https://veri-silme.vercel.app` |
| `VERCEL_TOKEN` | Vercel → Settings → Tokens (okuma yeter) |
| `VERCEL_PROJE` | `veri-silme` |

---

## 2. Sıra

### 2.1 Duman testi — 5 kullanıcı, silmesi doğrulanır

500'e çıkmadan önce döngünün çalıştığı **kanıtlanır**:

```bash
LOADTEST_ONAY=evet LOADTEST_KULLANICI=5 node loadtest/seed.mjs
# çıktı bir RUN kimliği ve temizlik komutu basar — not et
LOADTEST_ONAY=evet LOADTEST_RUN=<runId> node loadtest/teardown.mjs
```

`teardown` "damgalı test kullanıcısı kalmadı" demeden **hiçbir yere geçilmez**.

### 2.2 Havuzu kur

```bash
LOADTEST_ONAY=evet LOADTEST_KULLANICI=500 node loadtest/seed.mjs
```

### 2.3 Kademeyi koş

Kademeler **ayrı ayrı**, aralarında 10 dk soğumayla. Her kademeden önce ve
sonra Supabase metriği alınır:

```bash
export RUN=<runId>
LOADTEST_RUN=$RUN node loadtest/collect/supabase.mjs onceki

k6 run -e KADEME=100 -e TABAN=$TABAN -e RUN=$RUN \
       -e SUPABASE_URL=$SUPABASE_URL -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
       loadtest/scenarios/kademe.js

LOADTEST_RUN=$RUN node loadtest/collect/supabase.mjs sonraki
VERCEL_TOKEN=$VERCEL_TOKEN VERCEL_PROJE=$VERCEL_PROJE LOADTEST_RUN=$RUN \
  node loadtest/collect/vercel.mjs
```

Kademeler: `100 → 250 → 500 → 1000 → 2500 → 5000`.
**500'ün üstü tek makineden üretilemez** — dağıtık üreteç gerekir.

### 2.4 AI mikro-testi (bir kez, ana koşulardan ayrı)

```bash
LOADTEST_RUN=$RUN TABAN=$TABAN node loadtest/ai-mikro.mjs
```

Bastığı iki zaman damgası arasını OpenAI → Usage ekranından oku; token
sayısı oradan gelir (sebebi aşağıda).

### 2.5 Temizlik — atlanamaz

```bash
LOADTEST_ONAY=evet LOADTEST_RUN=$RUN node loadtest/teardown.mjs
```

Sonra Supabase Storage'da `body-photos` / `meal-photos` bucket'larına bak:
AI akışları görsel yüklediyse dosyalar cascade ile gitmez.

---

## 3. Durdurma kuralı

Şunlardan biri olursa kademe **anında** durdurulur, üst kademeye çıkılmaz:

- hata oranı %5'i aşarsa
- 5xx yanıtları 60 sn sürerse
- Supabase CPU %90'ı 60 sn aşarsa
- Vercel ya da Supabase'den kota/kötüye kullanım uyarısı gelirse

k6 eşiği aşınca koşuyu **kesmez** — kırılma eğrisini görebilmek için veri
sonuna kadar toplanır. Durdurma kararı insanda.

---

## 4. Bu takımın ölçemedikleri (ve nedenleri)

Rapora tahmin yazılmayacağı için sınırlar burada açıkça duruyor.

### 4.1 AI token kullanımı — kodda ölçüm yok

- `ai_usage` tablosu var (`supabase/migrations/0019_ai_coach.sql:49`), ama
  **yalnızca `/api/coach`** ona yazıyor; diğer 13 AI route'u hiçbir token
  kaydı tutmuyor.
- Yazdığı sayı gerçek değil: `src/app/api/coach/route.ts:256` `estTokens()`
  ile **tahmin** ediyor. OpenAI'ın döndürdüğü `usage` alanı
  `src/lib/ai/openai.ts` içinde hiç okunmuyor.

→ Token sayısı OpenAI panelinden, `ai-mikro.mjs`'in bastığı zaman
penceresine bakılarak okunur. Bunu kod içinden ölçmek istiyorsak ayrı bir
iş: sağlayıcı katmanının `usage` alanını yüzeye çıkarması gerekir.

### 4.2 Vercel function duration P95 — Hobby'de API yok

`collect/vercel.mjs` deployment kimliğini ve çalışma zamanı loglarını çeker.
Toplu P50/P95/P99 function duration Vercel Observability'de ve ücretli
planlarda. Hobby'deysek bu sayı **panelden okunup rapora "panelden okundu,
şu tarih" notuyla** girilir.

### 4.3 Supabase CPU/bağlantı — Free katmanda uç kapalı

`collect/supabase.mjs` Prometheus ucunu kullanır; Free'de 401/404 döner ve
betik bunu ekrana yazıp 2 ile çıkar. O durumda Supabase paneli → Reports →
Database'den elle okunur.

### 4.4 "Set tamamlama"nın Vercel süresi diye bir şey yok

Bu bir eksik değil, mimari tespit. `src/components/workout/WorkoutEngine.tsx`
tarayıcı istemcisiyle `workout_sets`, `personal_records` ve `workouts`
yazmalarını **doğrudan PostgREST'e** yolluyor. Bu akış Vercel'e hiç uğramaz;
dolayısıyla uygulamanın hız sınırı katmanına da uğramaz. Takım da aynı yolu
kullanıyor — gerçek istemciyi taklit etmeyen bir test, gerçek yükü ölçmez.

### 4.5 Hız sınırı, Upstash bağlanmadan anlamsız

`src/lib/security/rate-limit.ts:37` — `UPSTASH_REDIS_REST_URL` yoksa sayaç
lambda başına in-memory. Vercel'de N lambda varsa efektif sınır N × limit
olur. Upstash bağlanmadan ölçülen 429 oranı gerçeği yansıtmaz.
Kod değişikliği gerekmiyor; iki ortam değişkeni yeterli.

---

## 5. Dosyalar

| Dosya | İş |
|---|---|
| `config.mjs` | ortak ayar, onay bayrağı, damga |
| `seed.mjs` | test kullanıcı havuzu + oturum çerezleri |
| `teardown.mjs` | **silme** — cascade etmeyen tablolar önce |
| `flows/akislar.js` | 12 akış, ağırlıklarıyla |
| `scenarios/kademe.js` | k6 giriş noktası, rampa ve eşikler |
| `ai-mikro.mjs` | AI gecikme profili (seri, düşük hacim) |
| `collect/supabase.mjs` | DB metrikleri (öncesi/sonrası) |
| `collect/vercel.mjs` | deployment kimliği + loglar |
| `rapor/` | ham çıktılar — repoya girmez |

Rapordaki her sayının kaynağı `rapor/` altındaki ham dosyada durur.
Kaynağı gösterilemeyen sayı rapora girmez.
