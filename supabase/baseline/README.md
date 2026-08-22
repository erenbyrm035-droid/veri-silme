# Taban şema — neden var, nasıl kullanılır

## Sorun

`supabase/migrations/` altındaki 53 dosya 122 tablo yaratıyor. Ama uygulamanın
çekirdeğindeki **10 tablo hiçbirinde yok**:

```
profiles          exercises        workouts        workout_sets
body_measurements foods            nutrition_logs  water_logs
ai_conversations  ai_messages
```

Bunlar Supabase panelinden elle yaratılmış ve sürüm kontrolüne hiç girmemiş.
`0001_profiles_extend.sql` adından belli: profiles'ı *genişletiyor*, yaratmıyor.

Ayrıca iki taban nesne daha eksik: `profiles.is_admin` sütunu ve
`public.is_admin(uuid)` fonksiyonu — migration'lar ikisini de çağırıyor,
hiçbiri yaratmıyor.

## Sonuçları

- Depo tek başına veritabanını kuramaz → **staging ortamı yok** (yük testinin
  üretime karşı koşulamamasının asıl sebebi bu)
- Yeni geliştirici ortamı kurulamaz
- Felaket kurtarma tamamen Supabase yedeğine bağlı
- Bu 10 tablonun indeksleri ve kısıtları kod incelemesinde görünmüyor

## Doğrulama

Temiz PostgreSQL 16 üzerinde:

```
0000_taban.sql  +  53 migration  →  53/53 temiz uygulandı
                                     131 tablo · 369 indeks
                                     161 fonksiyon · 208 RLS politikası
```

Yani bu taban migration'larla **uyumlu**. Çalıştırılarak kanıtlandı.

## Yerel ortam kurmak

```bash
initdb -D ./pgdata -U postgres --auth=trust
pg_ctl -D ./pgdata -o "-p 5433" start
psql -p 5433 -U postgres -f supabase/baseline/00_supabase_shim.sql
psql -p 5433 -U postgres -f supabase/baseline/0000_taban.sql
for f in supabase/migrations/*.sql; do psql -p 5433 -U postgres -f "$f"; done
```

## ÜRETİME UYGULAMAYIN

Bu dosya `src/lib/database.types.ts`ten çıkarıldı. Sütun adları ve
null'lanabilirlik oradan geliyor, ama:

- **İndeksler eksik olabilir** — panelden eklenenler tipte görünmüyor
- Sütun tipleri türetildi (numeric ölçeği, text/varchar ayrımı)
- Kısıtlar yalnızca kodun ima ettikleri

Gerçek tabanı üretimden almak ve farkı görmek için:

```bash
pg_dump --schema-only --schema=public "$PROD_DATABASE_URL" > uretim-semasi.sql
diff <(...) uretim-semasi.sql
```

**Doğru kalıcı çözüm:** üretimden alınan bu dump'ı `0000_taban.sql` yerine
koymak. O zaman depo veritabanını gerçekten kurabilir hale gelir.
