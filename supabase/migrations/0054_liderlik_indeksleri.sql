-- ============================================================================
-- Liderlik tablosu sorgularının taradığı tablolara TARİH-ÖNCELİKLİ indeks.
--
-- SORUN (ölçüldü, tahmin değil — bkz. docs/kapasite-notlari.md):
-- `leaderboard_scores(p_start, p_end)` dönem puanı hesaplarken workouts,
-- workout_sets, water_logs ve nutrition_logs tablolarını KULLANICI FİLTRESİ
-- OLMADAN, yalnızca tarih aralığıyla tarıyor.
--
-- Mevcut indeksler bu erişimi karşılamıyor çünkü hepsi `(user_id, ...)` ile
-- BAŞLIYOR:
--     idx_workouts_user_date       (user_id, workout_date desc)
--     idx_nutrition_user_date      (user_id, log_date desc)
--     idx_water_user_date          (user_id, log_date desc)
-- Sorguda user_id yokken öncü sütun kullanılamaz, planlayıcı sequential scan'e
-- düşüyor. 100.000 kullanıcılık replikada (16M set, 6M log) ölçülen:
--     haftalık  3.570 ms → 1.856 ms   (1,9×)
--     aylık     4.968 ms → 3.476 ms   (1,4×)
--
-- BU TAM ÇÖZÜM DEĞİL. Aylık sorgu indeksle bile 3,5 saniye; bir web isteğinin
-- içinde çalışmamalı. Kalıcı çözüm dönem puanlarını da `user_gamification`
-- gibi ÖNCEDEN toplamak (o yüzden tüm-zamanlar sorgusu 108 ms). Bu migration
-- ara bir kazanç; mimari düzeltme ayrı bir iş.
--
-- CONCURRENTLY KULLANILIYOR: milyonlarca satırlı tabloda normal `create index`
-- yazma kilidi alır ve uygulama o süre boyunca kayıt yazamaz. CONCURRENTLY
-- daha yavaş ama kilitlemiyor.
--
-- DİKKAT: `create index concurrently` transaction bloğu İÇİNDE çalışmaz.
-- Migration çalıştırıcınız dosyayı transaction'a sarıyorsa bu dosyayı
-- Supabase SQL Editor'den elle, tek tek çalıştırın.
-- ============================================================================

create index concurrently if not exists idx_water_logs_date_user
  on public.water_logs (log_date, user_id) include (amount_ml);

create index concurrently if not exists idx_nutrition_logs_date_user
  on public.nutrition_logs (log_date, user_id) include (protein_g);

create index concurrently if not exists idx_workouts_date_completed
  on public.workouts (workout_date, user_id) where status = 'completed';

create index concurrently if not exists idx_workout_sets_workout_completed
  on public.workout_sets (workout_id) include (reps, weight_kg) where completed;
