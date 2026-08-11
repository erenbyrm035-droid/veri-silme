# Viva AI Coach — Teknik Denetim Dosyası

> Bu doküman dış teknik denetim için hazırlanmıştır. Rakamlar paket alındığı
> anda kaynak koddan **sayılarak** üretilmiştir, tahmin değildir. Her bölümde
> sayım komutu verilmiştir ki denetçi doğrulayabilsin.
>
> **Paket tarihi:** 2026-07-30
> **Canlı ortam:** https://veri-silme.vercel.app
> **Son commit:** `60875ff`
> **Dal:** `claude/ai-fitness-coach-saas-tc8p5f`

---

## 1. Proje Özeti

**Viva AI Coach** — Türkiye pazarına yönelik, AI destekli fitness ve beslenme
SaaS ürünü. Next.js 15 App Router üzerinde çalışan, Supabase (PostgreSQL + RLS)
tabanlı, PWA olarak kurulabilen tek kod tabanlı web uygulaması.

Ürünün ayırt edici tarafı, sohbet kutusunun arkasındaki **çoklu ajan AI
mimarisi**: kullanıcı tek bir koçla konuşur, arka planda 8 uzman ajandan
gerekli olanlar seçilip paralel çalıştırılır ve çıktıları tek sese indirilir.

---

## 2. Envanter (sayılar)

| Ölçüm | Değer |
|---|---:|
| **Toplam sayfa (`page.tsx`)** | **85** |
| ├─ Kullanıcı uygulaması `(app)` | 32 |
| ├─ Yönetim paneli `(admin)` | 37 |
| ├─ Kimlik doğrulama `(auth)` | 5 |
| ├─ Yasal sayfalar `(legal)` | 8 |
| └─ Kök | 1 |
| **Toplam API route (`route.ts`)** | **24** |
| **Toplam Supabase migration** | **47** |
| Migration dışı SQL (seed + doğrulama) | 15 |
| **Toplam component dosyası (`.tsx`)** | **340** |
| **Export edilen component (yaklaşık)** | **~400** |
| ├─ İstemci component (`"use client"`) | 204 |
| └─ Sunucu component | ~136 |
| Server action dosyası (`"use server"`) | 29 |
| Toplam TS/TSX dosyası | 543 |
| **Toplam satır (`src/`)** | **64.397** |
| Uzman AI ajanı (bağımsız modül) | 8 |
| `src/lib` alt modülü | 24 |

<details>
<summary>Sayım komutları</summary>

```bash
find src/app -name "page.tsx" | wc -l                            # 85
find src/app/api -name "route.ts" | wc -l                        # 24
ls supabase/migrations/*.sql | wc -l                             # 47
find src -name "*.tsx" | wc -l                                   # 340
grep -rl '"use client"' src --include=*.tsx | wc -l              # 204
grep -rl '"use server"' src --include=*.ts | wc -l               # 29
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | tail -1   # 64397
```
</details>

**Component sayısı hakkında:** "~400" rakamı `export function PascalCase` /
`export const PascalCase = forwardRef|memo` kalıplarının sayımıdır. Bir dosyada
birden fazla component olabildiği için dosya sayısından (340) yüksektir. Kesin
rakam için AST tabanlı sayım gerekir; bu bir yaklaşıktır ve öyle okunmalıdır.

---

## 3. Kullanılan Ana Teknolojiler

### Çekirdek
| Katman | Teknoloji |
|---|---|
| Framework | Next.js 15 (App Router, RSC, Server Actions) |
| Dil | TypeScript (strict) |
| UI | React 19, Tailwind CSS, Framer Motion |
| Veritabanı | Supabase — PostgreSQL 16, RLS, Realtime, Storage |
| Auth | Supabase Auth (`@supabase/ssr`, çerez oturumu) + Google/Apple OAuth |
| Doğrulama | Zod |
| Dağıtım | Vercel (fra1), PWA (service worker + manifest) |

### AI Katmanı
| Bileşen | Teknoloji |
|---|---|
| Sağlayıcı soyutlaması | OpenAI + Anthropic, tek `AIProvider` arayüzü ardında |
| Araç çağırma | OpenAI *function calling* + Anthropic *tool use*, ortak sözleşme |
| Çoklu ajan | **Kendi geliştirmemiz** — LangChain vb. harici çerçeve YOK |
| Vision | Yemek fotoğrafı analizi (sağlayıcı vision modelleri) |

### Özel Modüller
| Alan | Teknoloji |
|---|---|
| 3D anatomi | Three.js, React Three Fiber, drei (`.glb`) |
| Form/postür analizi | TensorFlow.js + MoveNet (istemci tarafı poz tahmini) |
| Sesli koç | Web Speech API (varsayılan) + ElevenLabs (opsiyonel, `fetch`) |
| Grafikler | Recharts |
| Ödeme | iyzico (web) + RevenueCat (mobil IAP) |
| Hız sınırlama | Upstash Redis (varsa) → yoksa bellek içi yedek |

Harici AI orkestrasyon çerçevesi bilinçli olarak kullanılmadı: yönlendirme,
paralel çalıştırma, birleştirme ve telemetri elle yazıldı
(`src/lib/ai/agents/`). Gerekçe, yönlendirme maliyetinin tam denetimini elde
tutmak.

---

## 4. Mimari Haritası

```
src/
├── app/
│   ├── (app)/        Kullanıcı uygulaması — 32 sayfa
│   ├── (admin)/      Yönetim paneli — 37 sayfa
│   ├── (auth)/       Giriş/kayıt/şifre — 5 sayfa
│   ├── (legal)/      KVKK, mesafeli satış, iade — 8 sayfa
│   └── api/          24 route (coach, ai/*, billing, cron, teams)
├── components/       Kullanıcı arayüzü component'leri
├── features/admin/   Feature bazlı yönetim modülleri
│                     (queries.ts + actions.ts + schema.ts + ui.tsx deseni)
├── lib/
│   ├── ai/
│   │   ├── agent/        Tek-ajan katmanı (bağlam, hafıza, araç, self-check)
│   │   └── agents/       ÇOKLU AJAN katmanı
│   │       ├── specialists/   8 bağımsız uzman modülü
│   │       ├── router.ts      Yönlendirme (deterministik + LLM yedeği)
│   │       ├── runner.ts      Paralel çalıştırma
│   │       ├── synthesizer.ts Tek sese indirme
│   │       ├── safety.ts      Tıbbi güvenlik kapısı
│   │       ├── memory.ts      8 katmanlı ortak hafıza
│   │       └── registry.ts    Kod varsayılanı + DB yapılandırması birleşimi
│   ├── premium/      Yetkilendirme, plan/limit tanımları
│   ├── security/     Hız sınırlama, action guard
│   └── supabase/     İstemci fabrikaları (RLS'li ve service_role)
├── middleware.ts     Oturum yenileme + rota koruması
└── supabase/
    ├── schema.sql            Temel şema
    ├── migrations/           47 migration (0001 → 0047)
    └── *_dogrulama.sql       Kurulum sonrası doğrulama betikleri
```

### Çoklu ajan akışı (bir kullanıcı mesajı)

```
1. GÜVENLİK ÖN TARAMA   acil semptom → model HİÇ çalıştırılmadan cevap
2. YÖNLENDİRME          deterministik skorlama; belirsizse tek ucuz LLM çağrısı
3. UZMANLAR (PARALEL)   en fazla 3 uzman aynı anda
4. BİRLEŞTİRME          >1 uzman varsa tek sese indirme
                        tek uzman varsa BU ADIM ATLANIR (maliyet tasarrufu)
5. TIBBİ DENETİM        risk sinyali varsa cevap denetlenir
6. TELEMETRİ            her adım `ai_agent_runs`'a yazılır
```

**LLM çağrı maliyeti (mesaj başına):**

| Senaryo | Çağrı |
|---|---:|
| Basit soru, tek uzman | 1 |
| Çok konulu soru, 2-3 uzman | 3-4 (paralel) |
| Anlaşılmayan mesaj | +1 (yönlendirici) |
| Sağlık bağlamı | +1 (denetim) |

---

## 5. Bilinen Teknik Borçlar

Öncelik sırasına göre; her madde kod tabanında sayılarak doğrulandı.

### TB-1 — `createAdminClient` kullanıcı tarafında (YÜKSEK)
**64 dosyada** `createAdminClient` (service_role) kullanılıyor; bunların
**34'ü yönetim paneli dışında** — normal kullanıcı isteklerinde RLS atlanıyor.

Yetkilendirmenin tamamı uygulama katmanına yıkılmış durumda: bir yetki
kontrolü unutulursa veritabanı seviyesinde savunma kalmıyor. Bilinen bir açık
yok, ama tek bir dikkatsiz commit yeterli.

`grep -rl "createAdminClient" src | grep -v "features/admin" | wc -l`

### TB-2 — Kullanıcı tarafında Zod eksikliği (YÜKSEK)
Yönetim panelinde şema doğrulaması tutarlı; kullanıcı tarafında **yalnızca 3
dosyada** Zod var. `profile/actions.ts` 30'dan fazla alanı doğrulamadan yazıyor;
`settings/actions.ts` ham `...payload` yayılımını service_role ile upsert ediyor.

`grep -rl 'from "zod"' src/app src/lib | grep -v admin | wc -l`

### TB-3 — Server action hız sınırı eksikliği (ORTA-YÜKSEK)
**29 server action dosyasından yalnızca 5'i** `guardAction` kullanıyor. Server
action'lar dışarıdan doğrudan POST edilebilir; arayüzdeki düğmeyi devre dışı
bırakmak koruma değildir.

`grep -rl "guardAction" src --include=*.ts | wc -l`

### TB-4 — Component boyutları / `React.memo` yokluğu (ORTA)
Projede **tek bir** `React.memo` var. En büyük dosyalar:

| Dosya | Satır |
|---|---:|
| `lib/database.types.ts` | 1761 *(üretilmiş tip — sorun değil)* |
| `lib/ai/agent/tools.ts` | 967 |
| `components/gamification/GamificationClient.tsx` | **917** |
| `lib/teams/actions.ts` | 766 |
| `app/onboarding/page.tsx` | 745 |
| `features/admin/features/ai-center/ui.tsx` | 717 |
| `components/teams/TeamChat.tsx` | **711** |

`GamificationClient` ve `TeamChat` realtime abonelik taşıyor ve bölünmemiş;
her olayda tüm ağaç yeniden render oluyor.

### TB-5 — `force-dynamic` / önbellek dengesizliği (ORTA)
**71 dosyada** `force-dynamic`, **2 dosyada** `unstable_cache`. Egzersiz
kütüphanesi, anatomi ve hazır programlar önbelleğe alındı; kalan statik içerik
hâlâ her istekte veritabanından çekiliyor.

### TB-6 — Karşılığı olmayan premium özelliği (ORTA)
`FeatureKey` listesinde tanımlı ama hiçbir yerde kapı uygulanmamış:

| Anahtar | Durum |
|---|---|
| `ai_unlimited` | `FREE_LIMITS.aiPerDay` ile **dolaylı** uygulanıyor |
| `unlimited_programs` | `FREE_LIMITS.maxPrograms` ile **dolaylı** |
| `unlimited_diets` | `FREE_LIMITS.maxDiets` ile **dolaylı** |
| `advanced_analytics` | **hiç uygulanmıyor** |

`advanced_analytics` fiyat sayfasında satılıyor ama karşılığı yok. Ya
uygulanmalı ya listeden kaldırılmalı — bu bir tüketici hakkı meselesi.

### TB-7 — İki paralel hafıza sistemi (DÜŞÜK)
`ai_memory.summary` (serbest metin, `slice(-800)` ile kırpılan eski sistem) ve
`ai_facts` (yapılandırılmış yeni sistem) yan yana duruyor. Yeni sistem geriye
dönük uyumluluk için eskisini silmedi; eski sistem bilgi kaybetmeye devam
ediyor ve bir noktada kaldırılmalı.

### TB-8 — Recharts statik import (DÜŞÜK)
**6 dosyada** statik import (~150-200 kB gzip), lazy yüklenmiyor.

### TB-9 — Kalan `<img>` etiketleri (DÜŞÜK)
**11 adet.** Çoğu `blob:`/`data:` URL taşıdığı için `next/image` ile optimize
edilemez (`SmartImage` bunu ayırt ediyor), ama tümü gözden geçirilmeli.

---

## 6. Bilinen TODO'lar

Kod tabanında **5 adet** açık TODO var; hepsi bilinçli bırakılmış entegrasyon
boşlukları:

| Dosya | Satır | İçerik |
|---|---:|---|
| `lib/observability/report-server.ts` | 43 | Sentry `captureException` bağlanacak |
| `lib/billing/provider.ts` | 52, 60, 68 | Stripe iskeleti (iyzico kullanımda; Stripe yedek yol) |
| `lib/push/fcm.ts` | 55 | FCM HTTP v1 gönderimi + başarısız token temizliği |

`grep -rnE "TODO|FIXME|HACK|XXX" src supabase | wc -l`

Bunlar yarım kalmış kod değil, sağlayıcı hesabı gerektirdiği için arayüz
seviyesinde bırakılmış noktalar. Üçü de çağrıldığında sessizce başarısız olmak
yerine yapılandırılmadığını bildiriyor.

---

## 7. Bilinen Performans Sorunları

### P-1 — Çoklu ajan maliyeti (İZLENMELİ)
Mimari tek uzman durumunda tek LLM çağrısı yapacak biçimde tasarlandı, ama çok
konulu sorularda 3-4 çağrıya çıkıyor. `PREMIUM_UNLOCK_ALL=true` env'i açıksa AI
limiti de kalkıyor; ikisi birleşince tek kullanıcı ciddi maliyet üretebilir.

*Denetçi için:* `/admin/ai-center` → Metrikler'de `orchestrator` satırının
çalışma sayısı toplam mesaj sayısına yakınsa yönlendirici kural motoru işini
yapmıyor ve her mesaj fazladan bir çağrıya mal oluyor demektir.

### P-2 — Önbellek dengesizliği
Bkz. TB-5 (71 dinamik / 2 önbellekli).

### P-3 — Recharts bundle yükü
Bkz. TB-8.

### P-4 — Büyük istemci component'leri
`GamificationClient` (917 satır), `TeamChat` (711 satır) — realtime, bölünmemiş.

### P-5 — `React.memo` yokluğu
Tek kullanım; liste ve kart component'lerinde memoizasyon yok.

### P-6 — Ajan bağlamı token bütçesi
Katmanlı hafıza her ajana yalnızca ihtiyacı olan katmanları veriyor (ölçülen
tasarruf ~%40-60). Ancak `memory_limit` varsayılanları (3000-5000 karakter)
**ampirik değil, tahmini** seçildi; gerçek kullanımla kalibre edilmeli.

### P-7 — 365 günlük geçmiş
`agent_snapshot` bir yıllık antrenman geçmişini **aylık toplam** olarak
döndürüyor (ham hali ~100k+ token tutardı). Doğru tasarım, ancak aylık
toplamların üst sınırı yok — çok yıllık kullanıcıda satır sayısı büyür.

---

## 8. Bilinen Güvenlik Notları

### G-1 — RLS kapsamı (İYİ — ama TB-1'e bakınız)
Tüm kullanıcı verisi tabloları RLS altında. Ajan katmanının 8 yeni tablosu da
(`ai_facts`, `ai_goals`, `ai_reports`, `ai_actions`, `ai_agents`,
`ai_agent_prompts`, `ai_agent_runs`, `ai_ab_tests`) dahil.

**Kritik ayrım:** `ai_agents` / `ai_agent_prompts` / `ai_ab_tests` yalnızca
admin'e açık — prompt içerikleri hem işletme sırrı hem de okunabilir olmaları
prompt injection'a zemin hazırlar. `ai_agent_runs` kullanıcıya **kendi**
kayıtlarını gösterir (şeffaflık), admin'e hepsini.

### G-2 — AI aracı yetki sınırları (İYİ)
Araçlar üç risk seviyesine ayrılmış:
- `read` — serbest
- `write` — küçük, geri alınabilir (su kaydı, hedef tanımı)
- `sensitive` — **çalıştırılmaz**, kullanıcı onayına düşer (kalori/makro
  hedefi, program yoğunluğu)

Onay anında argümanlar Zod ile **yeniden** doğrulanıyor. Tüm araçlar RLS'li
oturum istemcisi kullanıyor, `service_role` değil. Her uzman yalnızca kendi
`allowed_tools` listesindeki araçları çağırabiliyor — beslenme uzmanının program
yoğunluğunu değiştirememesi yapılandırma değil, güvenlik sınırıdır.

### G-3 — Tıbbi güvenlik kapısı (İYİ)
İki kademeli:
1. **Deterministik** — acil semptom (göğüs ağrısı, nefes darlığı, bayılma, inme
   belirtileri, kendine zarar), aşırı düşük kalori, hızlı kilo verme vaadi, uzun
   açlık, ilaç dozu, PED önerisi kalıp eşleşmesiyle yakalanır. Modele güvenilmez.
2. **LLM denetimi** — yalnızca risk sinyali varsa çalışır.

Acil semptomda **hiçbir model çalıştırılmadan** 112 yönlendirmesi verilir.

### G-4 — KVKK / AI onayı (İYİ)
`profiles.ai_consent = false` olduğunda ajan anlık görüntüsü isim + hedefe
indirgenir, araç fazı **hiç çalışmaz**, proaktif uyarı üretilmez, rapor
oluşturulmaz. Veri dışa aktarma ve hesap silme `/settings` altında mevcut.

### G-5 — Halüsinasyon koruması (KISMİ)
İki katman: (a) eksik veri prompt'ta açıkça listelenir, (b) cevapta veri olmadan
rakam verilmişse dürüst bir not eklenir.

**Sınır açıkça belirtilmelidir:** Yakalama ağı yalnızca *"veri yokken sayı
verildi"* durumunu tespit eder; *"veri varken yanlış sayı verildi"* durumunu
**tespit etmez** (model birim dönüşümü yapmış olabilir, yanlış alarm üretirdi).
Asıl koruma önleme tarafındadır.

### G-6 — Hız sınırlama (KISMİ)
API route'larında var (`aiRateGuard`, `checkRateLimitAsync`); server
action'larda **eksik** — bkz. TB-3.

### G-7 — Girdi doğrulama (ZAYIF, kullanıcı tarafında)
Bkz. TB-2. **Denetimde öncelikli bakılması gereken yer burasıdır.**

### G-8 — Sır yönetimi
Bu pakette **hiçbir `.env` dosyası yok**; `.vercel/`, `.claude/` ve kimlik
bilgisi taşıyan tüm dosyalar hariç tutuldu. Paketleme sırasında gömülü anahtar
taraması yapıldı (bkz. bölüm 10). Ortam değişkeni **adları** `PRODUCTION.md`
içinde; **değerler** yalnızca Vercel panelinde.

### G-9 — Güvenlik başlıkları
`next.config.ts` içinde CSP, HSTS, X-Frame-Options, Referrer-Policy tanımlı.
Doğrulanması denetime dahil edilmelidir.

---

## 9. Test Durumu (dürüst değerlendirme)

Projede **kurulu bir test çatısı yok** — Jest/Vitest/Playwright
yapılandırılmamış. Bunun yerine iki yöntem kullanıldı:

1. **Yerel PostgreSQL 16 replikası** — `schema.sql` + 47 migration yüklenir,
   RPC'ler gerçek veriyle test edilir, migration'lar iki kez çalıştırılıp
   idempotency doğrulanır. Bu yöntem geliştirme sırasında birden çok gerçek hata
   yakaladı (sütun adı hataları, plpgsql OUT parametre çakışmaları, yönlendirici
   sinyal eşiği hatası).
2. **Saf mantık için tek seferlik betikler** — yönlendirici, hafıza dilimleme,
   güvenlik kalıpları ve form analizi geometrisi için yazıldı, ancak **kalıcı
   test paketi olarak commit edilmedi**.

`supabase/*_dogrulama.sql` dosyaları kurulum sonrası doğrulama betikleridir
(salt okunur, tek sonuç tablosu döndürür).

**Bu, denetimde bulunması beklenen en büyük eksikliktir ve öyle kabul
edilmelidir.** Otomatik regresyon koruması yok; `npm run typecheck` ve
`npm run build` dışında CI'da çalışan kontrol bulunmuyor.

Ayrıca **ESLint yapılandırılmamış** — `next lint` çalıştırıldığında interaktif
kurulum soruyor, yani `eslint.config.*` dosyası bu pakette yok. Bu da bir
eksikliktir.

CI yapılandırması `.github/workflows/ci.yml` içinde ve pakete dahildir;
denetçinin CI'da gerçekte hangi kontrollerin çalıştığını buradan görmesi
beklenir.

---

## 10. Paket Kapsamı

**İçermez:** `node_modules/`, `.next/`, `.git/`, `dist/`, `build/`, `coverage/`,
önbellek dosyaları, log dosyaları, geçici dosyalar, `.env*`, `.vercel/`,
`.claude/`.

**İçerir:** `src/` (app, components, features, lib, hooks, types), `public/`,
`supabase/` (schema + 47 migration + seed + doğrulama betikleri), `docs/`,
`scripts/`, kök yapılandırma dosyaları (`package.json`, `package-lock.json`,
`tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`,
`vercel.json`, `middleware.ts`), `README.md`, `PRODUCTION.md`,
`STORE_CHECKLIST.md` ve bu dosya.

**Bulunmayan, istenen klasörler ve nedenleri:**

| İstenen | Durum |
|---|---|
| `prisma/` | **Yok** — proje Prisma kullanmıyor; DB erişimi Supabase istemcisi + SQL migration'ları üzerinden |
| `eslint.config.*` | **Yok** — ESLint yapılandırılmamış (bkz. bölüm 9) |
| `hooks/`, `contexts/`, `providers/`, `stores/`, `services/`, `utils/` | Kök seviyede ayrı klasör olarak yok; karşılıkları `src/lib/` ve `src/features/` altında modül olarak duruyor |
| `pnpm-lock.yaml` | Yok — proje npm kullanıyor, `package-lock.json` dahil |

---

## 11. Denetçi İçin Öncelikli Bakılacak Yerler

Sınırlı zaman varsa şu sırayla:

1. **`src/app/(app)/profile/actions.ts` ve `settings/actions.ts`** —
   doğrulamasız yazma (TB-2, G-7)
2. **Kullanıcı tarafındaki 34 `createAdminClient` çağrısı** — RLS atlama
   (TB-1, G-1)
3. **`src/lib/ai/agents/safety.ts`** — tıbbi güvenlik kalıpları yeterli mi,
   Türkçe varyasyonlar kaçırılıyor mu (G-3)
4. **`src/lib/ai/agent/tools.ts`** — `sensitive` sınıflandırması doğru mu,
   `write` sayılan bir araç aslında yıkıcı mı (G-2)
5. **`src/lib/ai/agents/router.ts`** — yönlendirme maliyeti; kaç mesaj gereksiz
   yere LLM'e gidiyor (P-1)
6. **`supabase/migrations/0046` ve `0047`** — RLS politikaları ve
   `security definer` fonksiyonlarında `search_path` sabitlemesi
7. **`next.config.ts`** — güvenlik başlıkları (G-9)
8. **Test altyapısının yokluğu** — bölüm 9

---

*Bu belge paketleme anında üretildi. Rakamlar `main` dalından değil, aktif
geliştirme dalından alınmıştır.*
