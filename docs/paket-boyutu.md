# Paket Boyutu — Ölçüm ve Durum

Ölçüm tarihi: 2026-08-15 · Next.js 15.5.23

```bash
npm run analyze     # → .next/analyze/{client,nodejs,edge}.html
npm run build       # rota bazlı özet tabloyu basar
```

`ANALYZE` tanımlı değilken analizör devre dışı; normal build'i yavaşlatmaz.

---

## Bulgu: ek bir optimizasyon GEREKMİYOR

Ölçmeden "iyileştirme" yapmamak için önce baktık. Sonuç iyi:

| Ölçüt | Değer |
|---|---|
| Tüm sayfalarda paylaşılan JS | **103 kB** |
| En ağır rota (`/progress`) | 292 kB ilk yük |
| Tipik uygulama rotası | 220–250 kB |

En büyük 5 rota:

| Rota | Sayfa | İlk yük |
|---|---|---|
| `/progress` | 12.1 kB | 292 kB |
| `/teams/[slug]` | 34.1 kB | 267 kB |
| `/nutrition/coach` | 27.7 kB | 246 kB |
| `/posture` | 19.1 kB | 245 kB |
| `/feed` | 7.44 kB | 240 kB |

### Neden bu kadar iyi: ağır kütüphaneler zaten tembel yükleniyor

Projede boyutu domine edebilecek dört kütüphane var:

| Kütüphane | Nerede | Durum |
|---|---|---|
| `three` + `@react-three/*` | 3B anatomi modeli | `dynamic()` arkasında |
| `@tensorflow/tfjs-*` + pose-detection | Postür/form analizi | `dynamic()` arkasında |
| `recharts` | Grafikler | `dynamic()` arkasında |
| `framer-motion` | Animasyonlar | paylaşılan chunk'ta |

Kod tabanında **15 `dynamic()` çağrısı** var ve ağır bileşenler tutarlı bir
desenle ayrılmış: `X.tsx` ince bir sarmalayıcı, gerçek kod `X.impl.tsx`
içinde ve `ssr: false` ile ayrı chunk'a düşüyor. Örnek:
`src/components/workout/VolumeChart.tsx`.

Bu yüzden 3B modeli hiç açmayan bir kullanıcı `three`'yi indirmiyor.

---

## Ne zaman tekrar bakılmalı

- Yeni bir ağır bağımlılık eklenirse (harita, video düzenleme, yeni ML modeli)
- Paylaşılan chunk 103 kB'ı belirgin şekilde aşarsa
- Lighthouse performans puanı 90'ın altına düşerse (STORE_CHECKLIST madde 47)

Yeni ağır bir bileşen eklerken mevcut deseni izleyin: gerçek kodu `.impl.tsx`
dosyasına koyun, `dynamic()` ile sarın, `loading` iskeletini unutmayın.

---

## Lighthouse notu

Checklist'teki Lighthouse ≥ 90 doğrulaması (madde 47) **canlı site üzerinde**
yapılmalı; yerel build'de ölçülen değer gerçek ağ koşullarını yansıtmaz.
Domain bağlandıktan sonra PageSpeed Insights ile ölçülmeli.
