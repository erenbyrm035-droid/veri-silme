# 🏋️ Viva AI Coach

Türkiye pazarına yönelik, **yapay zeka destekli kişisel fitness koçu** SaaS uygulaması. Kullanıcılar antrenman, beslenme, kilo değişimi ve fiziksel gelişimlerini tek platformdan takip eder; AI koç yaşlarına, hedeflerine ve geçmiş verilerine göre kişisel tavsiyeler verir.

> MVP sürümü — gelecekte mobil uygulamaya dönüşebilecek sağlam bir mimari üzerine kuruludur.

## ✨ Özellikler

- **Kayıt & Onboarding** — Çok adımlı profil kurulumu (yaş, boy, kilo, hedef, seviye, antrenman sıklığı, ortam). Kalori/protein hedefleri Mifflin-St Jeor formülüyle otomatik hesaplanır.
- **Dashboard** — Bugünkü hedefler (antrenman, su, kalori, protein, adım, uyku) + ilerleme kartları (kilo değişimi, tamamlanan antrenman).
- **AI Fitness Koçu** — Kullanıcının profilini ve son antrenman/kilo verisini bağlam alarak doğal dilde tavsiye veren OpenAI destekli sohbet.
- **Antrenman Takibi** — Antrenman başlat, egzersiz seç, set/tekrar/ağırlık gir, set tamamla, geçmişi görüntüle.
- **Beslenme Takibi** — Türk mutfağı odaklı yiyecek veritabanı, öğün ekleme, günlük kalori/protein/makro takibi, su takibi.
- **Vücut Gelişimi** — Kilo, bel, kol, göğüs ölçümleri + fotoğraf; Recharts ile grafikler.
- **Admin Panel** — Kullanıcı listesi, egzersiz ve yiyecek ekleme.

## 🧱 Teknoloji

| Katman | Teknoloji |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth), `@supabase/ssr` |
| AI | OpenAI API |
| Grafikler | Recharts |
| Deploy | Vercel |

## 🚀 Kurulum

### 1. Bağımlılıklar

```bash
npm install
```

### 2. Supabase projesi

1. [supabase.com](https://supabase.com) üzerinde yeni bir proje oluşturun.
2. **SQL Editor**'de sırasıyla şu dosyaları çalıştırın:
   - `supabase/schema.sql` — tablolar, RLS politikaları, trigger'lar
   - `supabase/seed.sql` — temel yiyecek + egzersiz verisi
   - `supabase/seed/exercises_rich.sql` — zengin egzersiz kütüphanesi (form, hatalar, ipuçları, alternatifler)
   - `supabase/seed/muscles.sql` — anatomi kas kütüphanesi (Anatomy Explorer için)
   - (Mevcut bir veritabanını güncelliyorsanız `supabase/migrations/` altındaki dosyaları sırayla çalıştırın — 0001…0005.)
3. **Storage:** Fotoğraf karşılaştırma için `body-photos` adında **private** bir bucket gerekir. `schema.sql`/migration 0005 bu bucket'ı ve RLS politikalarını otomatik oluşturur; oluşmazsa Storage panelinden private olarak elle ekleyin.
3. **Project Settings → API** bölümünden URL ve anahtarları alın.

### 3. Ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=sk-...        # AI Koç için (opsiyonel; yoksa fallback yanıt döner)
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> **Not:** `OPENAI_API_KEY` tanımlı değilse uygulama çöker değil — AI koç kibar bir bilgilendirme mesajı döndürür.

### 4. Geliştirme sunucusu

```bash
npm run dev
```

`http://localhost:3000` adresini açın.

## 👤 Admin yetkisi verme

Bir kullanıcıyı admin yapmak için Supabase SQL Editor'de:

```sql
update public.profiles set is_admin = true where id = 'KULLANICI_UUID';
```

## ☁️ Vercel'e Deploy

1. Repoyu Vercel'e import edin.
2. Ortam değişkenlerini (`.env.local` içindekiler) Vercel proje ayarlarına ekleyin.
3. Deploy. Next.js 15 otomatik algılanır.

## 🗄️ Veritabanı Şeması

| Tablo | Açıklama |
| --- | --- |
| `profiles` | Kullanıcı profili (auth.users'ı genişletir) |
| `exercises` | Egzersiz kütüphanesi (global) |
| `workouts` / `workout_sets` | Antrenman oturumları ve setleri |
| `foods` | Yiyecek kütüphanesi (Türk mutfağı) |
| `nutrition_logs` | Öğün / besin kayıtları |
| `water_logs` | Su tüketimi |
| `body_measurements` | Vücut ölçümleri |
| `ai_conversations` / `ai_messages` | AI koç sohbet geçmişi |

Tüm kullanıcı tablolarında **Row Level Security** aktiftir; kullanıcılar yalnızca kendi verilerine erişir.

## 📂 Proje Yapısı

```
src/
├── app/
│   ├── (auth)/          # login, register
│   ├── (app)/           # korumalı: dashboard, coach, workouts, nutrition, progress, admin
│   ├── auth/            # callback & signout route'ları
│   ├── onboarding/      # çok adımlı profil kurulumu
│   └── api/coach/       # OpenAI uç noktası
├── components/          # UI + özellik bileşenleri
└── lib/                 # supabase, openai, nutrition, utils, constants, types
supabase/
├── schema.sql          # tablolar + RLS
└── seed.sql            # başlangıç verileri
```

## 📈 Yol Haritası

- [ ] Mobil uygulama (React Native / Expo)
- [ ] Akıllı saat / adım entegrasyonu (Apple Health, Google Fit)
- [ ] AI destekli otomatik antrenman programı üretimi
- [ ] Fotoğraf tabanlı gelişim karşılaştırması
- [ ] Sosyal özellikler ve liderlik tablosu

---

© AI Fitness Coach
