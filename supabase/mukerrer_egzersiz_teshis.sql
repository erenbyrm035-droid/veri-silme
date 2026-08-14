-- ============================================================================
-- MÜKERRER EGZERSİZ TEŞHİSİ — SALT OKUNUR
--
-- Bu dosya HİÇBİR ŞEYİ DEĞİŞTİRMEZ. Sadece okur ve raporlar.
--
-- NEDEN OTOMATİK BİRLEŞTİRME YOK:
--   `workout_sets.exercise_name` ve `personal_records.exercise_name` egzersiz
--   adının KOPYASINI saklıyor (egzersiz silinse bile geçmiş isimsiz kalmasın
--   diye). Üstelik personal_records'ta `unique (user_id, exercise_name)`
--   kısıtı var. İki kaydı körlemesine birleştirmek:
--     - kullanıcıların antrenman geçmişindeki isimleri bozar,
--     - aynı kullanıcıda iki rekor aynı isme düşerse unique kısıtını ihlal
--       edip migration'ı yarıda bırakır,
--     - hangi kaydın "doğru" olduğu bilgisi kodda değil, veride.
--
-- DOĞRU SIRA:
--   1) Bu dosyayı çalıştır, çıktıyı OKU.
--   2) Her çift için hangisinin kalacağına KARAR VER (referans sayısına ve
--      içerik zenginliğine bakarak).
--   3) `mukerrer_egzersiz_birlestir.sql` şablonunu o kararlarla doldurup
--      çalıştır.
--
-- Kullanım: Supabase SQL Editor'e yapıştır ve çalıştır. Beş ayrı sonuç
-- tablosu döner; her birinin başında hangi bölüm olduğunu söyleyen bir
-- satır var (psql'e özel \echo kullanılmadı, tarayıcıdaki editörde de
-- çalışsın diye).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) AYNI İSİMLİ KAYITLAR
--    Standart isim (english_name) ya da iç isim (name) aynı olan gruplar.
--    Karşılaştırma büyük/küçük harf ve baştaki/sondaki boşluklardan bağımsız.
-- ---------------------------------------------------------------------------
select '=== 1) Mükerrer isim grupları ===' as bolum;

with normalize as (
  select
    id,
    name,
    english_name,
    lower(btrim(coalesce(nullif(btrim(english_name), ''), name))) as anahtar
  from public.exercises
)
select
  anahtar                                as normalize_isim,
  count(*)                               as kayit_sayisi,
  array_agg(id order by id)              as exercise_idler,
  array_agg(coalesce(english_name, name) order by id) as gosterilen_isimler
from normalize
group by anahtar
having count(*) > 1
order by count(*) desc, anahtar;

-- ---------------------------------------------------------------------------
-- 2) HER MÜKERRER KAYDIN REFERANS AĞIRLIĞI
--    Hangisini silmenin daha pahalı olduğunu gösterir. Karar bu tabloya
--    bakılarak verilmeli: referansı çok olan kayıt KALMALI.
-- ---------------------------------------------------------------------------
select '=== 2) Mükerrer kayıtların referans sayıları ===' as bolum;

with normalize as (
  select
    id,
    name,
    english_name,
    lower(btrim(coalesce(nullif(btrim(english_name), ''), name))) as anahtar
  from public.exercises
),
mukerrer as (
  select anahtar from normalize group by anahtar having count(*) > 1
)
select
  n.anahtar                                          as normalize_isim,
  n.id                                               as exercise_id,
  coalesce(n.english_name, n.name)                   as gosterilen_isim,
  n.name                                             as ic_isim,

  -- Kullanıcı verisi (KAYBEDİLEMEZ)
  (select count(*) from public.workout_sets     ws where ws.exercise_id = n.id) as workout_sets,
  (select count(*) from public.personal_records pr where pr.exercise_id = n.id) as personal_records,
  (select count(*) from public.favorites        f  where f.exercise_id  = n.id) as favoriler,
  (select count(*) from public.workout_events   we where we.exercise_id = n.id) as analitik_olay,

  -- İçerik/katalog verisi (yeniden üretilebilir ama emek)
  (select count(*) from public.exercise_muscles       em where em.exercise_id = n.id) as kas_eslesme,
  (select count(*) from public.exercise_media         xm where xm.exercise_id = n.id) as medya,
  (select count(*) from public.exercise_media_set     ms where ms.exercise_id = n.id) as medya_set,
  (select count(*) from public.animation_mapping      am where am.exercise_id = n.id) as animasyon,
  (select count(*) from public.workout_program_exercises wpe where wpe.exercise_id = n.id) as programlarda,
  (select count(*) from public.corrective_exercises   ce where ce.exercise_id = n.id) as duzeltici,
  (select count(*) from public.exercise_relations     er where er.exercise_id = n.id or er.related_id = n.id) as iliskiler,
  (select count(*) from public.exercise_alternatives  ea where ea.exercise_id = n.id or ea.alt_exercise_id = n.id) as alternatifler
from normalize n
join mukerrer m on m.anahtar = n.anahtar
order by n.anahtar, workout_sets desc, personal_records desc;

-- ---------------------------------------------------------------------------
-- 3) İSİM KOPYALARININ DURUMU
--    workout_sets ve personal_records isim kopyası tutuyor. Birleştirme
--    sırasında bu metinlerin de güncellenmesi gerekir; aksi halde geçmişte
--    eski isim görünmeye devam eder.
-- ---------------------------------------------------------------------------
select '=== 3) Denormalize isim kopyaları ===' as bolum;

with normalize as (
  select id, name, english_name,
         lower(btrim(coalesce(nullif(btrim(english_name), ''), name))) as anahtar
  from public.exercises
),
mukerrer as (
  select anahtar from normalize group by anahtar having count(*) > 1
)
select
  'workout_sets' as tablo,
  ws.exercise_name,
  count(*)       as satir,
  count(distinct ws.exercise_id) as farkli_exercise_id
from public.workout_sets ws
join normalize n on n.id = ws.exercise_id
join mukerrer m on m.anahtar = n.anahtar
group by ws.exercise_name

union all

select
  'personal_records',
  pr.exercise_name,
  count(*),
  count(distinct pr.exercise_id)
from public.personal_records pr
join normalize n on n.id = pr.exercise_id
join mukerrer m on m.anahtar = n.anahtar
group by pr.exercise_name

order by 1, 3 desc;

-- ---------------------------------------------------------------------------
-- 4) UNIQUE KISITI ÇAKIŞMASI ÖN KONTROLÜ  ← EN KRİTİK ADIM
--
--    personal_records'ta `unique (user_id, exercise_name)` var. Eğer bir
--    kullanıcının HEM "Squat" HEM "Barbell Squat" rekoru varsa ve bu ikisi
--    birleştirilecekse, isimleri eşitlemek unique kısıtını ihlal eder ve
--    migration ortada patlar.
--
--    Bu sorgu boş dönerse birleştirme güvenli. Satır dönerse, o kullanıcılar
--    için ÖNCE hangi rekorun kalacağına karar verilmeli (genelde est_1rm
--    yüksek olan).
-- ---------------------------------------------------------------------------
select '=== 4) Rekor çakışması riski (BOŞ DÖNMELİ) ===' as bolum;

with normalize as (
  select id, name, english_name,
         lower(btrim(coalesce(nullif(btrim(english_name), ''), name))) as anahtar
  from public.exercises
),
mukerrer as (
  select anahtar from normalize group by anahtar having count(*) > 1
)
select
  pr.user_id,
  n.anahtar                                  as normalize_isim,
  count(*)                                   as ayni_kullanicida_rekor_sayisi,
  array_agg(pr.exercise_name order by pr.est_1rm desc) as isimler,
  array_agg(pr.est_1rm      order by pr.est_1rm desc) as est_1rm_degerleri,
  max(pr.est_1rm)                            as korunmasi_gereken_1rm
from public.personal_records pr
join normalize n on n.id = pr.exercise_id
join mukerrer m on m.anahtar = n.anahtar
group by pr.user_id, n.anahtar
having count(*) > 1
order by count(*) desc;

-- ---------------------------------------------------------------------------
-- 5) ÖZET
-- ---------------------------------------------------------------------------
select '=== 5) Özet ===' as bolum;

with normalize as (
  select id, lower(btrim(coalesce(nullif(btrim(english_name), ''), name))) as anahtar
  from public.exercises
),
gruplar as (
  select anahtar, count(*) as n from normalize group by anahtar having count(*) > 1
)
select
  (select count(*) from gruplar)                       as mukerrer_grup_sayisi,
  (select coalesce(sum(n), 0) from gruplar)            as toplam_kayit,
  (select coalesce(sum(n - 1), 0) from gruplar)        as silinebilecek_kayit,
  (select count(*) from public.exercises)              as toplam_egzersiz;
