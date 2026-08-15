# Güvenlik Notları

Bu dosya, **bilerek açık bırakılan** güvenlik bulgularını ve gerekçelerini
tutar. Amaç: altı ay sonra "bu neden kapatılmamış?" sorusuna kod arkeolojisi
yapmadan cevap verebilmek.

Son güncelleme: 2026-08-14 · `npm audit` anlık durumu: **10 bulgu (4 orta, 6 yüksek)**

---

## Kapatılanlar

### Next.js — 8 açık (3 yüksek) · KAPANDI

`next@15.5.20` sekiz advisory taşıyordu. Uygulama etkilenen yüzeyleri
doğrudan kullanıyor: 31 `"use server"` dosyasıyla tamamen Server Actions
üzerine kurulu.

| Açık | Şiddet |
|---|---|
| App Router + Server Actions üzerinden DoS ([GHSA-m99w-x7hq-7vfj](https://github.com/advisories/GHSA-m99w-x7hq-7vfj)) | yüksek |
| Rewrite'larda SSRF ([GHSA-p9j2-gv94-2wf4](https://github.com/advisories/GHSA-p9j2-gv94-2wf4)) | yüksek |
| Custom server'da Server Action SSRF ([GHSA-89xv-2m56-2m9x](https://github.com/advisories/GHSA-89xv-2m56-2m9x)) | yüksek |
| Gövdeli isteklerde cache karışması (2 kayıt) | orta |
| İç Server Function uçlarının kimliksiz ifşası | orta |
| Image Optimization API'de SVG ile DoS | orta |
| Edge runtime'da sınırsız Server Action yükü | orta |

**Çözüm:** `15.5.20 → 15.5.23`. Yama 15.5.21'de çıktığı için 15.x hattında
kalındı; **Next 16'ya major geçiş gerekmedi**.

> `npm audit` çıktısında `next` hâlâ görünüyor — ama artık kendi advisory'si
> yüzünden değil. `via` listesi yalnızca `["postcss", "sharp"]` zincirini
> içeriyor (aşağıya bakın). Sayının değişmemesine aldanmayın, içerik değişti.

---

## Bilerek açık bırakılanlar

### 1. `postcss` ve `sharp` — Next'in alt bağımlılıkları

| | |
|---|---|
| Şiddet | yüksek |
| Zincir | `next → postcss`, `next → sharp` |
| npm'in önerdiği düzeltme | `next@16.3.1` — **major sürüm** |

**Neden kapatılmadı:** tek çözüm Next 16'ya geçmek. Next 16 hem App Router
API'sinde kırıcı değişiklikler taşıyor hem de `next lint`i kaldırıyor
(bkz. `.eslintrc.js` içindeki geçiş notu). Bu, güvenlik yamasının yanına
sıkıştırılacak bir iş değil; kendi turunu hak ediyor.

**Risk değerlendirmesi:** ikisi de build zamanı / görsel işleme katmanında.
`postcss` açıkları saldırganın kontrolündeki CSS dosyası gerektiriyor —
bizde CSS derleme zamanında ve depodan geliyor, kullanıcı CSS yüklemiyor.
`sharp`/libvips açıkları kötü niyetli görsel işlemeyi gerektiriyor; Vercel'de
görsel optimizasyonu Vercel'in kendi altyapısında çalışıyor.

**İzleme:** Next 16 geçişi ayrı bir iş olarak planlanmalı. Dependabot'un
`next-cekirdek` grubu major PR açtığında değerlendirilecek.

---

### 2. `iyzipay` zinciri — 4 bulgu

| | |
|---|---|
| Şiddet | orta |
| Paketler | `postman-request`, `qs`, `uuid`, `ip-address` |
| Zincir | `iyzipay → postman-request → {qs, uuid}` ve `→ socks-proxy-agent → socks → ip-address` |
| npm'in önerdiği düzeltme | `iyzipay@2.0.67` — yani **2.0.69'dan geriye** |

**Neden kapatılmadı:** kullanıcı kararı. Tek "düzeltme" ödeme kütüphanesini
iki yama sürümü geriletmek. Çalışan bir ödeme entegrasyonunu orta şiddetli,
geçişli bir bulgu için geriye almak; kazanandan çok kaybettiren bir takas.
Zafiyetler bizim çağırdığımız yüzeyde değil, iyzipay'in kendi HTTP
istemcisinin alt bağımlılıklarında.

**İzleme:** iyzipay bu zinciri güncelleyen bir sürüm çıkardığında yükseltilip
`npm audit` yeniden çalıştırılacak. Dependabot yapılandırmasında `iyzipay`
gruplardan **dışlandı** — otomatik yükseltilmemeli, ödeme akışı elle test
edilerek geçilmeli (`docs/DOMAIN-SONRASI-YAPILACAKLAR.md` iyzico bölümü).

---

### 3. `js-yaml` ve `brace-expansion` — geliştirme zinciri

| | |
|---|---|
| Şiddet | yüksek |
| Zincir | `eslint@8 → js-yaml`, `eslint-config-next → @typescript-eslint/* → minimatch → brace-expansion` |

**Neden kapatılmadı:** ikisi de **yalnızca geliştirme/CI** zincirinde;
üretim paketine girmiyor. Kalıcı çözüm ESLint 9'a geçmek, o da `next lint`
kaldırıldığında (Next 16) zaten yapılacak. İkisini aynı turda yapmak doğru.

---

## Hız sınırı politikası

| Uç | Sınır | Not |
|---|---|---|
| AI uçları (14 route) | Free: günlük kota · **herkes: 12/dk patlama** | `src/lib/security/ai-guard.ts` |
| `billing/play/verify` | 10/dk | Kotalı Google Play API'sine gidiyor |
| `nutrition/barcode` | 60/dk | Kamerayla tarama hızlı istek üretir |
| `api/log` | 30/dk | Log spam'i |
| `voice/tts` | route içinde | Ses üretimi ücretli |
| Yazma server action'ları | `post`/`reaction`/`sensitive` profilleri | `src/lib/security/action-guard.ts` |
| **Ödeme webhook'ları** | **YOK — bilerek** | Aşağıya bakın |

**Webhook istisnası:** `billing/webhook`, `billing/revenuecat`,
`billing/iyzico/callback` uçlarını çağıran kullanıcı değil, ödeme
sağlayıcısının sunucusu. IP başına sınır meşru bir ödeme bildirimini
düşürebilir — kullanıcının parası gider, üyeliği açılmaz. Koruma başka
katmanda: imza/kimlik doğrulaması ve `billing_events.event_id` ile
idempotency (aynı olay iki kez işlenmez).

**Ölçeklenme notu:** hız sınırı `UPSTASH_REDIS_REST_URL` tanımlıysa dağıtık,
değilse instance başına in-memory çalışıyor (`src/lib/security/rate-limit.ts`).
Vercel'de çok lambda olduğunda in-memory sayaç gerçek sınırdan gevşek davranır.
Trafik arttığında Upstash bağlanmalı — kod değişikliği gerekmiyor, yalnızca
iki ortam değişkeni.

---

## Denetimi tekrarlamak

```bash
npm audit                     # özet
npm audit --json | jq '.vulnerabilities | keys'   # paket listesi
```

Yeni bir bulgu çıkarsa: kapatılabiliyorsa kapatın; kapatılamıyorsa **bu
dosyaya gerekçesiyle yazın**. Sessizce görmezden gelinen bir bulgu, altı ay
sonra kimsenin hatırlamadığı bir borç olur.
