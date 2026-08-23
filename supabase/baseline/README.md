# Taban şema — neden var, nasıl kullanılır

## Sorun

`supabase/migrations/` altındaki 54 dosya 122 tablo yaratıyor. Ama uygulamanın
çekirdeğindeki **10 tablo hiçbirinde yok**:

```
profiles          exercises        workouts        workout_sets
body_measurements foods            nutrition_logs  water_logs
ai_conversations  ai_messages
```

Bunlar Supabase panelinden elle yaratılmış ve sürüm kontrolüne hiç girmemiş.
`0001_profiles_extend.sql` adından belli: profiles'ı *genişletiyor*, yaratmıyor.

Bir de `public.is_admin(uuid)` fonksiyonu eksik — 0002, 0003, 0011 ve 0012
çağırıyor, hiçbiri yaratmıyor.

## Sonuçları

- Depo tek başına veritabanını kuramıyordu → **staging ortamı yok** (yük
  testinin üretime karşı koşulamamasının asıl sebebi buydu)
- Yeni geliştirici ortamı kurulamıyordu
- Felaket kurtarma tamamen Supabase yedeğine bağlıydı
- Bu 10 tablonun indeksleri ve kısıtları kod incelemesinde görünmüyordu

## Kaynak — üretimden alındı

`0000_taban.sql` **üretim veritabanından** çıkarıldı (2026-08-22, `pg_catalog`
sorgusuyla). Sütun tipleri, ölçekler, varsayılanlar, kısıtlar ve indeksler
üretimde ne ise o.

İlk sürümü `src/lib/database.types.ts`ten türetilmişti. Aradaki fark, tipten
şema tahmin etmenin ne kadar yanıltıcı olduğunu gösteriyor:

| | Tipten tahmin | Üretimden gerçek |
|---|---|---|
| İndeks | 6 | **43** |
| CHECK kısıtı | 0 | **8** |
| `profiles` sütunu | 16 | **63** |
| `exercises` sütunu | 16 | **53** |
| `foods` sütunu | 9 | **42** |

Tipte görünmeyenler: enum'lar (`workout_status`, `meal_type`, `chat_role`,
`exercise_category`), `numeric` ölçekleri, `uuid_generate_v4()` varsayılanı,
trigram/GIN indeksleri, kısmi unique indeksler.

## Doğrulama

Temiz PostgreSQL 16 üzerinde:

```
00_supabase_shim.sql  +  0000_taban.sql  +  54 migration
   → 54/54 temiz uygulandı
   → 131 tablo · 376 indeks · 161 fonksiyon · 208 RLS politikası
```

## Yerel ortam kurmak

```bash
initdb -D ./pgdata -U postgres --auth=trust
pg_ctl -D ./pgdata -o "-p 5433" start
psql -p 5433 -U postgres -f supabase/baseline/00_supabase_shim.sql
psql -p 5433 -U postgres -c "create publication supabase_realtime;"
psql -p 5433 -U postgres -f supabase/baseline/0000_taban.sql
for f in supabase/migrations/*.sql; do psql -p 5433 -U postgres -f "$f"; done
```

`00_supabase_shim.sql` Supabase'in `auth` / `storage` şemalarını taklit eder —
yalnızca migration'ların dokunduğu yüzey kadar. Üretimde gereksizdir.

## Sınırlar

- **Fonksiyon gövdeleri dahil değil.** `is_admin(uuid)` buraya yeniden
  yazıldı (profiles.is_admin okuyor). Üretimdeki gövdesi farklıysa uyuşmaz.
- `foods.brand_id` ve `food_brands`e giden FK burada yok — onu
  `0035_nutrition_pro.sql` ekliyor. Tabanda olsaydı henüz var olmayan bir
  tabloya referans verirdi.
- Enum'ların değer listesi **nihai** hâli (migration'ların eklediği değerler
  dahil), çünkü tablo varsayılanları onlara atıf yapıyor.
- RLS politikaları ve trigger'lar bu dosyada değil — hepsini migration'lar
  kuruyor.

## Tazelemek

Şema değişirse aynı sorguyu tekrar çalıştırıp bu dosyayı güncelleyin:
`docs/kapasite-notlari.md` içindeki "taban şemayı çıkarma sorgusu".
