-- ===========================================================================
-- WORKOUT ENGINE — AŞAMA 1 DOĞRULAMA
--
-- SALT OKUNUR. Tek sonuç tablosu döner (Supabase SQL Editor son sorguyu
-- gösterir, bu yüzden tek sorgu).
--
-- Önce migration 0050'i çalıştır, sonra bunu.
-- ===========================================================================

with

kontroller as (

  -- 1) Yeni sütunlar geldi mi
  select 1 as sira, 'Şema' as grup, 'exercises.aliases' as kontrol,
         exists (select 1 from information_schema.columns
                  where table_name='exercises' and column_name='aliases') as ok,
         'migration 0050 çalışmamış' as hata
  union all
  select 1, 'Şema', 'exercises.video_slug',
         exists (select 1 from information_schema.columns
                  where table_name='exercises' and column_name='video_slug'),
         'migration 0050 çalışmamış'
  union all
  select 1, 'Şema', 'workout_sets RIR/RPE/hedef tekrar',
         (select count(*) from information_schema.columns
           where table_name='workout_sets'
             and column_name in ('target_reps','rir','rpe','rest_sec','notes')) = 5,
         'set takibi için gereken sütunlar eksik'

  -- 2) İsim standardizasyonu
  union all
  select 2, 'İsimler', 'her egzersizin standart İngilizce adı var',
         not exists (select 1 from public.exercises
                      where coalesce(english_name,'') = ''),
         'english_name boş kayıt var — arayüz Türkçe isme düşer'
  union all
  select 2, 'İsimler', 'english_name içinde Türkçe kalıntı yok',
         not exists (select 1 from public.exercises
                      where english_name ~ '[çğıöşüÇĞİÖŞÜ]'),
         'kelime kelime çeviri kalıntısı var (ör. "Makine Hip Abduction")'
  union all
  select 2, 'İsimler', 'video_slug tüm kayıtlarda dolu',
         not exists (select 1 from public.exercises where video_slug is null),
         'video dosya adı standardı kurulamaz'
  union all
  select 2, 'İsimler', 'alias tanımlı hareketler var',
         exists (select 1 from public.exercises where cardinality(aliases) > 0),
         'alias yok — kullanıcı "RDL" arayınca sonuç bulamaz'

  -- 3) GEÇMİŞ VERİ KORUNDU MU — bu işin en kritik kontrolü
  union all
  select 3, 'Geçmiş veri', 'exercises.name değişmedi (yedekle birebir)',
         not exists (select 1 from public.exercises e
                      join public.exercises_name_backup b on b.id = e.id
                     where e.name is distinct from b.name),
         'ACİL: name değişmiş — workout_sets ve personal_records kopar'
  union all
  select 3, 'Geçmiş veri', 'yedek tablosu dolu',
         (select count(*) from public.exercises_name_backup) > 0,
         'geri dönüş imkânsız'
  union all
  select 3, 'Geçmiş veri', 'her workout_set egzersize çözülebiliyor',
         not exists (
           select 1 from public.workout_sets ws
            where ws.exercise_id is not null
              and not exists (select 1 from public.exercises e where e.id = ws.exercise_id)),
         'kopuk exercise_id var — geçmiş sette isim gösterilemez'
  union all
  select 3, 'Geçmiş veri', 'PR kayıtları yerinde',
         not exists (
           select 1 from public.personal_records pr
            where pr.exercise_id is not null
              and not exists (select 1 from public.exercises e where e.id = pr.exercise_id)),
         'kopuk PR kaydı var'

  -- 4) Arama indeksleri
  union all
  select 4, 'Arama', 'english_name indeksi',
         exists (select 1 from pg_indexes where indexname = 'idx_exercises_english_name'),
         'isim araması yavaş çalışır'
  union all
  select 4, 'Arama', 'aliases GIN indeksi',
         exists (select 1 from pg_indexes where indexname = 'idx_exercises_aliases'),
         'alias araması yavaş çalışır'
)

select
  case when k.ok then '✅ GEÇTİ' else '❌ KALDI' end as durum,
  k.grup,
  k.kontrol,
  case when k.ok then '' else k.hata end as aciklama
from kontroller k

union all

select
  case when (select bool_and(ok) from kontroller) then '🎉 TÜMÜ GEÇTİ' else '⛔ SORUN VAR' end,
  'ÖZET',
  (select count(*) filter (where ok) from kontroller)::text || ' / ' ||
  (select count(*) from kontroller)::text || ' kontrol geçti',
  case when (select bool_and(ok) from kontroller)
       then 'İsimler standart, geçmiş veri korunmuş, motor şeması hazır.'
       else 'Yukarıdaki KALDI satırı neyin eksik olduğunu söylüyor.' end

order by 1 desc, 2, 3;
